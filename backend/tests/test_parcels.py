import json
import re
import threading
import time
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import duckdb
import pytest
from fastapi.testclient import TestClient
from pyproj import Transformer
from shapely import Polygon, to_wkb

from main import app
from wodo import geo, parcels_data, parcels_index
from wodo.parcels_data import DataNotReadyError, DownloadError
from wodo.store import SourceError

# EPSG:2180 near Poznan. The FILE stores (easting, northing): the first ordinate x is east.
N0, E0 = 505000.0, 360000.0
SIZE_N, SIZE_E = 40.0, 30.0  # 40 m along northing, 30 m along easting
TO_GPS_REF = Transformer.from_crs(2180, 4326, always_xy=True)  # (easting, northing) -> (lon, lat)
LUBLIN_N, LUBLIN_E = 390000.0, 770000.0

COLUMNS_DDL = ("id_dzialki VARCHAR, numer_dzialki VARCHAR, numer_obrebu VARCHAR, nazwa_obrebu VARCHAR, "
               "numer_jednostki VARCHAR, nazwa_gminy VARCHAR, pole_ewidencyjne DOUBLE, geometry BLOB, "
               "geometry_bbox STRUCT(xmin FLOAT, ymin FLOAT, xmax FLOAT, ymax FLOAT)")

# id, number, obreb no, obreb name, unit, commune, northing, easting
CORE = [
    ("301103_2.0001.121", "121", "0001", "Winogrady", "301103_2", "Poznań", N0, E0),
    ("301103_2.0001.122", "122", "0001", "Winogrady", "301103_2", "Poznań", N0, E0 + 100),
    ("301103_2.0009.549/7", "549/7", "0009", "Jeżyce", "301103_2", "Poznań", N0 + 100, E0),
    ("301103_2.0001.AR_1.5", "5", "0001", "Winogrady", "301103_2", "Poznań", N0 + 100, E0 + 100),
    ("066301_1.0003.121", "121", "0003", "Czechów", "066301_1", "Lublin", LUBLIN_N, LUBLIN_E),
]
MANY = [(f"301103_2.{i:04d}.99", "99", f"{i:04d}", f"Masa{i:02d}", "301103_2", "Poznań",
         N0 + 1000, E0 + 100 * i) for i in range(1, 71)]


def square(n, e):
    return Polygon([(e, n), (e, n + SIZE_N), (e + SIZE_E, n + SIZE_N), (e + SIZE_E, n), (e, n)])


def write_parquet(path, rows):
    con = duckdb.connect()
    con.execute(f"CREATE TABLE t ({COLUMNS_DDL})")
    data = [(i, nr, ro, rn, unit, commune, SIZE_N * SIZE_E, to_wkb(square(n, e)), {'xmin': e, 'ymin': n, 'xmax': e + SIZE_E, 'ymax': n + SIZE_N})
            for i, nr, ro, rn, unit, commune, n, e in rows]
    con.executemany("INSERT INTO t VALUES (?,?,?,?,?,?,?,?,?)", data)
    con.execute(f"COPY t TO '{path}' (FORMAT parquet)")
    con.close()
    return path


