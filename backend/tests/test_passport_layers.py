import csv
import io
from datetime import date

import numpy as np
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from shapely.geometry import box

from wodo.passport_hydrology import hydro
from wodo.passport_layers import anomalies, summarize_soil


def test_pit_and_flow_rasters():
    import base64

    dem = np.full((5, 5), 10.)
    dem[2, 2] = 8
    inside = np.ones((5, 5), dtype=bool)
    result = hydro(dem, from_origin(0, 5, 1, 1), inside, box(0, 0, 5, 5), basin=True)
    assert result["potential_depression_area_m2"] == 1
    assert result["potential_depression_volume_m3"] == 2
    for name in ("flow_direction_raster_uri", "flow_accumulation_raster_uri"):
        with MemoryFile(base64.b64decode(result[name].split(",")[1])) as file, file.open() as src:
            assert src.crs.to_epsg() == 2180
            assert src.shape == dem.shape
            if name == "flow_accumulation_raster_uri":
                assert src.read(1).max() > 1


def test_swvl4_grid_complete_days_and_reference():
    file = io.StringIO()
    writer = csv.writer(file)
    writer.writerow(["valid_time", "latitude", "longitude", "swvl4"])
    for year in range(2013, 2025):
        for hour in range(23 if year == 2013 else 24):
            writer.writerow([f"{year}-07-01T{hour:02}:00", 52, 19, .2 if year < 2024 else .3])
    file.seek(0)
    result = summarize_soil(file, 52, 19, date(2024, 1, 1), date(2024, 7, 1))
    assert result["years"] == 10
    assert result["values"] == {"soil_moisture_100_289_cm": {"2024-07-01": .3}, "soil_moisture_percentile": 100}


def test_anomalies_require_matching_reference(tmp_path, monkeypatch):
    monkeypatch.setenv("WODO_PASSPORT_LAYERS", str(tmp_path))
    (tmp_path / "sentinel_reference.csv").write_text(
        "parcel_id,observed_at,crop,stage,ndvi_mean,ndmi_mean,clear_pixel_pct\n"
        + "".join(f"field,{year}-07-01,potato,2,0.5,0.25,80\n" for year in (2020, 2021, 2022))
        + "field,2023-07-01,maize,2,1,1,95\n")
    values = anomalies({"id": "field"}, date(2024, 7, 1), "potato", None, 2,
                       {"ndvi_mean": .75, "ndmi_mean": .125}, {"observed_at": "2024-07-01"})
    assert values == {"ndvi_anomaly": .25, "ndmi_anomaly": -.125}


def test_bdot_measures_distance_to_parcel_boundary(tmp_path, monkeypatch):
    import sqlite3

    from shapely import transform
    from shapely.geometry import LineString, mapping

    from wodo.geo import TO_GPS
    from wodo.passport_layers import bdot_distances

    monkeypatch.setenv("WODO_PASSPORT_LAYERS", str(tmp_path))
    with sqlite3.connect(tmp_path / "bdot10k.gpkg") as db:
        db.executescript("""
            CREATE TABLE gpkg_geometry_columns(table_name, column_name, srs_id);
            INSERT INTO gpkg_geometry_columns VALUES('OT_SWRS_L','geom',2180);
            CREATE TABLE OT_SWRS_L(geom BLOB);
            CREATE VIRTUAL TABLE rtree_OT_SWRS_L_geom USING rtree(id,minx,maxx,miny,maxy);
            INSERT INTO rtree_OT_SWRS_L_geom VALUES(1,500120,500120,500000,500100);
        """)
        line = LineString([(500120,500000),(500120,500100)])
        db.execute("INSERT INTO OT_SWRS_L VALUES (?)", (b"GP\x00\x01" + (2180).to_bytes(4, "little") + line.wkb,))
    parcel = transform(box(500000,500000,500100,500100), TO_GPS, interleaved=False)
    values, _ = bdot_distances({"geometry": mapping(parcel)}, None, None)
    assert abs(values["nearest_stream_distance_m"] - 20) < .01
    assert "nearest_pond_distance_m" not in values


def test_cds_complete_days_per_layer():
    file = io.StringIO("valid_time,latitude,longitude,swvl1,swvl2,swvl3,swvl4\n" + "".join(
        f"2024-07-01T{h:02}:00,52,19,0,{'.2' if h else ''},.3,.4\n" for h in range(24)))
    day = date(2024, 7, 1)
    result = summarize_soil(file, 52, 19, day, day)["values"]
    assert result == {f"soil_moisture_{depth}_cm": {str(day): value}
                      for depth, value in (("0_7", 0), ("28_100", .3), ("100_289", .4))}
