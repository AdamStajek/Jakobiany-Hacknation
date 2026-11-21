from datetime import date

import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient
from shapely import Point, to_wkb

from main import AnalysisRequest, app, today
from wodo import store
from wodo.analysis import recommendations
from wodo.geo import TO_GPS, TO_PL, parse_reply, validate_geometry
from wodo.science import (
    CROPS,
    assess,
    bucket,
    dates,
    et0_fao56,
    phenology,
    retention,
    years_ago,
)
from wodo.spatial import indices
from wodo.store import NASA, SourceError, cached, fetch, read


def geometry(points=None):
    xy = points or ((500000, 500000), (500100, 500000), (500100, 500100), (500000, 500100), (500000, 500000))
    return {"type": "Polygon", "coordinates": [[TO_GPS(x, y) for x, y in xy]]}


def test_geometry_and_axis_order():
    geom = geometry()
    assert validate_geometry(geom)["area_ha"] == pytest.approx(1, abs=.00005)
    assert TO_PL(*TO_GPS(500000, 500000)) == pytest.approx((500000, 500000), abs=.001)
    assert TO_PL(19, 52)[0] == pytest.approx(500000, abs=.001)
    with pytest.raises(ValueError):
        validate_geometry({"type": "Point", "coordinates": [19, 52]})
    with pytest.raises(ValueError):
        validate_geometry(geometry(((500000, 500000), (500100, 500100), (500100, 500000),
                                    (500000, 500100), (500000, 500000))))


def test_uldk_formats_and_missing():
    raw = b"0\n141201_1.0001.6509|SRID=2180;POLYGON((500000 500000,500100 500000,500100 500100,500000 500100,500000 500000))|gmina|obreb"
    assert parse_reply(raw)[0]["area_ha"] == 1
    wkb = to_wkb(Point(19, 52).buffer(.001), hex=True)
    assert parse_reply(f"1\n121001_1.0001.4|{wkb}".encode())[0]["area_ha"] > 2
    assert parse_reply("-1 brak wyników".encode()) == []
    with pytest.raises(SourceError):
        parse_reply(b"0\nnot-valid|SRID=4326;broken")


def test_fao56_daily_example():
    # FAO-56 ch. 4, example 18, Uccle. Published actual vapour pressure ~1.408 kPa.
    assert et0_fao56(date(2001, 7, 6), 50.8, 100, 16.9, 12.3, 21.5, 12.10, 2.078, 22.07) == pytest.approx(3.9, abs=.15)


def test_crop_and_root_water_mass_balance():
    assert phenology(CROPS["potato"], date(2024, 7, 5))[1] == 1.15
    assert phenology(CROPS["potato"], date(2024, 11, 5))[0] == 4
    # Example 36 FAO-56 onion on loamy sand, θFC = .15, θWP = .06, roots .4 m.
    taw = retention([[150, 60]] * 5, .4)
    assert taw == pytest.approx(36)
    assert taw * .3 == pytest.approx(10.8)
    assert retention([None, *([[150, 60]] * 4)], .4) is None
    balanced = bucket(25, 60, .5, [(40, 3, 0), (0, 2, 5)])
    assert balanced["storage_mm"] == 58
    assert balanced["drainage_mm"] == 7
    assert 25 + 40 + 5 == balanced["storage_mm"] + balanced["drainage_mm"] + balanced["eta_mm"]
    assert 1 * 10_000 / 1000 == 10  # 1 mm on one ha = 10 m³.


def test_historical_cutoff_and_rules():
    selected = date(2024, 7, 5)
    rows = {d.isoformat(): [.5, 4, 19] for d in dates(date(2014, 1, 1), selected)}
    soil = {"layers": [[150, 60]] * 5}
    flat = assess(rows, soil, "potato", selected)
    wet_future = {**rows, "2024-07-06": [130, 0, 20]}
    assert assess(wet_future, soil, "potato", selected) == flat
    assert flat["risk"] == "Podwyższone"
    assert flat["recent"]["dry_spell_days"] == 30
    assert flat["history"]["matched_years"] == 10
    assert all(s["end"] <= selected.isoformat() for s in flat["history"]["seasons"])
    assert flat["recent"]["crop_balance_mm"] != assess(rows, soil, "maize", selected)["recent"]["crop_balance_mm"]
    context = {"soil": soil, "terrain": {"slope_pct": 4}, "land": {"nearest_water_m": 250}}
    titles = [r["title"] for r in recommendations(flat, context, True, True)]
    assert "Spowolnij odpływ ze stoku" in titles and "Zweryfikuj potrzebę nawodnienia" in titles
    assert recommendations(flat, context, True, False) == []
    empty = assess({}, None, "potato", selected)
    assert empty["risk"] == "Brak podstaw do oceny" and empty["root"] is None
    assert recommendations(empty, {}, False, True) == []


