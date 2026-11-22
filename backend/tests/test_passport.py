from datetime import date

import numpy as np
import pytest
from fastapi import HTTPException

from main import health
from main import passport as passport_route
from wodo import passport
from wodo.passport_sources import historical
from wodo.spatial import passport_stats
from wodo.store import SourceError


def test_passport_fetches_on_request_and_reports_partial_results(monkeypatch):
    parcel_id = "301103_2.0009.549/7"
    calls = []

    def lookup(query):
        calls.append(query)
        return [{"id": query}]

    def worker(parcel, start, end):
        assert parcel["id"] == parcel_id
        assert (end - start).days == 364
        return {"parcel_area_ha": 1.25}, {"epsg": 2180}

    def unavailable(*_args):
        raise SourceError("Awaria dostawcy")

    monkeypatch.setattr("main.lookup", lookup)
    monkeypatch.setattr(passport, "WORKERS", {
        "GUGiK EGiB": worker, "Sentinel-2 L2A / Earth Search": unavailable,
    })
    assert health()["status"] == "ok"
    with pytest.raises(HTTPException) as failure:
        passport_route("invalid")
    assert failure.value.status_code == 422
    assert not calls
    data = passport_route(parcel_id, date(2024, 7, 5))
    assert calls == [parcel_id]
    assert data["parcel_id"] == parcel_id
    assert len(data["fields"]) == sum(map(len, passport.load_catalog().values()))
    fields = {row["field"]: row for row in data["fields"]}
    assert fields["parcel_area_ha"]["status"] == "ok"
    assert fields["parcel_area_ha"]["value"] == 1.25
    assert fields["parcel_area_ha"]["provenance"]["epsg"] == 2180
    assert fields["ndvi_mean"]["status"] == "error"
    assert fields["ndvi_mean"]["detail"] == "Awaria dostawcy"
    assert fields["crop_type_declared"]["status"] == "unsupported"


def test_sentinel_passport_uses_mean_and_excludes_clouds():
    red = np.array([[1., 1., 1., 1.]])
    nir = np.array([[1., 1., 3., 9.]])
    scl = np.array([[4, 4, 4, 9]])
    values = passport_stats([red, nir, red, red, scl], np.ones((1, 4), dtype=bool))
    assert values["ndvi_mean"] == 1 / 6
    assert values["clear_pixel_pct"] == 75
    assert values["valid_pixel_count"] == 3


def test_historical_water_balance_requires_complete_window(monkeypatch):
    days = [date(2024, 1, day).isoformat() for day in range(1, 31)]

    def meteo(parcel, url, daily, hourly, params, ttl):
        return {
            "daily": {"time": days, **{key: [1.] * len(days) for key in daily},
                      "precipitation_sum": [2.] * len(days)},
            "hourly": {"time": [], **{key: [] for key in hourly}},
        }, {}

    monkeypatch.setattr("wodo.passport_sources.meteo", meteo)
    values, _ = historical({}, date(2024, 1, 1), date(2024, 1, 30))
    assert values["climatic_water_balance_30d_mm"] == 30.
    assert "climatic_water_balance_60d_mm" not in values


def test_crop_balance_and_texture():
    from wodo.passport_sources import texture
    from wodo.spatial import WCS_DEPTHS

    results = {"ISRIC SoilGrids / funkcje pedotransferowe": (
        {"field_capacity": dict.fromkeys(WCS_DEPTHS, .3), "wilting_point": dict.fromkeys(WCS_DEPTHS, .1)}, {}, None)}
    values, _, _ = passport.water_balance(results, date(2024, 7, 5), "potato", None, None, 0)
    assert values == {"root_zone_taw_mm": 100, "root_zone_raw_mm": 35}
    assert texture(40, 40, 20) == "loam"
    assert texture(1, 1, 1) is None


def test_fao_fallback_requires_ten_complete_seasons():
    from wodo.science import CROPS, dates
    from wodo.spatial import WCS_DEPTHS

    crop = CROPS["potato"]
    data = {"ISRIC SoilGrids / funkcje pedotransferowe": (
        {"field_capacity": dict.fromkeys(WCS_DEPTHS, .3), "wilting_point": dict.fromkeys(WCS_DEPTHS, .1)}, {}, None)}
    end = date(2024, 7, 5)
    history = {"name": "fixture", "url": "fixture", "rows": {
        day.isoformat(): [0., 4., 20.] for day in dates(date(2014, 1, 1), end)}}
    values, meta, _ = passport.water_balance(data, end, "potato", None, 2, 0, history)
    assert values["crop_et_mm"] == crop.kc[1] * 4
    assert values["historical_drought_frequency_pct"] == 100
    assert meta["uncertainty"]["depletion_range_mm"][0] == values["root_zone_depletion_mm"]
    del history["rows"]["2014-06-01"]
    values, _, _ = passport.water_balance(data, end, "potato", None, 2, 0, history)
    assert "historical_drought_frequency_pct" not in values


