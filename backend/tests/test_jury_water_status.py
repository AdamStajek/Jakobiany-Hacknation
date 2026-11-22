from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.mark.parametrize("rain, depletion, balance, ks", [
    pytest.param(0, [70, 100], -120, [0, 0.5], id="susza"),
    pytest.param(6, [0, 20], 60, [1, 1], id="nadwyzka"),
    pytest.param(0, [10, 40], -120, [1, 1], id="deficyt-pogodowy-z-zapasem"),
])
def test_jury_controlled_passport(rain, depletion, balance, ks):
    day = date(2024, 2, 29)
    days = [str(day - timedelta(days=i)) for i in range(30)]
    values = {
        "root_zone_taw_mm": 100, "root_zone_raw_mm": 40,
        "root_zone_depletion_mm": depletion[0],
        "precipitation_mm": dict.fromkeys(days, rain), "et0_mm": dict.fromkeys(days, 4),
    }
    rows = [{"field": key, "value": value, "unit": "mm", "status": "ok",
             "provenance": {"available_at": str(day)}} for key, value in values.items()]
    next(row for row in rows if row["field"] == "root_zone_depletion_mm")["provenance"]["uncertainty"] = {
        "depletion_range_mm": depletion}
    with TestClient(app) as client:
        response = client.post("/api/analysis/passport", params={"as_of": str(day)},
                               json={"parcel_id": "synthetic", "analysis_as_of": str(day), "fields": rows})
    assert response.status_code == 200
    report = response.json()
    assert report["water_balance"]["p_minus_et0_mm"] == balance
    assert report["soil_water_availability"]["ks_range"] == ks
