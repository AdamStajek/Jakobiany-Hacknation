from datetime import date, timedelta

from wodo.field_analysis import analyze_field


def test_synthetic_root_and_climate():
    day = date(2024, 7, 5)
    series = {str(day-timedelta(days=i)): 2 for i in range(30)}
    values = {"root_zone_taw_mm": 100, "root_zone_raw_mm": 40, "root_zone_depletion_mm": 30,
              "precipitation_mm": series, "et0_mm": dict.fromkeys(series, 4)}
    passport = {"parcel_id": "synthetic", "analysis_as_of": str(day), "fields": [
        {"field": k, "value": v, "unit": "mm", "status": "ok", "provenance": {
            "available_at": str(day), "uncertainty": {"depletion_range_mm": [30, 70]}}}
        for k, v in values.items()]}
    result = analyze_field(passport, day)
    assert result["soil_water_availability"]["ks_range"] == [0.5, 1]
    assert result["water_balance"]["p_minus_et0_mm"] == -60
    assert result["scenario_analysis"]["storage_gain_range_mm"] == [1, 1]
    assert not analyze_field(passport, day-timedelta(days=1))["prioritized_action_plan"]
    series.pop(str(day))
    assert "rain_mm" not in analyze_field(passport, day)["water_balance"]


def test_complete_calendar_months():
    from wodo.field_analysis import monthly_balance

    rain = {f"2024-02-{d:02}": 0 for d in range(1, 30)}
    et = dict.fromkeys(rain, 2)
    assert monthly_balance(rain, et, date(2024, 2, 29)) == {"2024-02": -58}
    assert monthly_balance(rain, et, date(2024, 2, 28)) == {}


def test_real_passport_through_api():
    import json
    from pathlib import Path

    from fastapi.testclient import TestClient

    from main import app

    docs = Path(__file__).resolve().parents[2] / "docs"
    passport = json.loads((docs / "field-passport-koscian.json").read_text())
    with TestClient(app) as client:
        response = client.post("/api/analysis/passport", params={"as_of": passport["analysis_as_of"]}, json=passport)
        printed = client.post("/api/analysis/passport", params={"as_of": passport["analysis_as_of"], "format": "pdf"}, json=passport)
    assert printed.status_code == 200 and printed.content.startswith(b"%PDF")
    assert response.status_code == 200
    assert response.json() == json.loads((docs / "field-analysis-koscian.json").read_text())


def test_farmer_summary_distinguishes_confirmed_and_uncertain_shortage():
    from wodo.farmer_report import report_message, root_message

    assert "dość wody" in root_message(20, 40, 40)
    assert "zależy" in root_message(20, 50, 40)
    assert "tak sucho" in root_message(45, 50, 40)
    assert "Odłóż podlewanie" in report_message({"agricultural": True, "soil_observation": "wet", "metrics": {}})


def test_seasonal_advice_counts_years_once():
    from wodo.farmer_report import seasonal_timing

    when, reason = seasonal_timing({"episodes": [
        {"start": "2021-07-20"}, {"start": "2021-06-12"}, {"start": "2022-06-10"}, {"start": "2023-07-12"}]})
    assert "czerwcu" in when and "2 z 3" in reason
    assert seasonal_timing({"episodes": None})[0] == "W następnym sezonie"
