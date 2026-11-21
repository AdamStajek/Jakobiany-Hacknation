"""Deterministic FAO-56 screening calculations. All depths and fluxes are in mm."""

from dataclasses import asdict, dataclass
from datetime import date, timedelta
from math import acos, cos, exp, pi, sin, tan
from statistics import median


@dataclass(frozen=True)
class Crop:
    label: str
    start: tuple[int, int]
    stages: tuple[int, int, int, int]
    kc: tuple[float, float, float]
    root_m: float
    p: float
    sensitive: str


# FAO-56 tables 12 and 22. Starts and lengths are screening calendars for Poland.
CROPS = {
    "wheat": Crop("Pszenica ozima", (4, 1), (25, 30, 40, 25), (.40, 1.15, .30), 1.0, .55, "kłoszenie i nalewanie ziarna"),
    "maize": Crop("Kukurydza na ziarno", (4, 25), (25, 40, 50, 35), (.30, 1.20, .35), 1.0, .55, "wiechowanie i kwitnienie"),
    "potato": Crop("Ziemniak", (4, 20), (25, 30, 45, 30), (.50, 1.15, .75), .5, .35, "zawiązywanie i wzrost bulw"),
    "rapeseed": Crop("Rzepak ozimy", (3, 20), (25, 30, 40, 20), (.35, 1.10, .35), 1.0, .60, "kwitnienie i rozwój łuszczyn"),
    "beet": Crop("Burak cukrowy", (4, 5), (30, 45, 65, 35), (.35, 1.20, .70), .8, .55, "intensywny wzrost korzenia"),
    "grass": Crop("Użytki zielone", (4, 1), (20, 25, 105, 25), (.40, .95, .85), .6, .60, "odrost po pokosie"),
    # Brak deklaracji rolnika: Kc = 1 (ET0 trawy referencyjnej) przez cały rok, uśredniona strefa korzeni.
    "unknown": Crop("Nie wiem / brak danych o uprawie", (1, 1), (1, 1, 363, 1), (1.0, 1.0, 1.0), .5, .5, "okresy bez opadów"),
}
UNKNOWN_CROP = "unknown"
STAGES = ("Początek wzrostu", "Rozwój", "Pełnia wzrostu", "Dojrzewanie", "Poza sezonem")
MONTHS = ("", "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec",
          "sierpień", "wrzesień", "październik", "listopad", "grudzień")


def years_ago(day, years):
    try:
        return day.replace(year=day.year - years)
    except ValueError:
        return day.replace(year=day.year - years, day=28)


def dates(start, end):
    for offset in range((end - start).days + 1):
        yield start + timedelta(days=offset)


def saturation(temp):
    return .6108 * exp(17.27 * temp / (temp + 237.3))


def extraterrestrial_radiation(day, lat):
    phi = lat * pi / 180
    j = day.timetuple().tm_yday
    dr = 1 + .033 * cos(2 * pi * j / 365)
    delta = .409 * sin(2 * pi * j / 365 - 1.39)
    omega = acos(max(-1, min(1, -tan(phi) * tan(delta))))
    return 24 * 60 / pi * .0820 * dr * (omega * sin(phi) * sin(delta) + cos(phi) * cos(delta) * sin(omega))


def et0_hargreaves(day, lat, tmean, tmin, tmax):
    """FAO-56 Eq. 52, extraterrestrial radiation as equivalent evaporation."""
    return max(0, .0023 * (tmean + 17.8) * max(0, tmax - tmin) ** .5 * .408 *
               extraterrestrial_radiation(day, lat))


def et0_fao56(day, lat, elev, tmean, tmin, tmax, dew, wind, solar):
    """FAO-56 daily short grass, G=0, wind at 2 m, shortwave in MJ/m²/day."""
    ra = extraterrestrial_radiation(day, lat)
    rso = (.75 + .00002 * elev) * ra
    ea = min(saturation(dew), (saturation(tmin) + saturation(tmax)) / 2)
    es = (saturation(tmin) + saturation(tmax)) / 2
    slope = 4098 * saturation(tmean) / (tmean + 237.3) ** 2
    gamma = .000665 * 101.3 * ((293 - .0065 * elev) / 293) ** 5.26
    cloud = max(.05, 1.35 * min(1, solar / rso) - .35) if rso > 0 else .05
    longwave = 4.903e-9 * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2 * (.34 - .14 * ea ** .5) * cloud
    rn = .77 * solar - longwave
    return max(0, (.408 * slope * rn + gamma * 900 / (tmean + 273) * wind * (es - ea)) /
               (slope + gamma * (1 + .34 * wind)))


