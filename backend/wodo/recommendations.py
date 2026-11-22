"""Evaluate sourced KOWR rules against field evidence and confirmed point observations."""

from datetime import date, timedelta

from wodo.declarations import FarmerAnswers
from wodo.recommendation_catalog import (
    ACTIONS,
    OBSERVATIONS,
    REGIONAL_SIGNALS,
    RULES,
    TRIGGERS,
    WET_FIELD_EXCLUSIONS,
    references,
)
from wodo.recommendation_costs import cost_estimate
from wodo.recommendation_descriptions import DESCRIPTIONS

# Weather thresholds are screening conventions. FAO-56 supplies ETc and RAW,
# while operator limits and observations determine whether a treatment is suitable.
RAIN_PROBABILITY = 70
RAIN_INFILTRATION_SHARE = 0.5
PRIORITY = (57, 58, 59, 44, 22, 52, 55, 53)
GROUPS = (11, 1, 27, 30, 21)


def action_details(action_id):
    if action_id not in ACTIONS:
        return {}
    return {"why": DESCRIPTIONS[action_id], "cost_estimate": cost_estimate(action_id)}


def forecast_facts(rows, day, metrics, active_crop):
    if not rows or day > date.max - timedelta(days=3):
        return {}
    facts = {}
    window = [(day + timedelta(days=offset)).isoformat() for offset in range(1, 4)]
    for key, field, threshold, label, unit in (
        ("evaporation", "et0", 4, "duże parowanie", "mm na dobę"),
        ("wind", "wind", 5, "wiatr", "m/s na wysokości 10 m"),
        ("heat", "temperature", 30, "upał", "°C"),
        ("heavy_rain", "hourly_rain_max", 10, "ulewę", "mm w godzinę"),
    ):
        samples = [(rows.get(d, {}).get(field), d) for d in window]
        if (best := max(((v, d) for v, d in samples if v is not None), default=None)) and best[0] >= threshold:
            facts[key] = f"Prognoza Open-Meteo na {best[1]} wskazuje {label} ({best[0]:g} {unit})."
    if not active_crop:
        return facts
    cases = [rows.get(d, {}) for d in window]
    if any(row.get(key) is None for row in cases for key in ("rain", "et0")):
        return facts
    demand = [row["et0"] * metrics["kc"] for row in cases]
    total_rain = sum(row["rain"] for row in cases)
    total_etc = sum(demand)
    period = f"{window[0]} – {window[-1]}"
    if total_rain + 0.1 < total_etc:
        facts["dry_forecast"] = f"W dniach {period} ma spaść {total_rain:.1f} mm deszczu, a uprawa potrzebuje około {total_etc:.1f} mm wody."
    if all(row.get("probability") is not None for row in cases):
        effective = [row["rain"] * RAIN_INFILTRATION_SHARE if row["probability"] >= RAIN_PROBABILITY else 0
                     for row in cases]
        total_effective = sum(effective)
        if total_effective > 0 and total_effective >= total_etc:
            evidence = (f"W dniach {period} z przewidywanego deszczu przyjęliśmy do obliczeń {total_effective:.1f} mm wody. "
                        f"To wystarcza na potrzeby uprawy, które wynoszą około {total_etc:.1f} mm.")
            if root := metrics["root"]:
                depletion = root["initially_dry"]["depletion_mm"]
                for use, rain in zip(demand, effective, strict=True):
                    depletion += use
                    if depletion > root["raw_mm"]:
                        return facts
                    depletion = max(0, depletion - rain)
                evidence += (" Nawet w suchszym wariancie roślinom wystarczy łatwo dostępnej wody do deszczu "
                             f"(ubytek nie przekroczy {root['raw_mm']:g} mm).")
            facts["rain_covers"] = evidence
    return facts


