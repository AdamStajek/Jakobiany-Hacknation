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

# Weather thresholds are screening conventions. FAO-56 supplies ETc and RAW,
# while operator limits and observations determine whether a treatment is suitable.
RAIN_PROBABILITY = 70
RAIN_INFILTRATION_SHARE = 0.5
PRIORITY = (57, 58, 59, 44, 22, 52, 55, 53)
GROUPS = (11, 1, 27, 30, 21)


def forecast_facts(rows, day, metrics, active_crop):
    if not rows or day > date.max - timedelta(days=3):
        return {}
    facts = {}
    window = [(day + timedelta(days=offset)).isoformat() for offset in range(1, 4)]
    for key, field, threshold, unit in (
        ("evaporation", "et0", 4, "mm ET₀"),
        ("wind", "wind", 5, "m/s na 10 m"),
        ("heat", "temperature", 30, "°C"),
        ("heavy_rain", "hourly_rain_max", 10, "mm/h"),
    ):
        samples = [(rows.get(d, {}).get(field), d) for d in window]
        if (best := max(((v, d) for v, d in samples if v is not None), default=None)) and best[0] >= threshold:
            facts[key] = f"Prognoza Open-Meteo na {best[1]}: {best[0]:g} {unit}."
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
        facts["dry_forecast"] = f"Prognoza {period}: opad {total_rain:.1f} mm, ETc {total_etc:.1f} mm."
    if all(row.get("probability") is not None for row in cases):
        effective = [row["rain"] * RAIN_INFILTRATION_SHARE if row["probability"] >= RAIN_PROBABILITY else 0
                     for row in cases]
        total_effective = sum(effective)
        if total_effective > 0 and total_effective >= total_etc:
            evidence = f"Prognoza {period}: opad uwzględniony w bilansie {total_effective:.1f} mm, ETc {total_etc:.1f} mm."
            if root := metrics["root"]:
                depletion = root["initially_dry"]["depletion_mm"]
                for use, rain in zip(demand, effective, strict=True):
                    depletion += use
                    if depletion > root["raw_mm"]:
                        return facts
                    depletion = max(0, depletion - rain)
                evidence += f" W suchszym wariancie ubytek mieści się w progu RAW {root['raw_mm']:g} mm."
            facts["rain_covers"] = evidence
    return facts


def field_facts(metrics, inputs, request, answers):
    facts = {}
    day, recent, root = request.day, metrics["recent"], metrics["root"]
    active = request.crop != "unknown" and metrics["stage_id"] != 4
    if active:
        facts["active_crop"] = f"{metrics['crop']['label']} · {metrics['stage']}."
    if recent and recent["crop_balance_mm"] < 0 and 0 <= (day - date.fromisoformat(recent["end"])).days <= 10:
        facts["recent_deficit"] = f"Bilans opad − ETc do {recent['end']}: {recent['crop_balance_mm']:+g} mm."
    history = metrics["history"]
    if answers.drought_frequency in ("Prawie co roku", "co kilka lat"):
        facts["recurrent"] = f"Częstość niedoboru według rolnika: {answers.drought_frequency.lower()}."
    elif (count := len(history["seasons"])) >= 3 and history["negative_seasons"] * 2 >= count:
        facts["recurrent"] = f"Ujemny bilans opad − ET₀ w {history['negative_seasons']} z {count} sezonów."
    if root:
        low, high, raw = root["initially_wet"]["depletion_mm"], root["initially_dry"]["depletion_mm"], root["raw_mm"]
        evidence = f"Modelowany ubytek {low:g}–{high:g} mm przy progu RAW {raw:g} mm."
        if high > raw:
            facts["root_risk"] = evidence
            if low <= raw:
                facts["water_uncertain"] = evidence
    else:
        facts["water_uncertain"] = "Brak kompletnego bilansu w strefie korzeniowej."
    if request.irrigation and not any(source.casefold() == "brak dostępu" for source in answers.irrigation_water_source):
        facts["available_irrigation"] = "Rolnik zadeklarował możliwość nawadniania."
    if request.soil_observation == "wet":
        facts["wet"] = "Ocena rolnika: gleba mokra."
    elif request.soil_observation == "dry":
        facts["field_dry"] = "Ocena rolnika: gleba sucha."
    if answers.drainage_status in ("Tak, całe pole", "częściowo"):
        facts["drainage"] = f"Zadeklarowany drenaż lub melioracja: {answers.drainage_status.lower()}."
    for key, value, label in (
        ("runoff", answers.surface_runoff_frequency, "Spływ powierzchniowy"),
        ("ponding", answers.ponding_frequency, "Długie zastoiska"),
    ):
        if value and value.casefold() in ("często", "czasami"):
            facts[key] = f"{label} według rolnika: {value.lower()}."
    if (slope := inputs.get("terrain", {}).get("slope_pct")) is not None and slope >= 3:
        facts["slope"] = f"Mediana nachylenia z modelu wysokości: {slope:g}%."
    if active and "recent_deficit" in facts and not inputs.get("retention_available"):
        facts["soil_missing"] = "Brak kompletu danych o retencji na głębokość korzeni uprawy."
    if (comparison := metrics.get("satellite_comparison")) and (scene := inputs.get("satellite", {}).get("scene")):
        if (comparison["n"] >= 3 and 0 <= (day - date.fromisoformat(scene["date"])).days <= 14
                and min(comparison["ndmi_delta"], comparison["ndvi_delta"]) <= -0.10):
            facts["sat_anomaly"] = (f"Scena {scene['date']}: odchylenie NDVI {comparison['ndvi_delta']:+.2f}, "
                                    f"NDMI {comparison['ndmi_delta']:+.2f} względem {comparison['n']} scen.")
    return facts | forecast_facts(inputs.get("forecast", {}).get("rows", {}), day, metrics, active)