def phenology(crop, day, sowing=None, stage=None):
    first = sowing or date(day.year, *crop.start)
    elapsed = (day - first).days
    a, b, c, d = crop.stages
    low, mid, end = crop.kc
    if stage is not None:
        return stage, (low, (low + mid) / 2, mid, (mid + end) / 2, .25)[stage]
    if elapsed < 0 or elapsed >= a + b + c + d:
        return 4, .25
    if elapsed < a:
        return 0, low
    if elapsed < a + b:
        return 1, low + (mid - low) * (elapsed - a) / b
    if elapsed < a + b + c:
        return 2, mid
    return 3, mid + (end - mid) * (elapsed - a - b - c) / d


def retention(layers, depth):
    limits = ((0, .05), (.05, .15), (.15, .30), (.30, .60), (.60, 1))
    taw = 0
    for (top, bottom), layer in zip(limits, layers, strict=True):
        overlap = max(0, min(depth, bottom) - top)
        if overlap:
            if layer is None or layer[0] <= layer[1]:
                return None
            taw += overlap * (layer[0] - layer[1])
    return taw or None


def bucket(start, taw, p, rows, *, daily_unmet=None):
    """Bucket uses rain + net irrigation first, clips drainage and applies FAO-56 Ks."""
    store = start
    drainage = effective = actual = unmet = 0.0
    raw = p * taw
    for rain, etc, irrigation in rows:
        incoming = store + rain + irrigation
        overflow = max(0, incoming - taw)
        before_et = min(taw, incoming)
        ks = min(1, before_et / (taw - raw))
        used = min(before_et, etc * ks)
        store = before_et - used
        drainage += overflow
        effective += min(rain, max(0, taw - (incoming - rain)))
        actual += used
        unmet += etc - used
        if daily_unmet is not None:
            daily_unmet.append(etc - used)
    return {"storage_mm": round(store, 1), "depletion_mm": round(taw - store, 1),
            "drainage_mm": round(drainage, 1), "effective_rain_mm": round(effective, 1),
            "eta_mm": round(actual, 1), "unmet_mm": round(unmet, 1)}


def summarize(rows, start, end, crop=None, sowing=None, stage=None):
    days = list(dates(start, end))
    samples = [rows.get(day.isoformat()) for day in days]
    paired = [(day, row) for day, row in zip(days, samples, strict=True)
              if row is not None and row[0] is not None and row[1] is not None]
    if not days or len(paired) / len(days) < .9:
        return None
    longest = current = 0
    for row in samples:
        current = current + 1 if row and row[0] is not None and row[0] < 1 else 0
        longest = max(longest, current)
    rain = sum(row[0] for _, row in paired)
    et0 = sum(row[1] for _, row in paired)
    etc = sum(row[1] * phenology(crop, day, sowing, stage if day == end else None)[1]
              for day, row in paired) if crop else None
    temperatures = [row[2] for _, row in paired if row[2] is not None]
    return {"start": start.isoformat(), "end": end.isoformat(), "samples": len(paired), "days": len(days),
            "rain_mm": round(rain, 1), "et0_mm": round(et0, 1), "balance_mm": round(rain - et0, 1),
            "etc_mm": None if etc is None else round(etc, 1),
            "crop_balance_mm": None if etc is None else round(rain - etc, 1),
            "mean_temp_c": round(sum(temperatures) / len(temperatures), 1) if temperatures else None,
            "dry_spell_days": longest}