def make_release(base, parquet, name, etag="v1"):
    release = base / "releases" / name
    release.mkdir(parents=True)
    info = parcels_index.build(parquet, release / "parcels.duckdb", parcels_data.EXPECTED_COLUMNS,
                               lambda _m: None)
    (release / "meta.json").write_text(json.dumps({
        **info, "source": parcels_data.SOURCE_NAME, "source_url": "https://example.test/p.parquet", "etag": etag,
        "last_modified": None, "downloaded_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "release": name}))
    return release


def expected_lonlat(n, e):
    return TO_GPS_REF.transform(e + SIZE_E / 2, n + SIZE_N / 2)


@pytest.fixture
def base(tmp_path, monkeypatch):
    monkeypatch.setenv("WODO_PARCELS_DIR", str(tmp_path / "parcels"))
    monkeypatch.delenv("WODO_PARCEL_SOURCE", raising=False)
    monkeypatch.delenv("WODO_PARCELS_URL", raising=False)
    return tmp_path / "parcels"


@pytest.fixture(scope="module")
def parquet(tmp_path_factory):
    return write_parquet(tmp_path_factory.mktemp("src") / "p.parquet", CORE + MANY)


@pytest.fixture
def ready(base, parquet):
    base.mkdir()
    release = make_release(base, parquet, "r1")
    parcels_data.publish(base, release)
    return base


# ------------------------------------------------------------------ search

def test_search_by_id_is_case_insensitive_and_supports_slash(ready):
    found = geo.lookup("301103_2.0009.549/7")
    assert [p["id"] for p in found] == ["301103_2.0009.549/7"]
    assert [p["id"] for p in geo.lookup("301103_2.0001.ar_1.5")] == ["301103_2.0001.AR_1.5"]
    assert [p["id"] for p in geo.lookup("  301103_2.0001.121 ")] == ["301103_2.0001.121"]
    assert geo.lookup("301103_2.0001.999") == []


def test_search_by_obreb_name_and_number(ready):
    assert [p["id"] for p in geo.lookup("Winogrady 121")] == ["301103_2.0001.121"]
    assert [p["id"] for p in geo.lookup("JEŻYCE 549/7")] == ["301103_2.0009.549/7"]
    assert [p["id"] for p in geo.lookup("winogr 122")] == ["301103_2.0001.122"]  # name prefix
    assert geo.lookup("Winogrady 9999") == []


def test_search_bare_number_spans_obreby_and_respects_limit(ready):
    assert {p["id"] for p in geo.lookup("121")} == {"301103_2.0001.121", "066301_1.0003.121"}
    assert len(geo.lookup("99")) == 60


def test_result_fields(ready):
    parcel = geo.lookup("301103_2.0001.121")[0]
    assert parcel["commune"] == "Poznań"
    assert parcel["region"] == "Winogrady"
    assert parcel["source"] == parcels_data.SOURCE_NAME
    assert parcel["source_url"] == "https://example.test/p.parquet"
    assert parcel["retrieved_at"].startswith(str(datetime.now(UTC).year))
    assert parcel["area_ha"] == pytest.approx(0.12, abs=0.001)
    lublin = geo.lookup("066301_1.0003.121")[0]
    assert (lublin["commune"], lublin["region"]) == ("Lublin", "Czechów")


# ------------------------------------------------------------------ geometry / axes

def test_wgs84_conversion_and_axes(ready):
    parcel = geo.lookup("301103_2.0001.121")[0]
    lon, lat = expected_lonlat(N0, E0)
    assert 16.5 < lon < 17.3 and 52.0 < lat < 52.8  # Poznan, not mirrored
    assert parcel["centroid"][0] == pytest.approx(lon, abs=1e-4)
    assert parcel["centroid"][1] == pytest.approx(lat, abs=1e-4)
    lublin = geo.lookup("066301_1.0003.121")[0]
    llon, llat = expected_lonlat(LUBLIN_N, LUBLIN_E)
    assert lublin["centroid"] == pytest.approx([llon, llat], abs=1e-4)
    assert 22 < llon < 23 and 51 < llat < 52
    # swapping the axes must be detected: it would land outside Poland and fail validation
    swapped = Transformer.from_crs(2180, 4326, always_xy=True).transform(N0 + 20, E0 + 15)
    assert abs(swapped[0] - lon) > 1


def test_by_point_returns_containing_parcel(ready):
    lon, lat = expected_lonlat(N0, E0)
    hit = geo.by_point(lon, lat)
    assert [p["id"] for p in hit] == ["301103_2.0001.121"]
    lon2, lat2 = expected_lonlat(N0 + 100, E0)
    assert [p["id"] for p in geo.by_point(lon2, lat2)] == ["301103_2.0009.549/7"]
    llon, llat = expected_lonlat(LUBLIN_N, LUBLIN_E)
    assert [p["id"] for p in geo.by_point(llon, llat)] == ["066301_1.0003.121"]


def test_by_point_outside_any_parcel_is_empty_and_api_404(ready):
    lon, lat = expected_lonlat(N0 + 50, E0 + 50)  # gap between parcels
    assert geo.by_point(lon, lat) == []
    with TestClient(app) as client:
        response = client.get(f"/api/parcels/by-point?lon={lon}&lat={lat}")
        assert response.status_code == 404
        assert "Nie znaleziono działki" in response.json()["detail"]
        assert client.get("/api/parcels/301103_2.0001.999").status_code == 404


def test_api_lookup_by_id_with_slash_and_by_point(ready):
    with TestClient(app) as client:
        body = client.get("/api/parcels/301103_2.0009.549/7").json()
        assert body["parcels"][0]["id"] == "301103_2.0009.549/7"
        assert client.get("/api/parcels/search", params={"query": "winogrady 121"}).json()["parcels"][0]["id"] \
            == "301103_2.0001.121"
        lon, lat = expected_lonlat(N0, E0)
        assert client.get(f"/api/parcels/by-point?lon={lon}&lat={lat}").json()["parcels"][0]["id"] \
            == "301103_2.0001.121"


# ------------------------------------------------------------------ not ready / health

def test_api_503_and_health_before_and_after_data(base, parquet):
    with TestClient(app) as client:
        response = client.get("/api/parcels/301103_2.0001.121")
        assert response.status_code == 503
        assert "Dane działek są w trakcie pobierania" in response.json()["detail"]
        assert client.get("/api/parcels/search", params={"query": "Winogrady 121"}).status_code == 503
        assert client.get("/api/parcels/by-point?lon=16.9&lat=52.4").status_code == 503
        assert client.get("/api/health").json()["parcels"]["ready"] is False

        base.mkdir(exist_ok=True)
        parcels_data.publish(base, make_release(base, parquet, "r1", etag='"abc"'))
        health = client.get("/api/health").json()["parcels"]
        assert health["ready"] is True
        assert health["rows"] == len(CORE) + len(MANY)
        assert health["etag"] == '"abc"'
        assert health["release"] == "r1"
        assert client.get("/api/parcels/301103_2.0001.121").status_code == 200


def test_data_not_ready_is_a_source_error(base):
    assert issubclass(DataNotReadyError, SourceError)
    with pytest.raises(DataNotReadyError, match="Dane działek są w trakcie pobierania"):
        parcels_data.open_index()
    assert parcels_data.current_release(base) is None


def test_download_progress_is_reported_while_not_ready(base):
    (base / "tmp").mkdir(parents=True)
    (base / "tmp" / "progress.json").write_text(json.dumps({"phase": "download", "bytes": 50, "total": 200}))
    with pytest.raises(DataNotReadyError, match="25%"):
        parcels_data.open_index()
    assert parcels_data.health_info()["progress"]["bytes"] == 50


# ------------------------------------------------------------------ swap

def test_atomic_swap_keeps_old_handle_working_and_reopens_new(base, parquet, tmp_path):
    base.mkdir()
    first = make_release(base, parquet, "r1", etag="one")
    parcels_data.publish(base, first)
    old_index, old_meta = parcels_data.open_index()
    assert old_meta["etag"] == "one"

    smaller = write_parquet(tmp_path / "small.parquet", CORE[:2])
    parcels_data.publish(base, make_release(base, smaller, "r2", etag="two"))

    assert [r["id"] for r in old_index.by_id("301103_2.0009.549/7")] == ["301103_2.0009.549/7"]  # old still answers
    new_index, new_meta = parcels_data.open_index()
    assert new_meta["etag"] == "two" and new_index is not old_index
    assert new_index.by_id("301103_2.0009.549/7") == []
    assert (base / "current").resolve().name == "r2"
    assert not (base / ".current.new").exists()


# ------------------------------------------------------------------ HTTP end-to-end

class Origin:
    def __init__(self, body):
        self.body, self.etag, self.mode = body, '"v1"', "ok"
        origin = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *args):
                pass

            def headers_common(self, length):
                self.send_header("ETag", origin.etag)
                self.send_header("Last-Modified", "Wed, 01 Jan 2025 00:00:00 GMT")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(length))

            def do_HEAD(self):
                self.send_response(200)
                self.headers_common(len(origin.body))
                self.end_headers()

            def do_GET(self):
                if origin.mode == "500":
                    self.send_response(500)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                body = origin.body if origin.mode != "garbage" else b"\0" * len(origin.body)
                match = re.fullmatch(r"bytes=(\d+)-(\d+)", self.headers.get("Range", ""))
                if not match:
                    self.send_response(200)
                    self.headers_common(len(body))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                start, end = int(match[1]), min(int(match[2]), len(body) - 1)
                part = body[start:end + 1]
                self.send_response(206)
                self.headers_common(len(part))
                self.send_header("Content-Range", f"bytes {start}-{end}/{len(body)}")
                self.end_headers()
                self.wfile.write(part[:len(part) // 2] if origin.mode == "truncated" else part)
                if origin.mode == "truncated":
                    self.close_connection = True

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/0_dzialki.parquet"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def origin(base, parquet, monkeypatch):
    server = Origin(parquet.read_bytes())
    monkeypatch.setenv("WODO_PARCELS_URL", server.url)
    monkeypatch.setenv("WODO_PARCELS_CONNECTIONS", "3")
    monkeypatch.setattr(parcels_data, "CHUNK", 2048)  # several parallel Range chunks
    real_sleep = time.sleep
    monkeypatch.setattr(parcels_data.time, "sleep", lambda s: real_sleep(min(s, 0.01)))
    yield server
    server.close()


def test_refresh_end_to_end_over_http(base, origin):
    assert len(origin.body) > 2048 * 2
    assert parcels_data.refresh() == "updated"
    release = parcels_data.current_release()
    meta = parcels_data.read_meta(release)
    assert meta["etag"] == '"v1"' and meta["rows"] == len(CORE) + len(MANY)
    assert meta["source_url"] == origin.url
    assert not list((base / "tmp").glob("*.parquet")) and not list((base / "tmp").glob("*.part"))
    assert [p["id"] for p in geo.lookup("301103_2.0001.121")] == ["301103_2.0001.121"]

    assert parcels_data.refresh() == "current"
    assert parcels_data.current_release() == release

    origin.etag = '"v2"'
    assert parcels_data.refresh() == "updated"
    second = parcels_data.current_release()
    assert second != release and parcels_data.read_meta(second)["etag"] == '"v2"'

    assert parcels_data.refresh() == "current"
    assert parcels_data.refresh(force=True) == "updated"
    assert parcels_data.current_release() not in (release, second)


@pytest.mark.parametrize("mode", ["500", "truncated", "garbage"])
def test_failed_download_keeps_previous_release(base, origin, mode):
    assert parcels_data.refresh() == "updated"
    release = parcels_data.current_release()
    index, _meta = parcels_data.open_index()

    origin.etag, origin.mode = '"v2"', mode
    with pytest.raises(DownloadError):
        parcels_data.refresh()

    assert parcels_data.current_release() == release
    assert parcels_data.read_meta(release)["etag"] == '"v1"'
    assert [r["id"] for r in index.by_id("301103_2.0001.121")] == ["301103_2.0001.121"]
    assert [p["id"] for p in geo.lookup("301103_2.0001.121")] == ["301103_2.0001.121"]
    assert sorted(p.name for p in (base / "releases").iterdir()) == [release.name]  # no half-built release


def test_lock_prevents_concurrent_refresh(base, origin):
    with parcels_data.lock(base), pytest.raises(DownloadError, match="Inna instancja"):
        parcels_data.refresh()
    assert parcels_data.refresh() == "updated"  # released afterwards


# ------------------------------------------------------------------ ULDK flag path

def test_uldk_flag_keeps_legacy_path(monkeypatch, base):
    reply = b"0\n141201_1.0001.6509|SRID=2180;POLYGON((500000 500000,500100 500000,500100 500100,500000 500100,500000 500000))|gmina|obreb"
    calls = []
    monkeypatch.setenv("WODO_PARCEL_SOURCE", "uldk")
    monkeypatch.setattr(geo, "fetch", lambda url, params, **_k: calls.append(params) or reply)
    monkeypatch.setattr(geo, "cached", lambda _ns, _params, _days, fn: {**fn(), "retrieved_at": "now"})
    found = geo.lookup("141201_1.0001.6509")
    assert found[0]["source"] == "GUGiK / ULDK" and found[0]["retrieved_at"] == "now"
    assert calls[-1]["request"] == "GetParcelById"
    assert geo.by_point(19.0, 52.0)[0]["id"] == "141201_1.0001.6509"
    assert calls[-1]["request"] == "GetParcelByXY"
    assert parcels_data.current_release(base) is None  # parquet index never touched


def test_index_by_id_with_trailing_dot(base, tmp_path):
    rows = [("081201_5.0018.", "", "0018", "Obr", "081201_5", "G", N0, E0),
            ("241606_4.0001.AR_19.7314.", "7314.", "0001", "Obr", "241606_4", "G", N0, E0 + 100)]
    base.mkdir()
    release = make_release(base, write_parquet(tmp_path / "dot.parquet", rows), "r1")
    index = parcels_index.ParcelIndex(release / "parcels.duckdb")
    assert [r["id"] for r in index.by_id("081201_5.0018.")] == ["081201_5.0018."]
    assert [r["id"] for r in index.by_id("241606_4.0001.ar_19.7314.")] == ["241606_4.0001.AR_19.7314."]
    assert index.by_id("081201_5.0018") == []
    index.close()


def test_imported_parcels_get_distinct_stable_ids():
    from wodo.geo import imported

    def square(x):
        return {"type": "Polygon", "coordinates": [[[x, 52.08], [x + .01, 52.08], [x + .01, 52.09], [x, 52.09], [x, 52.08]]]}

    a, b = imported(square(16.65)), imported(square(16.70))
    assert a["id"] != b["id"]
    assert a["id"] == imported(square(16.65))["id"]
    assert a["id"].startswith("Działka z GeoJSON #")
