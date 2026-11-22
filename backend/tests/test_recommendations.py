from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from wodo.declarations import FarmerAnswers, ProblemZone
from wodo.recommendation_catalog import (
    ACTIONS,
    OBSERVATIONS,
    REGIONAL_SIGNALS,
    RULES,
    SIGNALS,
    TRIGGERS,
    catalog,
)
from wodo.recommendations import SITE_LABELS, matching_actions, recommendations

DAY = date(2026, 7, 1)
POINT = {"geometry": {"type": "Point", "coordinates": [19, 52]}, "date": DAY, "type": "Inne"}


def test_all_catalog_actions_have_runnable_sourced_triggers():
    assert set(ACTIONS) == set(RULES) == set(range(1, 62))
    for item in catalog():
        key = item["id"]
        assert item["sources"] and item["why"]
        assert item["description"].strip() and item["area_impact"].strip()
        assert all(source["url"].startswith("https://") for source in item["sources"])
        assert item["triggers"]

        for scope, alternatives in TRIGGERS[key].items():
            for alternative in alternatives:
                keys = set(alternative)
                facts = dict.fromkeys(keys & SIGNALS.keys(), "Dane")
                observations = sorted(keys & OBSERVATIONS.keys())
                if scope == "point":
                    kind = ("Zastoiska" if {"point_ponding", "point_recent_ponding"} & keys else
                            "Przesuszenie" if "point_recent_dry" in keys else "Inne")
                    local = [value for value in observations if value != "legal_water"]
                    field = [value for value in observations if value == "legal_water"]
                    answers = FarmerAnswers(recommendation_observations=field, problem_zones=[
                        ProblemZone(**(POINT | {"type": kind}), recommendation_observations=local),
                    ])
                    facts = {name: value for name, value in facts.items() if name in REGIONAL_SIGNALS}
                else:
                    answers = FarmerAnswers(recommendation_observations=observations)
                match = next(rec for rec in matching_actions(facts, answers, DAY) if rec["id"] == key)
                expected = "site" if scope == "field" and key in SITE_LABELS else scope
                assert match["scope"] == expected and bool(match["points"]) == (scope == "point")
                assert match["area_impact"] == item["area_impact"]
                assert 3 <= len(match["steps"]) <= 4 and all(step.strip() for step in match["steps"])
                assert ACTIONS[key]["termin_realizacji"].rstrip(".") in match["steps"][1]


def test_location_uses_matching_observations_before_a_suggested_sampling_point():
    answers = FarmerAnswers(problem_zones=[ProblemZone(**POINT, recommendation_observations=["check_water"])])
    facts = {"active_crop": "Uprawa", "root_risk": "Ryzyko"}

    def measurement():
        return next(rec for rec in matching_actions(facts, answers, DAY, [20, 51]) if rec["id"] == 52)

    assert measurement()["points"][0]["coordinates"] == [19, 52]
    answers.problem_zones.clear()
    rec = measurement()
    assert rec["scope"] == "point" and rec["points"][0]["coordinates"] == [20, 51]
    assert rec["points"][0]["type"] == "Proponowane miejsce pomiaru"


def test_scouting_map_uses_the_indicator_behind_the_anomaly():
    request = SimpleNamespace(day=DAY, crop="potato", irrigation=False, soil_observation=None)
    metrics = {"crop": {"label": "Ziemniak"}, "stage": "Wzrost", "stage_id": 2, "recent": None, "root": None,
               "history": {"seasons": []}, "satellite_comparison": {"n": 3, "ndvi_delta": -.12, "ndmi_delta": -.2}}
    scene = {"date": DAY.isoformat(), "ndvi_low_point": [19, 52], "ndmi_low_point": [19.001, 52]}

    def scout():
        return next(rec for rec in recommendations(metrics, {"satellite": {"scene": scene}}, request, True)
                    if rec["id"] == 53)

    assert scout()["points"][0]["coordinates"] == scene["ndmi_low_point"]
    del scene["ndmi_low_point"]
    assert scout()["scope"] == "site" and not scout()["points"]


def test_catalog_costs_have_numeric_bounds_and_explain_the_estimate():
    for action in catalog():
        estimate = action["cost_estimate"]
        assert 0 <= estimate["lower"] <= estimate["upper"]
        assert estimate["unit"] and estimate["basis"]
        assert all(source["url"].startswith("https://") for source in estimate["sources"])


def test_saved_report_uses_catalogue_costs_and_plain_explanations(monkeypatch):
    import main

    saved = {"situation": "Stan pola", "agricultural": False, "recommendations": [
        {"id": 15, "cost": "niski", "why": "Opis techniczny", "evidence": "Zapisana obserwacja."},
    ]}
    monkeypatch.setattr(main, "read", lambda *args: saved)
    monkeypatch.setattr(main, "report_evidence", lambda _: {})
    recommendation, = main.get_report("a" * 32)["recommendations"]
    action = next(item for item in catalog() if item["id"] == 15)
    assert recommendation["cost_estimate"] == action["cost_estimate"]
    assert recommendation["why"] == action["description"]
    assert recommendation["area_impact"] == action["area_impact"]
    assert recommendation["evidence"] == "Zapisana obserwacja."


def test_new_ditch_needs_confirmed_local_site_and_accounts_for_land_take():
    flooded = POINT | {"type": "Zastoiska"}
    answers = FarmerAnswers(problem_zones=[ProblemZone(**flooded)])
    assert 61 not in {item["id"] for item in matching_actions({}, answers, DAY)}

    confirmed = FarmerAnswers(problem_zones=[ProblemZone(**flooded, recommendation_observations=["ditch_site"])])
    action = next(item for item in matching_actions({}, confirmed, DAY) if item["id"] == 61)
    assert action["scope"] == "point"
    assert "skarpami i pasem obsługi" in action["area_impact"]
    assert "łączną szerokość" in action["area_impact"]


