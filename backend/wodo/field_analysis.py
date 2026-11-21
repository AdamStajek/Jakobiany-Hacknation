"""Offline interpretation of a dated field passport."""
from calendar import monthrange
from datetime import date, timedelta
from math import isfinite, radians, tan
from types import SimpleNamespace

from wodo.declarations import FarmerAnswers
from wodo.farmer_report import root_message
from wodo.recommendations import field_facts, ordered_recommendations
from wodo.science import CROPS, STAGES, UNKNOWN_CROP, phenology, summarize
from wodo.weather import forecast_rows

METHODS = {
    "root": {"reference": "https://www.fao.org/4/x0490e/x0490e0e.htm",
             "inputs": ["root_zone_taw_mm", "root_zone_raw_mm", "root_zone_depletion_mm"],
             "equations": ["S = TAW - Dr", "Ks = min(1, S / (TAW - RAW))"]},
    "climate": {"inputs": ["precipitation_mm", "et0_mm"], "equations": ["B = sum(P - ET0)"]},
    "profile": {"inputs": ["soil_moisture_0_7_cm", "soil_moisture_7_28_cm", "soil_moisture_28_100_cm"],
                "equations": ["W_mm = 10 * sum(theta * thickness_cm)"]},
    "storage": {"inputs": ["potential_depression_volume_m3", "parcel_area_ha"],
                "equations": ["h_mm = V_m3 / (10 * A_ha)"]},
}


def number(value):
    return type(value) in (float, int) and abs(value) < 1e100 and isfinite(value) and value >= 0


def stamp(value):
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def monthly_balance(rain, et, end):
    """Complete calendar months only, sorted and individually traceable."""
    totals = {}
    if isinstance(rain, dict) and isinstance(et, dict):
        for key in rain.keys() & et.keys():
            day = stamp(key)
            if day and str(day) == key and day <= end and number(rain[key]) and number(et[key]):
                totals.setdefault(key[:7], []).append((key, rain[key] - et[key]))
    return {month: sum(delta for _, delta in sorted(days)) for month, days in sorted(totals.items())
            if len(days) == monthrange(int(month[:4]), int(month[5:]))[1]}


