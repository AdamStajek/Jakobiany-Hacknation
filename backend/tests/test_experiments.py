import pytest
from fastapi import HTTPException

import main


def test_report_suggests_experiments_and_saves_field_diagnosis(monkeypatch):
    analysis_id = "a" * 32
    original = {
        "analysis_id": analysis_id,
        "date": "2024-07-01", "missing": {},
        "agricultural": True,
        "metrics": {"stage_id": 2, "weather_last_day": "2024-07-01", "root": None,
                    "recent": {"crop_balance_mm": -12, "end": "2024-07-01", "days": 30, "samples": 30}},
        "sources": [{"key": "terrain", "slope_pct": 4}],
    }
    cache = {f"report:{analysis_id}": original}
    monkeypatch.setattr(main, "read", lambda key, ttl: cache[key].copy())
    monkeypatch.setattr(main, "write", lambda key, value: cache.update({key: value}))

    assert {check["slug"] for check in main.analysis_result(analysis_id)["experiments"]} == {
        "wilgotnosc-gleby", "wsiakanie-wody", "deszczomierz",
    }
    for invalid in ({"struktura-gleby": "poor"}, {"wsiakanie-wody": "invalid"}):
        with pytest.raises(HTTPException) as error:
            main.save_experiments(analysis_id, invalid)
        assert error.value.status_code == 422

    updated = main.save_experiments(analysis_id, {"wsiakanie-wody": "slower", "wilgotnosc-gleby": "moist"})
    assert updated["analysis_id"] != analysis_id
    assert "osłabia podejrzenie niedoboru" in updated["experiment_conclusions"]["wilgotnosc-gleby"]
    assert any(check["slug"] == "struktura-gleby" for check in updated["experiments"])
    assert main.analysis_result(updated["analysis_id"]) == updated
    assert "experiment_results" not in main.analysis_result(analysis_id)
