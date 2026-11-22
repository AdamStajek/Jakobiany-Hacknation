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
    assert updated["evidence"]["headline"] == "Próba terenowa wykazała wilgoć przy korzeniach"
    assert any(check["slug"] == "struktura-gleby" for check in updated["experiments"])
    assert main.analysis_result(updated["analysis_id"]) == updated
    assert "experiment_results" not in main.analysis_result(analysis_id)

    cleared = main.save_experiments(updated["analysis_id"], {})
    assert cleared["evidence"] == main.analysis_result(analysis_id)["evidence"]


def test_new_analysis_keeps_completed_checks_even_when_model_would_not_suggest_them(monkeypatch):
    parcel = {"id": "301103_2.0009.549/7"}
    result = {"date": "2024-07-01", "agricultural": True, "missing": {}, "sources": [],
              "metrics": {"stage_id": 2, "weather_last_day": None, "risk": "Niskie w modelu",
                          "root": {"days": 30, "raw_mm": 30, "initially_wet": {"depletion_mm": 0},
                                   "initially_dry": {"depletion_mm": 0}},
                          "recent": {"crop_balance_mm": 12, "days": 30, "samples": 30}}}
    monkeypatch.setattr(main, "lookup", lambda _: [parcel])
    monkeypatch.setattr(main, "matches", lambda parcels: {"parcels": parcels})
    monkeypatch.setattr(main, "run", lambda *_: result.copy())
    monkeypatch.setattr(main, "write", lambda *_: None)

    results = {"wilgotnosc-gleby": "moist", "deszczomierz": "more"}
    request = main.AnalysisRequest(parcel_id=parcel["id"], date=result["date"], experiment_results=results)
    report = main.execute_analysis(request)

    assert report["experiment_results"] == results
    assert set(report["experiment_conclusions"]) == set(results)
    assert {check["slug"] for check in report["experiments"]} == set(results)
    assert report["evidence"]["headline"] == "Próba terenowa wykazała wilgoć przy korzeniach"
    assert report["metrics"] == result["metrics"]