def analyze_field(field_passport: dict, analysis_date: date, *, farmer_answers=None, irrigation=False, crop_key=None,
                  sowing=None, stage=None, soil_observation=None) -> dict:
    snapshot = stamp(field_passport.get("analysis_as_of"))
    if not isinstance(field_passport.get("parcel_id"), str) or not snapshot or not isinstance(field_passport.get("fields"), list) or not field_passport.get("parcel_id"):
        raise ValueError("Wymagany jest datowany paszport z identyfikatorem i listą fields.")
    fields, missing, trace = {}, {}, {}
    for index, row in enumerate(field_passport["fields"]):
        if not isinstance(row, dict) or not isinstance(row.get("field"), str):
            raise ValueError("Niepoprawny rekord w fields.")
        key = row["field"]
        meta = row.get("provenance") or {}
        if not isinstance(meta, dict):
            raise ValueError("Niepoprawne metadane pochodzenia.")
        available = stamp(meta.get("available_at") or meta.get("fetched_at") or meta.get("assembled_at"))
        observed = stamp(meta.get("observed_at"))
        if row.get("status") != "ok":
            missing[key] = row.get("detail") or "Brak wartości."
        elif available is None or available > analysis_date or (observed and observed > analysis_date):
            missing[key] = "Brak potwierdzenia dostępności w dniu analizy."
        elif snapshot != analysis_date and key not in METHODS["climate"]["inputs"] + METHODS["profile"]["inputs"]:
            missing[key] = "Wartość podsumowuje inny dzień."
        else:
            fields[key] = row
            trace[key] = {"path": f"/fields/{index}", "source": meta.get("source_id") or row.get("source"),
                          "available_by": str(available)}

    def value(key, unit):
        row = fields.get(key, {})
        return row.get("value") if row.get("unit") == unit else None

    balance = {"status": "brak kompletnych 30 par opad–ET0"}
    rain, et = (value(k, "mm") for k in METHODS["climate"]["inputs"])
    if isinstance(rain, dict) and isinstance(et, dict):
        days = [str(analysis_date - timedelta(days=i)) for i in range(30)]
        if all(number(s.get(d)) for s in (rain, et) for d in days):
            p, e = (sum(s[d] for d in days) for s in (rain, et))
            balance = {"status": "ok", "rain_mm": p, "reference_et_mm": e, "p_minus_et0_mm": p-e,
                       "start": days[-1], "end": days[0]}
    root = {"status": "brak spójnego bilansu i wariantów stanu początkowego"}
    taw, raw, dr = (value(k, "mm") for k in METHODS["root"]["inputs"])
    if number(taw) and number(raw) and raw < taw:
        root.update(taw_mm=taw, raw_mm=raw)
    model = fields.get("root_zone_depletion_mm", {}).get("provenance", {})
    context = model or fields.get("root_zone_taw_mm", {}).get("provenance", {})
    bounds = model.get("uncertainty")
    bounds = bounds.get("depletion_range_mm") if isinstance(bounds, dict) else None
    stress = "Brak podstaw do oceny."
    message = "Brakuje danych, żeby ocenić, ile wody zostało przy korzeniach w dniu analizy."
    scenario = {"status": "brak wariantów wyczerpania"}
    if (number(taw) and number(raw) and raw < taw and isinstance(bounds, list) and len(bounds) == 2
            and all(number(x) for x in bounds) and dr == bounds[0] and dr <= bounds[1] <= round(taw, 1)):
        storage = [max(0, taw-x) for x in reversed(bounds)]
        root = {"status": "model", "storage_range_mm": storage, "depletion_range_mm": bounds,
                "ks_range": [min(1, s/(taw-raw)) for s in storage], "taw_mm": taw, "raw_mm": raw}
        stress = ("Oba warianty przekraczają RAW." if dr > raw else
                  "Stan początkowy zmienia ocenę stresu." if bounds[1] > raw else
                  "W obu wariantach zapas wystarcza do pokrycia potrzeb bez redukcji poboru.")
        message = root_message(*bounds, raw)
        scenario = {"status": "hipotetyczny impuls 1 mm netto do strefy korzeniowej",
                    "storage_gain_range_mm": [min(1, x) for x in bounds],
                    "horizon": "bezpośrednio po dopływie, przed ET",
                    "baseline_storage_range_mm": storage}
    volume = value("potential_depression_volume_m3", "m³")
    area = value("parcel_area_ha", "ha")
    retention = {"status": "brak objętości zagłębień lub powierzchni"}
    if number(volume) and number(area) and area > 0:
        retention = {"status": "model NMT", "geometric_capacity_m3": volume,
                     "equivalent_field_depth_mm": volume / (10 * area)}
    causes = []
    if balance.get("status") == "ok" and balance["p_minus_et0_mm"] < 0:
        causes.append({"evidence": "climate", "finding": "Opad z 30 dni poniżej referencyjnej ET.",
                       "alternative": "Wcześniejszy zapas gleby lub nawadnianie mogą pokrywać różnicę."})
    satellite = {}
    for key in ("ndmi_anomaly", "ndvi_anomaly"):
        anomaly = value(key, "1")
        if type(anomaly) in (int, float) and -2 <= anomaly <= 2:
            satellite[key] = anomaly
    layers = [(0, 7), (7, 28), (28, 100)]
    profile = {}
    for top, bottom in layers:
        key = f"soil_moisture_{top}_{bottom}_cm"
        series = value(key, "m³/m³")
        theta = series.get(str(analysis_date)) if isinstance(series, dict) else None
        if number(theta) and theta <= 1:
            profile[key] = theta * (bottom-top) * 10
    history = value("historical_drought_frequency_pct", "%")
    historical_scenario = fields.get("historical_drought_frequency_pct", {}).get("provenance", {}).get("historical_scenario")
    inferred_crop = context.get("crop")
    crop_key = crop_key or (inferred_crop if isinstance(inferred_crop, str) and inferred_crop in CROPS else UNKNOWN_CROP)
    inferred_stage = context.get("stage")
    if stage is None and type(inferred_stage) is int and 0 <= inferred_stage <= 4:
        stage = inferred_stage
    sowing = sowing or stamp(context.get("sowing"))
    crop = CROPS[crop_key]
    phase, kc = phenology(crop, analysis_date, sowing, stage)

    # Use only records accepted by the passport's as-of provenance checks.
    rows = {}
    if isinstance(rain, dict) and isinstance(et, dict):
        rows = {d: [rain[d], et[d], None] for d in rain.keys() & et.keys() if number(rain[d]) and number(et[d])}
    recent = summarize(rows, analysis_date - timedelta(days=29), analysis_date, crop, sowing, stage) if rows else None
    forecast_fields = {
        "rain": ("forecast_liquid_precipitation_mm", "mm"),
        "et0": ("forecast_et0_mm", "mm"),
        "probability": ("forecast_precip_probability_pct", "%"),
        "temperature": ("forecast_temp_max_c", "°C"),
    }
    forecast_series = {key: series for key, (field, unit) in forecast_fields.items()
                       if isinstance(series := value(field, unit), dict)}
    if isinstance(wind := value("forecast_wind_speed_m_s", "m/s"), dict):
        for time, speed in wind.items():
            if number(speed):
                daily_wind = forecast_series.setdefault("wind", {})
                daily_wind[time[:10]] = max(daily_wind.get(time[:10], 0), speed)
    hourly_rain = value("forecast_hourly_rain_mm", "mm")
    forecast = forecast_rows(forecast_series, hourly_rain if isinstance(hourly_rain, dict) else {})
    slope = value("slope_mean_deg", "°")
    metrics = {
        "recent": recent, "history": {"seasons": [], "negative_seasons": 0}, "stage": STAGES[phase],
        "stage_id": phase, "kc": kc, "crop": {"label": crop.label},
        "root": {"raw_mm": raw, "initially_wet": {"depletion_mm": bounds[0]},
                 "initially_dry": {"depletion_mm": bounds[1]}} if root["status"] == "model" else None,
    }
    request = SimpleNamespace(day=analysis_date, crop=crop_key, irrigation=irrigation, soil_observation=soil_observation)
    answers = farmer_answers or FarmerAnswers()
    facts = field_facts(metrics, {"forecast": {"rows": forecast}, "retention_available": "taw_mm" in root},
                        request, answers)
    if number(slope) and slope < 90 and (grade := 100 * tan(radians(slope))) >= 3:
        facts["slope"] = f"Średnie nachylenie według NMT: {grade:.1f}%."
    if number(history) and 50 <= history <= 100:
        facts.setdefault("recurrent", f"Scenariusz paszportu: deficyt modelowy w {history:g}% sezonów.")
    if (scene_day := stamp(fields.get("ndmi_anomaly", fields.get("ndvi_anomaly", {})).get("provenance", {}).get("observed_at"))
            ) and 0 <= (analysis_date - scene_day).days <= 14:
        if any(anomaly <= -.1 for anomaly in satellite.values()):
            facts["sat_anomaly"] = f"Scena {scene_day}: " + ", ".join(
                f"{key[:4].upper()} {delta:+.2f}" for key, delta in satellite.items()
            ) + " względem porównywalnych sezonów."
    actions = ordered_recommendations(facts, answers, analysis_date)
    if root["status"] != "model" and crop_key != UNKNOWN_CROP and phase == 4:
        message = "Wybrana data wypada poza okresem wzrostu tej uprawy według typowego kalendarza."
    return {"farmer_report": {"situation": message, "next_check": None, "steps": actions},
            "schema_version": "1.1", "field_id": field_passport["parcel_id"], "analysis_date": str(analysis_date),
            "crop_context": {k: context.get(k) for k in ("crop", "stage", "sowing")},
            "data_quality": {"passport_rows": len(field_passport["fields"]), "accepted_fields": len(fields)},
            "water_balance": balance, "soil_water_availability": root, "retention_potential": retention,
            "historical_analysis": {"complete_months_p_minus_et0_mm": monthly_balance(rain, et, analysis_date),
                                    "empirical_stressed_seasons_pct": history if number(history) and history <= 100 else None,
                                    "scenario": historical_scenario},
            "modelled_soil_profile": {"layer_storage_mm": profile,
                                      "total_water_0_100_cm_mm": sum(profile.values()) if len(profile) == 3 else None},
            "water_status": stress, "root_cause_analysis": causes, "scenario_analysis": scenario,
            "satellite_context": {"anomalies": satellite, "interpretation": "Odchylenia od tła uprawy i fazy. Możliwy wpływ chorób i terminu siewu."},
            "irrigation_recommendations": {"dose_mm": None, "reason": "Brak pomiaru profilu, sprawności instalacji i potwierdzonej dostępności wody."},
            "prioritized_action_plan": actions, "missing_data": missing, "calculation_trace": trace,
            "methods": METHODS, "uncertainty": "Zakres modelu obejmuje dwa stany początkowe. Brak kalibracji polowej.",
            "limitations": ["P−ET0 opisuje atmosferę. Brak rozdzielenia odpływu, infiltracji i drenażu.",
                            "Pojemność geometryczna wymaga potwierdzenia dopływu i wolnej objętości."]}
