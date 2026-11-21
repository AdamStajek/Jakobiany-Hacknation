"""Offline interpretation of a dated field passport."""
from calendar import monthrange
from datetime import date, timedelta
from math import isfinite

from wodo.farmer_report import root_message, seasonal_timing
from wodo.science import CROPS, phenology

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


def analyze_field(field_passport: dict, analysis_date: date) -> dict:
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
    actions = []
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
        if bounds[1] > raw:
            actions.append({"evidence": "root", "when": "Przed podlewaniem",
                            "action": "W kilku miejscach odgarnij ziemię aż do żywych korzeni. Jeśli jest tam wilgotna, odłóż podlewanie. Jeśli jest sucha, sprawdź zapowiadany deszcz.",
                            "why": message,
                            "both_scenarios_exceed_raw": dr > raw})
    volume = value("potential_depression_volume_m3", "m³")
    area = value("parcel_area_ha", "ha")
    retention = {"status": "brak objętości zagłębień lub powierzchni"}
    if number(volume) and number(area) and area > 0:
        retention = {"status": "model NMT", "geometric_capacity_m3": volume,
                     "equivalent_field_depth_mm": volume / (10 * area)}
        if volume:
            actions.append({"evidence": "storage", "when": "Po większym deszczu",
                            "action": "Obejdź obniżenia pola. Zaznacz, gdzie stoi woda i którędy odpływa. Przed zmianą odpływu sprawdź z doradcą, czy woda nie zaleje upraw lub sąsiada.",
                            "why": "Mapa wysokości pokazuje zagłębienia, w których może zbierać się deszcz."})
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
    if number(history) and 0 < history <= 100:
        when, reason = seasonal_timing(historical_scenario)
        actions.append({"evidence": "historical_drought_frequency_pct", "when": when,
                           "action": "W kilku miejscach pola wykop mały dołek obok rośliny. Sprawdź dłonią, czy ziemia przy żywych korzeniach jest jeszcze wilgotna.",
                           "why": reason,
                           "condition": "Obliczenia zakładają tę samą uprawę w każdym sezonie, bez podlewania."})
        cover_crop_choice = balance.get("status") == "ok" and balance["p_minus_et0_mm"] < 0
        arable_crop = isinstance(context.get("crop"), str) and context["crop"] in CROPS and context["crop"] not in ("grass", "unknown")
        if arable_crop and not cover_crop_choice:
            actions.append({"evidence": "historical_drought_frequency_pct",
                            "when": "Po zbiorze, jeśli masz zdrowe resztki pożniwne",
                            "action": "Na próbę zostaw pas gleby przykryty rozdrobnionymi resztkami. Obok zostaw pas uprawiony jak zwykle. Po kilku suchych dniach porównaj wilgotność na tej samej głębokości.",
                            "why": "W poprzednich sezonach uprawie mogło brakować wody. Osłona może ograniczyć wysychanie ziemi.",
                            "condition": "Wybierz miejsce, gdzie resztki nie utrudnią kolejnego siewu lub sadzenia."})
        if arable_crop and cover_crop_choice:
            actions.append({"evidence": ["climate", "historical_drought_frequency_pct"], "when": "Przed siewem międzyplonu",
                           "action": "Jeśli ziemia przy korzeniach jest sucha, rozważ zostawienie resztek po zbiorze jako osłony gleby.",
                           "why": "Ostatnie deszcze były skąpe w stosunku do parowania. Żywy międzyplon też zużywa wodę.",
                           "condition": "Sprawdź ilość resztek, wymagania następnej uprawy i możliwość siewu."})
    if root["status"] == "model" and not actions:
        next_check = "Przy kolejnej kontroli pola sprawdź, czy ziemia przy korzeniach nadal jest wilgotna."
    elif root["status"] != "model":
        next_check = "Jeśli uprawa nadal rośnie i rozważasz podlewanie, najpierw sprawdź ziemię przy korzeniach w kilku miejscach pola."
    else:
        next_check = None
    crop = context.get("crop")
    stage = context.get("stage")
    if (root["status"] != "model" and isinstance(crop, str) and crop in CROPS
            and (stage is None or type(stage) is int and 0 <= stage <= 4)
            and phenology(CROPS[crop], analysis_date, stamp(context.get("sowing")), stage)[0] == 4):
        message = "Wybrana data wypada poza okresem wzrostu tej uprawy według typowego kalendarza. Brakuje danych o wilgotności przy korzeniach."
        next_check = "Jeśli rośliny nadal rosną, wpisz ich obecną fazę rozwoju i ponów ocenę. Po zbiorze możesz od razu zaplanować prace na następny sezon."
    return {"farmer_report": {"situation": message, "next_check": next_check, "steps": actions},
            "schema_version": "1.0", "field_id": field_passport["parcel_id"], "analysis_date": str(analysis_date),
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