def field_facts(metrics, inputs, request, answers):
    facts = {}
    day, recent, root = request.day, metrics["recent"], metrics["root"]
    active = request.crop != "unknown" and metrics["stage_id"] != 4
    if active:
        facts["active_crop"] = f"Na polu rośnie {metrics['crop']['label'].lower()} ({metrics['stage'].lower()})."
    if recent and recent["crop_balance_mm"] < 0 and 0 <= (day - date.fromisoformat(recent["end"])).days <= 10:
        facts["recent_deficit"] = (f"W ciągu 30 dni do {recent['end']} spadło o {-recent['crop_balance_mm']:g} mm "
                                   "mniej deszczu, niż według obliczeń potrzebowała uprawa.")
    history = metrics["history"]
    if answers.drought_frequency in ("Prawie co roku", "co kilka lat"):
        facts["recurrent"] = f"Według zgłoszenia na polu brakuje wody {answers.drought_frequency.lower()}."
    elif (count := len(history["seasons"])) >= 3 and history["negative_seasons"] * 2 >= count:
        facts["recurrent"] = (f"W {history['negative_seasons']} z {count} sezonów deszczu spadło mniej, "
                              "niż wynosiło zapotrzebowanie na wodę obliczone na podstawie pogody dla rośliny wzorcowej.")
    if root:
        low, high, raw = root["initially_wet"]["depletion_mm"], root["initially_dry"]["depletion_mm"], root["raw_mm"]
        evidence = (f"Według obliczeń ubyło od {low:g} do {high:g} mm wody na głębokości korzeni. "
                    f"Przy ubytku powyżej {raw:g} mm rośliny mogą odczuć brak wody.")
        if high > raw:
            facts["root_risk"] = evidence
            if low <= raw:
                facts["water_uncertain"] = evidence + " Ocena zależy od tego, jak mokra była ziemia na początku."
    else:
        facts["water_uncertain"] = "Brakuje danych, żeby obliczyć zapas wody przy korzeniach."
    if request.irrigation and not any(source.casefold() == "brak dostępu" for source in answers.irrigation_water_source):
        facts["available_irrigation"] = "Rolnik zadeklarował możliwość nawadniania."
    if request.soil_observation == "wet":
        facts["wet"] = "Rolnik zgłosił, że ziemia jest mokra."
    elif request.soil_observation == "dry":
        facts["field_dry"] = "Rolnik zgłosił, że ziemia jest sucha."
    if answers.drainage_status in ("Tak, całe pole", "częściowo"):
        area = "całe pole" if answers.drainage_status == "Tak, całe pole" else "część pola"
        facts["drainage"] = f"Rolnik zgłosił, że urządzenia odprowadzające wodę obejmują {area}."
    for key, value, observation in (
        ("runoff", answers.surface_runoff_frequency, "spływa po powierzchni pola"),
        ("ponding", answers.ponding_frequency, "długo stoi na polu"),
    ):
        if value and value.casefold() in ("często", "czasami"):
            facts[key] = f"Według relacji rolnika woda {value.lower()} {observation}."
    if (slope := inputs.get("terrain", {}).get("slope_pct")) is not None and slope >= 3:
        facts["slope"] = f"Według mapy terenu typowe nachylenie pola wynosi {slope:g}%."
    if active and "recent_deficit" in facts and not inputs.get("retention_available"):
        facts["soil_missing"] = "Brakuje danych o tym, ile wody gleba zatrzymuje na głębokości korzeni."
    if (comparison := metrics.get("satellite_comparison")) and (scene := inputs.get("satellite", {}).get("scene")):
        if (comparison["n"] >= 3 and 0 <= (day - date.fromisoformat(scene["date"])).days <= 14
                and min(comparison["ndmi_delta"], comparison["ndvi_delta"]) <= -0.10):
            facts["sat_anomaly"] = (f"Zdjęcie z {scene['date']} porównaliśmy z {comparison['n']} podobnymi zdjęciami. "
                                    f"Różnica wskaźnika zieleni roślin wyniosła {comparison['ndvi_delta']:+.2f}, "
                                    f"a wskaźnika wody w roślinach {comparison['ndmi_delta']:+.2f}.")
    return facts | forecast_facts(inputs.get("forecast", {}).get("rows", {}), day, metrics, active)


# Przesłanka z całej działki nie wyznacza położenia tych działań.
SITE_LABELS = {
    7: "Fragment z potwierdzoną zagęszczoną warstwą gleby",
    15: "Pas na drodze spływu wody, zanim woda opuści pole",
    16: "Uprawiany stok, wzdłuż warstwic",
    18: "Przy odpływie wody z dostępnego dachu",
    19: "Przy urządzeniach regulujących odpływ z drenów",
    20: "Podmokłe obniżenie terenu",
    30: "Miejsca pomiaru w strefach o różnej wilgotności",
    31: "Stałe ścieżki przejazdu maszyn",
    38: "Pasy upraw wzdłuż warstwic na stoku",
    39: "Pasy przeznaczone na drzewa i krzewy",
    41: "Wzdłuż instalacji nawadniającej",
    42: "W zasięgu sprawdzanych zraszaczy",
    50: "Strefy o różnych właściwościach gleby",
    52: "Miejsce pomiaru przy korzeniach uprawy",
    53: "Fragment uprawy o słabszej kondycji",
    54: "Miejsca pobrania próbek gleby",
    55: "Miejsca zastoisk lub utrudnionego wsiąkania wody",
    60: "Wyloty drenów i miejsca odpływu wody",
}


def locate_action(rec, sample_point=None, day=None):
    key = rec.get("id")
    points = rec.get("points") or []
    if rec.get("scope") not in ("field", "point") or key not in ACTIONS:
        return
    if key in (52, 54) and not points and sample_point and day:
        points = rec["points"] = [{"coordinates": list(sample_point), "type": "Proponowane miejsce pomiaru",
                                   "date": str(day), "description": "Punkt startowy wewnątrz granicy działki.",
                                   "evidence": "Porównaj wynik z pomiarami w innych częściach pola."}]
    if points and (rec["scope"] == "point" or key in SITE_LABELS):
        rec["scope"] = "point"
        rec["location"] = f"Miejsca na mapie ({len(points)})"
        where = "w miejscach wskazanych na mapie"
    elif key in SITE_LABELS:
        rec["scope"] = "site"
        rec["location"] = SITE_LABELS[key]
        where = "po potwierdzeniu lokalizacji w terenie"
    else:
        rec["location"] = "Całe pole"
        where = "na całym polu"
    rec["steps"] = action_steps(ACTIONS[key], where)


