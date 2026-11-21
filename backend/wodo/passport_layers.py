"""On-demand access to complementary passport layers."""

import csv
import io
import os
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from math import isfinite
from pathlib import Path
from statistics import mean
from threading import Lock
from uuid import UUID

import httpx
import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import shapes
from rasterio.io import MemoryFile
from shapely import transform
from shapely.geometry import box, shape

from wodo.geo import TO_PL
from wodo.passport_hydrology import hydro
from wodo.science import CROPS, phenology
from wodo.spatial import mask
from wodo.store import SourceError, cached, read, write

CLMS = "Copernicus CLMS Croplands"
BDOT = "GUGiK BDOT10k"
PROCESS = "https://sh.dataspace.copernicus.eu/api/v1/process"
TOKEN = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
COLLECTIONS = {"CTY": "4fa71893-371f-4440-97c4-917f569f67b2", "CTYCL": "82c292b4-1041-46c6-836a-4f7afe025d99"}


def crop_layers(parcel, start, end):
    identifier, secret = os.getenv("CDSE_CLIENT_ID"), os.getenv("CDSE_CLIENT_SECRET")
    if not identifier or not secret:
        raise SourceError("Brak konfiguracji OAuth klienta Sentinel Hub CDSE.")
    local = transform(shape(parcel["geometry"]), Transformer.from_crs(4326, 3035, always_xy=True).transform,
                      interleaved=False)
    west, south = (int(np.floor(n / 10)) * 10 for n in local.bounds[:2])
    east, north = (int(np.ceil(n / 10)) * 10 for n in local.bounds[2:])

    def download():
        auth = httpx.post(TOKEN, data={"grant_type": "client_credentials", "client_id": identifier,
                                      "client_secret": secret}, timeout=6)
        auth.raise_for_status()
        headers = {"Authorization": "Bearer " + auth.json()["access_token"]}
        weights = {}
        for band, collection in COLLECTIONS.items():
            script = ('//VERSION=3\nfunction setup(){return {input:["' + band + '","dataMask"],'
                      'output:{bands:2,sampleType:"UINT16"}}} function evaluatePixel(s){return [s.' + band + ',s.dataMask]}')
            body = {"input": {"bounds": {"bbox": [west, south, east, north],
                                         "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/3035"}},
                              "data": [{"type": "byoc-" + collection, "dataFilter": {"timeRange": {
                                  "from": f"{end.year}-01-01T00:00:00Z", "to": f"{end}T23:59:59Z"}}}]},
                    "output": {"width": (east - west) // 10, "height": (north - south) // 10,
                               "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}]},
                    "evalscript": script}
            response = httpx.post(PROCESS, headers=headers, json=body, timeout=12)
            response.raise_for_status()
            with MemoryFile(response.content) as file, file.open() as src:
                data, valid = src.read()
            if band == "CTY":
                crop_mask = (valid > 0) & (data >= 1000) & (data <= 3200)
                active = crop_mask
            else:
                active = crop_mask & (valid > 0) & (data <= 100)
            grid = rasterio.transform.from_origin(west, north, 10, 10)
            totals = Counter()
            for geom, code in shapes(data.astype("int32"), mask=active, transform=grid):
                area = local.intersection(shape(geom)).area
                if area:
                    totals[int(code)] += area
            weights[band] = totals
        values = {}
        if classes := weights["CTY"]:
            values["crop_type_clms"] = str(classes.most_common(1)[0][0])
        if confidence := weights["CTYCL"]:
            values["crop_type_confidence_pct"] = sum(v * a for v, a in confidence.items()) / confidence.total()
        return {"values": values, "shares": {str(k): v / local.area for k, v in classes.items()}}

    result = cached("passport-clms", [parcel["geometry"], end.isoformat()], 7, download)
    return result["values"], {"url": PROCESS, "source_version": str(end.year), "collections": COLLECTIONS,
                              "crop_area_fraction": result["shares"], "fetched_at": result["retrieved_at"],
                              "spatial_resolution_m": 10, "method": "klasyfikacja retrospektywna kampanii"}


def layer_dir():
    root = os.getenv("WODO_PASSPORT_LAYERS")
    return Path(root) if root else None