def test_root_measurements_and_forecast_gate_irrigation():
    request = SimpleNamespace(day=DAY, crop="potato", irrigation=True, soil_observation=None,
                              farmer_answers=FarmerAnswers(recommendation_observations=["root_deficit", "legal_water"]))
    metrics = {"recent": None, "history": {"seasons": [], "negative_seasons": 0}, "crop": {"label": "Ziemniak"},
               "stage": "Pełnia wzrostu", "stage_id": 2, "kc": 1,
               "root": {"raw_mm": 30, "initially_wet": {"depletion_mm": 10}, "initially_dry": {"depletion_mm": 20}}}
    dates = [(DAY + timedelta(days=i)).isoformat() for i in (1, 2, 3)]
    rows = {day: {"rain": 0, "et0": 4, "probability": 0} for day in dates}

    def actions():
        return {rec["id"]: rec for rec in recommendations(metrics, {"forecast": {"rows": rows}}, request, True)}

    assert 21 in actions() and 22 not in actions()
    assert "ma spaść 0.0 mm deszczu" in actions()[21]["evidence"]
    assert "ETc" not in actions()[21]["evidence"]
    request.soil_observation = "wet"
    assert 21 not in actions() and 57 in actions()
    request.soil_observation = None
    rows.pop(dates[0])
    assert 21 not in actions()
    rows[dates[0]] = {"rain": 28, "et0": 4, "probability": 80}
    request.farmer_answers = FarmerAnswers(recommendation_observations=["irrigation_planned", "can_wait", "rain_infiltrates"])
    assert 22 in actions() and 21 not in actions()
    rows[dates[0]]["probability"] = 69
    assert 22 not in actions()
    rows[dates[0]]["probability"] = 80
    metrics["root"]["initially_dry"]["depletion_mm"] = 28
    assert 22 not in actions()  # The crop would exceed RAW before the expected rain.
    metrics["root"] = None
    assert 22 in actions()  # The farmer confirmed the reserve by measuring it.
    request.farmer_answers.recommendation_observations.remove("can_wait")
    assert 22 not in actions()


def test_local_observation_stays_local_and_expiry_blocks_urgent_rule():
    active = ProblemZone(**(POINT | {"type": "Zastoiska"}))
    older = ProblemZone(**(POINT | {"type": "Zastoiska", "date": DAY - timedelta(days=4)}))
    answers = FarmerAnswers(problem_zones=[active, older, ProblemZone(**(POINT | {"type": "Słaby plon"}))])
    result = {item["id"]: item for item in matching_actions({}, answers, DAY)}
    assert {8, 55, 57} == result.keys()
    assert len(result[55]["points"]) == 2 and result[55]["scope"] == "point"
    assert len(result[57]["points"]) == 1 and result[57]["points"][0]["coordinates"] == [19, 52]
    with pytest.raises(ValueError, match="Nieznana obserwacja"):
        FarmerAnswers(recommendation_observations=["sat_anomaly"])
    with pytest.raises(ValueError, match="Nieznana obserwacja"):
        ProblemZone(**POINT, recommendation_observations=["root_deficit"])


def test_catalog_endpoint_and_passport_use_same_rules(monkeypatch):
    from fastapi.testclient import TestClient

    import main

    field = {"type": "Polygon", "coordinates": [[[19, 52], [19.001, 52], [19.001, 52.001], [19, 52]]]}
    monkeypatch.setattr(main, "collect", lambda parcel, day, *args: {
        "parcel_id": parcel["id"], "analysis_as_of": str(day), "fields": [],
    })
    body = {"field_request": {"geojson": field, "date": str(DAY), "farmer_answers": {
        "recommendation_observations": ["roof_site"], "problem_zones": [{
            **POINT, "geometry": {"type": "Point", "coordinates": [19.0007, 52.0002]}, "date": str(DAY),
            "recommendation_observations": ["low_ph"],
        }],
    }}}
    with TestClient(main.app) as client:
        docs = client.get("/api/recommendations/catalog").json()["actions"]
        response = client.post("/api/passport", json=body)
        assert response.status_code == 200, response.text
        actions = {item["id"]: item for item in response.json()["farmer_report"]["steps"]}
        assert actions[18]["title"] == docs[17]["title"]
        assert actions[18]["cost_estimate"] == docs[17]["cost_estimate"]
        assert actions[18]["why"] == docs[17]["description"]
        assert actions[32]["points"][0]["coordinates"] == [19.0007, 52.0002]
        body["field_request"]["farmer_answers"]["problem_zones"][0]["geometry"]["coordinates"] = [18, 52]
        assert client.post("/api/passport", json=body).status_code == 422


def test_forecast_liquid_rain_includes_convective_showers():
    from wodo.weather import forecast_rows, liquid_rain

    stamps = ["2026-07-02T14:00", "2026-07-02T15:00", "2026-07-02T16:00"]
    values = {"time": stamps, "rain": [.2, None, 0], "showers": [12, 7, 0]}
    rain = liquid_rain(values, "rain", "showers")
    assert rain == {stamps[0]: 12.2, stamps[2]: 0}
    result = forecast_rows({"temperature": {"2026-07-02": 32}}, rain)
    assert result["2026-07-02"] == {"temperature": 32, "hourly_rain_max": 12.2}