def action_steps(row, where):
    """Krótki plan działań złożony wyłącznie z pól katalogu rekomendacji i dowodów z pola."""
    return [
        f"Zacznij od oceny, czy warunki się zgadzają: {row['warunki_rekomendacji'].rstrip('.')}.",
        f"Zaplanuj termin: {row['termin_realizacji'].rstrip('.')}.",
        f"Przygotuj się na koszt ({row['koszt']}): {row['skladniki_kosztu'].rstrip('.')}.",
        f"Zastosuj działanie „{row['dzialanie']}” {where}.",
    ]


def matching_actions(facts, answers, day, sample_point=None):
    """Keep field observations at field scale and attach local evidence to its declared points."""
    field = facts | {key: f"Informacja od rolnika. {OBSERVATIONS[key]}." for key in answers.recommendation_observations}
    locations = [(None, field)]
    regional = {key: facts[key] for key in facts.keys() & REGIONAL_SIGNALS}
    if "legal_water" in field:
        regional["legal_water"] = field["legal_water"]
    for zone in answers.problem_zones:
        local = regional | {key: f"Obserwacja w zaznaczonym miejscu. {OBSERVATIONS[key]}."
                            for key in zone.recommendation_observations}
        age = (day - zone.date).days
        if zone.type == "Zastoiska":
            local["point_ponding"] = f"Rolnik zaznaczył miejsce, gdzie stała woda ({zone.date.isoformat()})."
            if 0 <= age <= 2:
                local["point_recent_ponding"] = local["point_ponding"]
        elif zone.type == "Przesuszenie" and 0 <= age <= 6:
            local["point_recent_dry"] = f"Rolnik zaznaczył miejsce, gdzie ziemia wyschła ({zone.date.isoformat()})."
        locations.append((zone, local))

    for key in RULES:
        row = ACTIONS[key]
        matched = []
        for zone, evidence in locations:
            if zone is not None and key == 25 and ("point_recent_ponding" in evidence or "waterlogged" in evidence):
                continue
            if zone is None and key in WET_FIELD_EXCLUSIONS and ("wet" in field or "waterlogged" in field):
                continue
            for alternative in TRIGGERS[key].get("point" if zone else "field", ()):
                if all(fact in evidence for fact in alternative):
                    matched.append((zone, " ".join(evidence[fact] for fact in alternative)))
                    break
        if not matched:
            continue
        points = [{"coordinates": list(zone.geometry.coordinates), "type": zone.type, "date": zone.date.isoformat(),
                   "description": zone.description, "evidence": evidence} for zone, evidence in matched if zone is not None]
        field_evidence = next((evidence for zone, evidence in matched if zone is None), None)
        rec = {"id": key, "group": row["kategoria"], "title": row["dzialanie"], "action": row["dzialanie"],
               **action_details(key), "evidence": field_evidence or " ".join(dict.fromkeys(point["evidence"] for point in points)),
               "when": row["termin_realizacji"], "confidence": "wstępna", "limits": row["warunki_rekomendacji"],
               "cost": row["koszt"], "cost_details": row["skladniki_kosztu"],
               "scope": "field" if field_evidence else "point", "points": points, "sources": references(key)}
        locate_action(rec, sample_point, day)
        yield rec


def recommendations(metrics, inputs, request, agricultural, sample_point=None):
    if not agricultural:
        return []
    answers = getattr(request, "farmer_answers", FarmerAnswers())
    facts = field_facts(metrics, inputs, request, answers)
    actions = ordered_recommendations(facts, answers, request.day, sample_point)
    if "sat_anomaly" in facts:
        scene = inputs["satellite"]["scene"]
        comparison = metrics["satellite_comparison"]
        indicator = min(("ndvi", "ndmi"), key=lambda name: comparison[f"{name}_delta"])
        point = scene.get(f"{indicator}_low_point")
        for rec in actions:
            if rec["id"] == 53 and point and not rec["points"]:
                rec["scope"] = "point"
                rec["points"] = [{"coordinates": point, "date": scene["date"], "type": "Miejsce do lustracji",
                                  "description": "Środek piksela Sentinel-2 (20 m).",
                                  "evidence": f"W tym miejscu wskaźnik {indicator.upper()} należy do niższych na polu."}]
                locate_action(rec)
    return actions


def ordered_recommendations(facts, answers, day, sample_point=None):
    groups = [ACTIONS[key]["kategoria"] for key in GROUPS]
    return sorted(matching_actions(facts, answers, day, sample_point), key=lambda item: (
        PRIORITY.index(item["id"]) if item["id"] in PRIORITY else len(PRIORITY),
        groups.index(item["group"]) if item["group"] in groups else len(groups), item["id"],
    ))