def basin_flow(parcel, start, end):
    root = layer_dir()
    path = root / "basins" / (parcel["id"].replace("/", "-") + ".tif") if root else None
    if not path or not path.is_file():
        raise SourceError("Brak NMT obejmującego pełną zlewnię działki.")
    local = transform(shape(parcel["geometry"]), TO_PL, interleaved=False)

    def download():
        with rasterio.open(path) as src:
            if (src.crs is None or src.crs.to_epsg() != 2180 or not box(*src.bounds).covers(local)
                    or src.width * src.height > 1_000_000 or abs(src.res[0] - src.res[1]) > 1e-6):
                raise SourceError("NMT zlewni wymaga siatki kwadratowej EPSG:2180 do miliona komórek.")
            inside = mask(local, src.transform, src.shape)
            z = src.read(1, masked=True).astype(float).filled(np.nan)
            if not inside.any() or not np.isfinite(z[inside]).all():
                raise SourceError("NMT zlewni ma braki na działce.")
            return {"values": hydro(z, src.transform, inside, local, basin=True)}

    result = cached("passport-basin", [parcel["geometry"], str(path), path.stat().st_mtime_ns], 90, download)
    return result["values"], {"source_asset_id": path.name, "fetched_at": result["retrieved_at"],
                              "method": "D8, priority flood, akumulacja w komórkach, próg zagłębień 0,25 m"}


CDS = "https://cds.climate.copernicus.eu/api/retrieve/v1"
CDS_LOCK = Lock()
SOIL_INTERVALS = ((0, 7), (7, 28), (28, 100), (100, 289))


def cds_soil_csv(lat, lon, end):
    token = os.getenv("CDSAPI_KEY")
    if not token:
        raise SourceError("Skonfiguruj CDSAPI_KEY lub eksport CSV ERA5-Land.")
    last = min(end, date.today() - timedelta(days=6))
    first = date(last.year - 11, 1, 1)
    inputs = {"variable": [f"volumetric_soil_water_level_{i}" for i in range(1, 5)], "location": {"latitude": lat, "longitude": lon},
              "date": f"{first}/{last}", "data_format": "csv"}
    headers = {"PRIVATE-TOKEN": token}
    key = f"passport:cds:swvl1-4:{lat}:{lon}:{last}"
    with CDS_LOCK:
        job = read(key, 2 * 86400)
        if not job:
            response = httpx.post(CDS + "/processes/reanalysis-era5-land-timeseries/execute",
                                  headers=headers, json={"inputs": inputs}, timeout=6)
            response.raise_for_status()
            job = str(UUID(response.json()["jobID"]))
            write(key, job)
    url = CDS + "/jobs/" + job
    state = httpx.get(url, headers=headers, timeout=6)
    if state.status_code == 404:
        write(key, None)
    state.raise_for_status()
    status = state.json()["status"]
    if status in ("failed", "dismissed"):
        write(key, None)
        raise SourceError("CDS zakończył zadanie błędem. Sprawdź dostęp do zbioru ERA5-Land.")
    if status != "successful":
        raise SourceError("CDS przygotowuje serię. Pobierz paszport ponownie po zakończeniu zadania.")
    result = httpx.get(url + "/results", headers=headers, timeout=6)
    result.raise_for_status()
    href = httpx.URL(result.json()["asset"]["value"]["href"])
    if href.scheme != "https" or not href.host.endswith(".ecmwf.int"):
        raise SourceError("Nieznany adres wyniku CDS.")
    with httpx.stream("GET", href, timeout=10) as response:
        response.raise_for_status()
        content = bytearray()
        for chunk in response.iter_bytes():
            content.extend(chunk)
            if len(content) > 24_000_000:
                raise SourceError("Przekroczony limit rozmiaru eksportu CDS.")
    if content.startswith(b"PK"):
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            files = [f for f in archive.infolist() if f.filename.lower().endswith(".csv")]
            if len(files) != 1 or files[0].file_size > 24_000_000:
                raise SourceError("Nieoczekiwany format archiwum CDS.")
            content = archive.read(files[0])
    return io.StringIO(content.decode("utf-8-sig"))


def soil_history(parcel, start, end):
    root = layer_dir()
    lon, lat = parcel["sample_point"]
    grid_lat, grid_lon = round(lat, 1), round(lon, 1)
    path = root / "era5" / f"{grid_lat:.1f}_{grid_lon:.1f}.csv" if root else None
    local = path and path.is_file()

    def download():
        with (path.open(encoding="utf-8-sig", newline="") if local else cds_soil_csv(grid_lat, grid_lon, end)) as file:
            return summarize_soil(file, grid_lat, grid_lon, start, end)

    result = cached("passport-soil-layers-v2", [grid_lat, grid_lon, str(end), path.stat().st_mtime_ns if local else "CDS"],
                    1, download)
    return result["values"], {"source_asset_id": path.name if local else "reanalysis-era5-land-timeseries",
                              "url": "https://doi.org/10.24381/ee82e357", "source_id": "Copernicus CDS ERA5-Land", "reference_years": result["years"],
                              "grid_cell_id": f"ERA5-Land/{grid_lat}/{grid_lon}", "fetched_at": result["retrieved_at"],
                              "method": "ERA5-Land, pełne doby UTC, percentyl warstwy 100–289 cm"}