def test_farmer_questions_cover_csv():
    from main import passport_questions

    questions = passport_questions()
    assert len({item["field"] for item in questions}) == len(questions) == 15
    assert all(item["question"] and item["format"] for item in questions)
    assert {item["field"] for item in questions if item["sql_type"] == "jsonb"} == {"irrigation_events"}


def test_passport_from_geojson_uses_imported_boundary(monkeypatch):
    from main import passport_from_geojson
    from wodo.passport_sources import ADMIN, egib

    geometry = {"type": "Polygon", "coordinates": [
        [[16.65, 52.08], [16.66, 52.08], [16.66, 52.09], [16.65, 52.09], [16.65, 52.08]],
    ]}
    monkeypatch.setattr("main.lookup", lambda *_: pytest.fail("Imported parcels must skip the EGiB lookup"))
    monkeypatch.setattr(passport, "WORKERS", {
        "GUGiK EGiB": egib,
        ADMIN: lambda *_: pytest.fail("Imported parcels have no cadastral identifier"),
    })
    monkeypatch.setattr(passport, "soil_history", lambda *_: ({}, {}))
    monkeypatch.setattr(passport, "basin_flow", lambda *_: ({}, {}))
    result = passport_from_geojson({"type": "Feature", "geometry": geometry, "properties": {}}, date(2024, 7, 5))
    fields = {entry["field"]: entry for entry in result["fields"]}
    assert result["parcel_id"] == "Działka z GeoJSON"
    assert fields["parcel_area_ha"]["value"] > 0
    assert fields["parcel_area_ha"]["source"] == "Import użytkownika"
    assert fields["parcel_number"]["value"] is None
    with pytest.raises(ValueError):
        passport_from_geojson({"type": "Point", "coordinates": [16.65, 52.08]})


def test_geojson_identity_and_weather_fallback():
    import json
    from pathlib import Path

    from wodo.geo import imported
    from wodo.passport_sources import ERA, egib

    fixture = Path(__file__).resolve().parents[2] / "docs/dzialka-koscian.geojson"
    parcel = imported(json.loads(fixture.read_text()))
    end = date(2024, 7, 5)
    values, metadata = egib(parcel, end, end)
    assert values["parcel_id"] == "301103_2.0009.549/7"
    assert metadata["identity_verified"] is False
    results = {ERA: ({"temp_mean_c": {"2024-07-05": 22}}, {}, "upstream error")}
    history = {"name": "NASA POWER", "url": "https://power.larc.nasa.gov",
               "rows": {"2024-07-05": [2, 4, 25], "2024-07-06": [9, 4, 25]}}
    passport.add_nasa_fallback(results, history, end, end)
    values, meta, _ = results[ERA]
    assert values["precipitation_mm"] == {"2024-07-05": 2}
    assert values["temp_mean_c"] == {"2024-07-05": 22}
    assert meta["field_sources"]["precipitation_mm"]["source_id"] == "NASA POWER"


def test_collect_reports_progress_per_source(monkeypatch):
    monkeypatch.setattr(passport, "WORKERS", {
        "GUGiK EGiB": lambda parcel, start, end: ({"parcel_area_ha": 1.0}, {}),
        "Sentinel-2 L2A / Earth Search": lambda parcel, start, end: ({}, {}),
    })
    monkeypatch.setattr(passport, "soil_history", lambda *args: ({}, {}))
    monkeypatch.setattr(passport, "basin_flow", lambda *args: ({}, {}))
    monkeypatch.setattr(passport, "nasa", lambda *args: None)
    events = []
    passport.collect({"id": "p"}, date(2024, 7, 5), on_progress=lambda *args: events.append(args))
    labels = {e[2] for e in events}
    assert {"Ewidencja działek", "Sentinel-2"} <= labels
    assert [e[0] for e in events] == list(range(1, len(events) + 1))
    assert all(e[1] == len(events) for e in events)