def matching_actions(facts, answers, day):
    """Keep field observations at field scale and attach local evidence to its declared points."""
    field = facts | {key: f"Potwierdzenie rolnika: {OBSERVATIONS[key]}." for key in answers.recommendation_observations}
    locations = [(None, field)]
    regional = {key: facts[key] for key in facts.keys() & REGIONAL_SIGNALS}
    if "legal_water" in field:
        regional["legal_water"] = field["legal_water"]
    for zone in answers.problem_zones:
        local = regional | {key: f"Potwierdzenie rolnika w tym punkcie: {OBSERVATIONS[key]}."
                            for key in zone.recommendation_observations}
        age = (day - zone.date).days
        if zone.type == "Zastoiska":
            local["point_ponding"] = f"Zastoiska zaznaczone przez rolnika ({zone.date.isoformat()})."
            if 0 <= age <= 2:
                local["point_recent_ponding"] = local["point_ponding"]
        elif zone.type == "Przesuszenie" and 0 <= age <= 6:
            local["point_recent_dry"] = f"Przesuszenie zaznaczone przez rolnika ({zone.date.isoformat()})."
        locations.append((zone, local))

    for key, (_, _, _, why) in RULES.items():
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
        yield {"id": key, "group": row["kategoria"], "title": row["dzialanie"], "action": row["dzialanie"],
               "why": why, "evidence": field_evidence or " ".join(dict.fromkeys(point["evidence"] for point in points)),
               "when": row["termin_realizacji"], "confidence": "wstępna", "limits": row["warunki_rekomendacji"],
               "cost": row["koszt"], "cost_details": row["skladniki_kosztu"],
               "scope": "field" if field_evidence else "point", "points": points, "sources": references(key)}


def recommendations(metrics, inputs, request, agricultural):
    if not agricultural:
        return []
    answers = getattr(request, "farmer_answers", FarmerAnswers())
    facts = field_facts(metrics, inputs, request, answers)
    return ordered_recommendations(facts, answers, request.day)


def ordered_recommendations(facts, answers, day):
    groups = [ACTIONS[key]["kategoria"] for key in GROUPS]
    return sorted(matching_actions(facts, answers, day), key=lambda item: (
        PRIORITY.index(item["id"]) if item["id"] in PRIORITY else len(PRIORITY),
        groups.index(item["group"]) if item["group"] in groups else len(groups), item["id"],
    ))