def summarize_soil(file, lat, lon, start, end):
    hours = [defaultdict(dict) for _ in SOIL_INTERVALS]
    for row in csv.DictReader(file):
        stamp = datetime.fromisoformat(row["valid_time"])
        day = stamp.date()
        if day > end or abs(float(row["latitude"]) - lat) > .0001 or abs(float(row["longitude"]) - lon) > .0001:
            continue
        if day < start and (day.month, day.day) != (end.month, end.day):
            continue
        for i, layer in enumerate(hours, 1):
            raw = row.get(f"swvl{i}", row.get(f"volumetric_soil_water_layer_{i}"))
            if raw and isfinite(value := float(raw)) and 0 <= value <= 1:
                layer[day][stamp.hour] = value
    values = {}
    for (top, bottom), layer in zip(SOIL_INTERVALS, hours, strict=True):
        daily = {d: mean(v.values()) for d, v in layer.items() if len(v) == 24}
        observed = {str(d): value for d, value in daily.items() if d >= start}
        if observed:
            values[f"soil_moisture_{top}_{bottom}_cm"] = observed
    historical = [v for d, v in daily.items() if d.year < end.year and (d.month, d.day) == (end.month, end.day)]
    if end in daily and len(historical) >= 10:
        values["soil_moisture_percentile"] = 100 * mean(
            (v < daily[end]) + .5 * (v == daily[end]) for v in historical)
    return {"values": values, "years": len(historical)}


def anomalies(parcel, end, crop, sowing, stage, values, meta):
    root = layer_dir()
    path = root / "sentinel_reference.csv" if root else None
    if not path or not path.is_file() or crop not in CROPS or not meta.get("observed_at"):
        return {}
    scene_day = date.fromisoformat(meta["observed_at"][:10])
    phase = phenology(CROPS[crop], scene_day, sowing, stage if scene_day == end else None)[0]
    if phase == 4:
        return {}
    yearly = defaultdict(list)
    with path.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            day = date.fromisoformat(row["observed_at"])
            if (row["parcel_id"] == parcel["id"] and row["crop"] == crop and int(row["stage"]) == phase
                    and day.year < scene_day.year and 60 <= float(row["clear_pixel_pct"]) <= 100):
                pair = float(row["ndvi_mean"]), float(row["ndmi_mean"])
                if all(-1 <= v <= 1 for v in pair):
                    yearly[day.year].append(pair)
    if len(yearly) < 3:
        return {}
    return {name + "_anomaly": values[name + "_mean"] - mean(mean(p[i] for p in year) for year in yearly.values())
            for i, name in enumerate(("ndvi", "ndmi")) if name + "_mean" in values}


def bdot_distances(parcel, start, end):
    import sqlite3
    from contextlib import closing

    from shapely import from_wkb

    root = layer_dir()
    path = root / "bdot10k.gpkg" if root else None
    if not path or not path.is_file():
        raise SourceError("Brak warstw hydrograficznych BDOT10k w GeoPackage.")
    local = transform(shape(parcel["geometry"]), TO_PL, interleaved=False)
    values = {}
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as db:
        for table, field in (("OT_SWRS_L", "nearest_stream_distance_m"), ("OT_SWRM_L", "nearest_ditch_distance_m"),
                             ("ponds", "nearest_pond_distance_m")):
            row = db.execute("SELECT column_name, srs_id FROM gpkg_geometry_columns WHERE table_name=?",
                             (table,)).fetchone()
            if not row or row[1] != 2180:
                continue
            column = row[0]
            if not column.isidentifier():
                continue
            rtree = f"rtree_{table}_{column}"
            if not db.execute("SELECT 1 FROM sqlite_master WHERE name=?", (rtree,)).fetchone():
                continue
            west, south, east, north = local.bounds
            for radius in (500, 2000, 10000):
                query = (f'SELECT "{column}" FROM "{table}" WHERE rowid IN (SELECT id FROM "{rtree}" '
                         'WHERE maxx>=? AND minx<=? AND maxy>=? AND miny<=?)')
                nearest = float("inf")
                for (blob,) in db.execute(query, (west-radius, east+radius, south-radius, north+radius)):
                    # GeoPackage binary header followed by an optional envelope and WKB.
                    envelope = (blob[3] >> 1) & 7
                    if blob[:2] != b"GP" or envelope > 4:
                        raise SourceError("Nieprawidłowa geometria GeoPackage.")
                    geom = from_wkb(blob[8 + (0, 32, 48, 48, 64)[envelope]:])
                    if not geom.is_empty:
                        nearest = min(nearest, local.distance(geom))
                if nearest <= radius:
                    values[field] = nearest
                    break
    return values, {"source_asset_id": path.name, "search_radius_max_m": 10000, "epsg": 2180}