def test_cloud_mask():
    unit = np.ones((3, 3))
    clouds = unit * 9
    assert indices([unit, 3 * unit, unit, 2 * unit, clouds], unit > 0) is None
    output = indices([unit, 3 * unit, unit, 2 * unit, unit * 4], unit > 0)
    assert output["ndvi"] == .5
    assert output["ndmi"] == .2
    assert output["ndwi"] == -.5


def test_ssrf_cache_and_upstream_rate_limit(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "ROOT", tmp_path)
    assert cached("u", [1], 1, lambda: {"x": 1})["cached"] is False
    assert cached("u", [1], 1, lambda: {"x": 2})["x"] == 1
    with store.connect() as db:
        db.execute("update entries set value = ?", (b"{}",))
    assert cached("u", [1], 1, lambda: {"x": 2})["x"] == 2
    assert read("no-key", 1) is None
    with pytest.raises(SourceError, match="Niedozwolony"):
        fetch("http://loopback.test")
    attempts = []

    def handler(req):
        attempts.append(req.url)
        return httpx.Response(429)

    monkeypatch.setattr(store, "CLIENT", httpx.Client(transport=httpx.MockTransport(handler)))
    monkeypatch.setattr(store.time, "sleep", lambda _x: None)
    with pytest.raises(SourceError, match="429"):
        fetch(NASA)
    assert len(attempts) == 2


def test_endpoint_validation():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"
        assert client.get("/api/parcels/invalid!!!").status_code == 422
        assert client.get("/api/parcels/by-point?lon=4&lat=52").status_code == 422
        assert client.post("/api/parcels/import", json={"type": "Point"}).status_code == 422
        assert client.post("/api/analysis", json={"parcel_id": "12345", "date": "2000-01-01"}).status_code == 422
        assert AnalysisRequest(parcel_id="141201_1.0001.6509", day=years_ago(today(), 10)).day == years_ago(today(), 10)
        assert client.get("/api/analysis/invalid/report").status_code == 404
        assert client.post("/api/parcels/import", headers={"Content-Length": "900000"}, content=b"{}").status_code == 413


def test_hargreaves_published_example():
    from wodo.science import et0_hargreaves

    # FAO-56 ch. 4, Lyon July, equation 52 comparison.
    assert et0_hargreaves(date(2001, 7, 15), 45.72, 20.7, 14.8, 26.6) == pytest.approx(5.0, abs=.12)


def test_azure_asset_radiometry_and_access_validation():
    from wodo.spatial import azure_scene, subset

    scene = {"properties": {"s2:processing_baseline": "05.10"},
             "assets": {"B04": {"href": "https://example.test/data.tif"}}}
    assert azure_scene(scene)["assets"]["red"]["raster:bands"][0]["offset"] == -.1
    with pytest.raises(SourceError, match="nie należy"):
        subset("https://sentinel2l2a01.blob.core.windows.net/unknown/data.tif", None, (1, 1))


def test_partial_sources_and_small_parcel(monkeypatch):
    from types import SimpleNamespace

    from wodo import analysis, spatial

    day = date(2024, 7, 1)
    parcel = {**validate_geometry(geometry()), "id": "geometry test", "source": "test", "retrieved_at": None}
    rows = {d.isoformat(): [1, 4, 20] for d in dates(date(2014, 1, 1), day)}

    def down(*args):
        raise SourceError("Awaria testowa")

    def available(*args):
        return {"rows": rows, "publication_date": None}

    for name in ("satellite_history", "soil", "station", "terrain", "worldcover"):
        monkeypatch.setattr(analysis, name, down)
    monkeypatch.setattr(analysis, "history", available)
    report = analysis.run(parcel, SimpleNamespace(day=day, crop="maize", sowing=None, stage=None, irrigation_mm=0,
                          confirm_land=False, irrigation=True, scenario_mm=0, soil_observation=None))
    assert report["metrics"]["root"] is None
    assert report["confidence"] == "Ograniczona"
    assert report["missing"]["Retencja glebowa"] == "Awaria testowa"
    tiny = geometry(((500000,500000),(500003,500000),(500003,500003),(500000,500003),(500000,500000)))
    with pytest.raises(SourceError, match="zbyt mała"):
        spatial.satellite(tiny, day)