def rainfall_history(rows, selected):
    start = years_ago(selected, 10)
    seasons = []
    months = {i: [] for i in range(4, 10)}
    matched = []
    for year in range(start.year, selected.year + 1):
        first, last = date(year, 4, 1), date(year, 9, 30)
        if start <= first and last <= selected:
            if summary := summarize(rows, first, last):
                seasons.append({"year": year, **summary})
        for month in months:
            first = date(year, month, 1)
            last = date(year, month + 1, 1) - timedelta(days=1)
            if start <= first and last <= selected:
                if summary := summarize(rows, first, last):
                    months[month].append(summary["balance_mm"])
    for year_offset in range(1, 11):
        end = years_ago(selected, year_offset)
        if summary := summarize(rows, end - timedelta(days=29), end):
            matched.append(summary)
    monthly = [{"month": MONTHS[m], "median_mm": round(median(group), 1), "years": len(group)}
               for m, group in months.items() if len(group) >= 3]
    results = sorted(monthly, key=lambda x: x["median_mm"])
    threshold = round(median(s["balance_mm"] for s in seasons), 1) if seasons else None
    return {"seasons": seasons, "monthly": monthly, "matched_years": len(matched),
            "matched_rain_mm": round(median(s["rain_mm"] for s in matched), 1) if matched else None,
            "matched_balance_mm": round(median(s["balance_mm"] for s in matched), 1) if matched else None,
            "median_season_mm": threshold,
            "negative_seasons": sum(s["balance_mm"] < 0 for s in seasons),
            "riskiest_months": [x["month"] for x in results if x["median_mm"] < 0][:3]}


def assess(rows, soil, crop_key, selected, sowing=None, stage=None, irrigation_mm=0):
    crop = CROPS[crop_key]
    if crop_key == UNKNOWN_CROP:
        sowing = stage = None
    stage_id, kc = phenology(crop, selected, sowing, stage)
    recent = summarize(rows, selected - timedelta(days=29), selected, crop, sowing, stage)
    usable = [d for d, values in rows.items() if d <= selected.isoformat() and None not in values[:2]]
    if not recent and usable:
        newest = date.fromisoformat(max(usable))
        if 0 < (selected - newest).days <= 10:
            recent = summarize(rows, newest - timedelta(days=29), newest, crop, sowing)
    history = rainfall_history(rows, selected)
    if recent and recent["end"] == selected.isoformat() and history["matched_years"] >= 3:
        recent["rain_anomaly_mm"] = round(recent["rain_mm"] - history["matched_rain_mm"], 1)
        recent["balance_anomaly_mm"] = round(recent["balance_mm"] - history["matched_balance_mm"], 1)
    taw = retention(soil["layers"], crop.root_m) if soil else None
    root = None
    current = rows.get(selected.isoformat())
    if taw and current and all(value is not None for value in current[:2]) and stage_id != 4:
        inputs = []
        for d in dates(selected - timedelta(days=89), selected):
            values = rows.get(d.isoformat())
            if not values or None in values[:2]:
                inputs.clear()
                continue
            coeff = phenology(crop, d, sowing, stage if d == selected else None)[1]
            inputs.append((values[0], values[1] * coeff, irrigation_mm if d == selected else 0))
        if len(inputs) >= 21:
            dry = bucket(0, taw, crop.p, inputs)
            wet = bucket(taw, taw, crop.p, inputs)
            root = {"taw_mm": round(taw, 1), "raw_mm": round(crop.p * taw, 1), "days": len(inputs),
                    "initially_dry": dry, "initially_wet": wet, "input_mm": irrigation_mm}
    risk = "Brak podstaw do oceny"
    if stage_id == 4:
        risk = "Poza okresem aktywnej uprawy"
    elif root:
        low = root["initially_wet"]["depletion_mm"]
        high = root["initially_dry"]["depletion_mm"]
        risk = "Podwyższone" if low > root["raw_mm"] else "Niepewne" if high > root["raw_mm"] else "Niskie w modelu"
    elif recent:
        risk = "Sygnał niedoboru" if recent["crop_balance_mm"] < 0 else "Brak sygnału z opadu i ET"
    return {"crop": asdict(crop), "stage": "Nieokreślona" if crop_key == UNKNOWN_CROP else STAGES[stage_id], "stage_id": stage_id, "kc": round(kc, 3),
            "recent": recent, "history": history, "root": root, "risk": risk,
            "weather_last_day": max(usable, default=None), "weather_first_day": min(usable, default=None)}
