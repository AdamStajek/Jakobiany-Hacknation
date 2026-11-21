import math
import re
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import date, timedelta
from threading import BoundedSemaphore, Lock
from time import monotonic, sleep
from urllib.parse import urlsplit

import numpy as np
import rasterio
import shapely
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.errors import RasterioIOError
from rasterio.features import geometry_mask
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import Window, from_bounds
from shapely import transform
from shapely.geometry import mapping, shape

from wodo.geo import TO_GPS, TO_PL
from wodo.science import years_ago
from wodo.store import (
    ISRIC,
    MS_STAC,
    STAC,
    TOPO,
    WORLD,
    SourceError,
    cached,
    fetch,
    payload,
)

ESA_NOTICE = "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium"
DEM_NOTICE = "produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA"
SAT_NOTICE = "Contains modified Copernicus Sentinel data"
RASTER_HOSTS = {"sentinel-cogs.s3.us-west-2.amazonaws.com", "e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com", "copernicus-dem-30m.s3.eu-central-1.amazonaws.com",
                "esa-worldcover.s3.eu-central-1.amazonaws.com"}
WCS_DEPTHS = ("0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm")
AZURE_HOST = re.compile(r"sentinel2l2a(?:[0-9]{2})?\.blob\.core\.windows\.net")
AZURE_TOKENS = {}
AZURE_LOCK = Lock()
RASTER_SLOTS = BoundedSemaphore(24)
TOPO_LOCK = Lock()
topo_last_request = 0.0
SENTINEL_BANDS = ("red", "nir", "green", "swir16", "scl")
LAND = {10: "Drzewa", 20: "Krzewy", 30: "Roślinność trawiasta", 40: "Grunty orne",
        50: "Zabudowa", 60: "Grunt odkryty", 70: "Śnieg i lód", 80: "Woda stała",
        90: "Roślinność mokradłowa", 95: "Namorzyny", 100: "Mchy i porosty"}


def grid(local, step, pad=0, minimum=1):
    x0, y0, x1, y1 = local.bounds
    left, top = math.floor((x0 - pad) / step) * step, math.ceil((y1 + pad) / step) * step
    width = max(minimum, math.ceil((x1 + pad - left) / step))
    height = max(minimum, math.ceil((top - y0 + pad) / step))
    return from_origin(left, top, step, step), (height, width)


def signed_azure_url(url, host):
    account = host.split(".")[0]
    endpoint = f"https://planetarycomputer.microsoft.com/api/sas/v1/token/{account}/sentinel2-l2"
    with AZURE_LOCK:
        token = AZURE_TOKENS.get(account)
        if not token or monotonic() - token[0] > 2400:
            value = payload(endpoint, timeout=4)["token"]
            token = (monotonic(), value.lstrip("?"))
            AZURE_TOKENS[account] = token
    return f"{url}?{token[1]}"


def subset(raster_url, transform_, size, resampling=Resampling.nearest):
    st = urlsplit(raster_url)
    if st.scheme == "s3" and st.netloc == "copernicus-dem-30m":
        raster_url = "https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com" + st.path
        st = urlsplit(raster_url)
    azure = AZURE_HOST.fullmatch(st.netloc) and st.path.startswith("/sentinel2-l2/")
    if st.scheme != "https" or not (st.netloc in RASTER_HOSTS or azure) or not st.path.endswith(".tif") or st.query:
        raise SourceError("Adres rastra nie należy do obsługiwanych archiwów.")
    if azure:
        raster_url = signed_azure_url(raster_url, st.netloc)
    try:
        with RASTER_SLOTS, rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                          GDAL_HTTP_TIMEOUT="12", GDAL_HTTP_CONNECTTIMEOUT="3", GDAL_HTTP_MAX_RETRY="0",
                          GDAL_HTTP_UNSAFESSL="NO", GDAL_HTTP_MULTIRANGE="SERIAL" if azure else "YES"):
            result = np.full(size, np.nan, dtype="float32")
            with rasterio.open(raster_url) as src:
                if st.netloc == "esa-worldcover.s3.eu-central-1.amazonaws.com":
                    with WarpedVRT(src, crs="EPSG:2180", transform=transform_, width=size[1], height=size[0],
                                   resampling=resampling, nodata=np.nan, dtype="float32") as view:
                        return view.read(1)
                bounds = transform_bounds("EPSG:2180", src.crs, *rasterio.transform.array_bounds(*size, transform_))
                left, bottom = max(bounds[0], src.bounds.left), max(bounds[1], src.bounds.bottom)
                right, top = min(bounds[2], src.bounds.right), min(bounds[3], src.bounds.top)
                if left >= right or bottom >= top:
                    return result
                fractional = from_bounds(left, bottom, right, top, src.transform)
                x, y = max(0, math.floor(fractional.col_off) - 1), max(0, math.floor(fractional.row_off) - 1)
                end_x = min(src.width, math.ceil(fractional.col_off + fractional.width) + 1)
                end_y = min(src.height, math.ceil(fractional.row_off + fractional.height) + 1)
                window = Window(x, y, end_x - x, end_y - y)
                data = src.read(1, window=window, out_dtype="float32", masked=True).filled(np.nan)
                reproject(data, result, src_transform=src.window_transform(window), src_crs=src.crs,
                          src_nodata=np.nan, dst_transform=transform_, dst_crs="EPSG:2180",
                          dst_nodata=np.nan, resampling=resampling, num_threads=1)
            return result
    except (RasterioIOError, OSError, ValueError) as error:
        raise SourceError("Nie udało się odczytać fragmentu rastra.") from error


def mask(local, transform_, size):
    return geometry_mask([mapping(local)], size, transform_, invert=True)


def stac(collections, bbox, limit, period=None, endpoint=STAC):
    params = {"collections": collections, "bbox": ",".join(f"{value:.6f}" for value in bbox), "limit": limit}
    if period:
        params.update(datetime=f"{period[0]}T00:00:00Z/{period[1]}T23:59:59Z", sortby="-properties.datetime")
    return payload(endpoint, params, timeout=5)["features"]


def indices(bands, footprint):
    red, nir, green, swir, scl = bands
    reflectance = np.stack([red, nir, green, swir])
    clear = (footprint & np.isin(scl, [4, 5]) & np.isfinite(reflectance).all(axis=0) &
             (reflectance >= 0).all(axis=0) & (nir + red > 0) & (nir + swir > 0) & (nir + green > 0))
    number = int(clear.sum())
    share = number / max(1, int(footprint.sum()))
    if number < 3 or share < .6:
        return None

    def nd(a, b):
        return round(float(np.median((a[clear] - b[clear]) / (a[clear] + b[clear]))), 3)

    return {"ndvi": nd(nir, red), "ndmi": nd(nir, swir), "ndwi": nd(green, nir),
            "clear_share": round(share, 3), "pixels": number}


def passport_stats(bands, footprint):
    scl = bands[-1]
    clear = footprint & np.isin(scl, [2, 4, 5, 6, 7])
    red, nir, green, swir = (band[clear] for band in bands[:4])
    values = {"clear_pixel_pct": float(100 * clear.sum() / footprint.sum())}
    for key, a, b in (("ndvi", nir, red), ("ndmi", nir, swir), ("ndwi", green, nir), ("mndwi", green, swir)):
        valid = np.isfinite(a) & np.isfinite(b) & (a >= 0) & (b >= 0) & (a + b > 0)
        if valid.any():
            index = (a[valid] - b[valid]) / (a[valid] + b[valid])
            values[f"{key}_mean"] = float(np.mean(index))
            if key in ("ndvi", "ndmi"):
                values[f"{key}_p10"] = float(np.percentile(index, 10))
                values[f"{key}_std"] = float(np.std(index))
            if key == "ndvi":
                values["ndvi_p90"] = float(np.percentile(index, 90))
                values["valid_pixel_count"] = int(valid.sum())
    return values


def azure_scene(scene):
    keys = ("B04", "B08", "B03", "B11", "SCL")
    props = scene["properties"]
    baseline = float(props.get("s2:processing_baseline") or 0)
    scene["assets"] = {name: {**scene["assets"][key],
                              "raster:bands": [{"scale": .0001, "offset": -.1 if baseline >= 4 else 0}]}
                       for name, key in zip(SENTINEL_BANDS, keys, strict=True) if key in scene["assets"]}
    return scene


def scene_metrics(scene, local, for_passport=False):
    assets = scene["assets"]
    asset_urls = [assets[key]["href"] for key in SENTINEL_BANDS]
    affine, dimensions = grid(local, 20)
    footprint = mask(local, affine, dimensions)
    scl = subset(asset_urls[-1], affine, dimensions)
    if int((footprint & np.isin(scl, [4, 5])).sum()) < max(3, .6 * int(footprint.sum())):
        return None

    def load(key):
        asset = assets[key]
        band = asset["raster:bands"][0]
        return subset(asset["href"], affine, dimensions, Resampling.average) * band.get("scale", .0001) + band.get("offset", 0)

    with ThreadPoolExecutor(max_workers=4) as pool:
        bands = list(pool.map(load, SENTINEL_BANDS[:-1]))
    output = indices([*bands, scl], footprint)
    if output:
        props = scene["properties"]
        if for_passport:
            output["passport_stats"] = passport_stats([*bands, scl], footprint)
            if rgb := assets.get("visual", {}).get("href"):
                output["passport_stats"]["s2_rgb_asset_uri"] = rgb
        return {**output, "scene": scene["id"], "date": props["datetime"][:10],
                "tile_cloud_pct": props.get("eo:cloud_cover"), "publication_date": props.get("created"),
                "asset_urls": asset_urls}
    return None


def satellite(geometry, day, baseline=False, *, earth_search_only=False):
    polygon = shape(geometry)
    local = transform(polygon, TO_PL, interleaved=False)
    if local.area < 1200:
        raise SourceError("Działka jest zbyt mała dla trzech pikseli Sentinel-2 20 m.")

    def download():
        window = 22 if baseline else 38
        period = (day - timedelta(days=window), day)
        endpoint = MS_STAC
        candidates = []
        if not earth_search_only:
            try:
                candidates = [azure_scene(scene) for scene in stac("sentinel-2-l2a", polygon.bounds, 28, period, MS_STAC)]
            except (SourceError, ValueError, KeyError):
                pass
        if not candidates:
            endpoint = STAC
            candidates = stac("sentinel-2-c1-l2a,sentinel-2-l2a,sentinel-2-pre-c1-l2a", polygon.bounds, 36, period)
        candidates = [x for x in candidates if x.get("geometry") and shape(x["geometry"]).intersects(polygon)
                      and all(k in x["assets"] for k in SENTINEL_BANDS)
                      and x["properties"].get("eo:cloud_cover", 100) <= 85
                      and x["properties"]["datetime"][:10] <= day.isoformat()]
        candidates.sort(key=lambda x: (day - date.fromisoformat(x["properties"]["datetime"][:10])).days
                        + .40 * x["properties"].get("eo:cloud_cover", 100))
        distinct = {}
        for candidate in candidates:
            key = candidate["properties"]["datetime"][:10]
            distinct.setdefault(key, candidate)
        pending_candidates = list(distinct.values())[:4 if not baseline else 2]
        if not pending_candidates:
            return {"scene": None, "searched": len(candidates), "read_failures": 0, "endpoint": endpoint}
        pool = ThreadPoolExecutor(max_workers=len(pending_candidates))
        futures = [pool.submit(scene_metrics, candidate, local, earth_search_only) for candidate in pending_candidates]
        done, pending = wait(futures, timeout=19 if not baseline else 13)
        pool.shutdown(wait=False, cancel_futures=True)
        rejected = len(pending)
        for future in futures:
            if future not in done:
                continue
            try:
                result = future.result()
            except (SourceError, KeyError):
                rejected += 1
                continue
            if result:
                return {"scene": result, "searched": len(candidates), "endpoint": endpoint}
        if rejected:
            raise SourceError("Część scen była nieużyteczna lub przekroczyła limit odczytu rastrów.")
        return {"scene": None, "searched": len(candidates), "read_failures": rejected, "endpoint": endpoint}

    cache_name = "passport-sentinel" if earth_search_only else ("sentinel-baseline" if baseline else "sentinel")
    return cached(cache_name, [geometry, day.isoformat()],
                  .25 if day >= date.today() - timedelta(days=5) else 45, download)


def satellite_history(geometry, day):
    reference_dates = [years_ago(day, n) for n in (1, 3, 5) if day.year - n >= 2017]

    def older(end):
        try:
            result = satellite(geometry, end, baseline=True)
        except SourceError:
            return None
        return {**result["scene"], "retrieved_at": result["retrieved_at"]} if result["scene"] else None

    with ThreadPoolExecutor(max_workers=1 + len(reference_dates)) as pool:
        recent = pool.submit(satellite, geometry, day)
        older_results = [pool.submit(older, end) for end in reference_dates]
        result = recent.result()
        baseline = [sample for job in older_results if (sample := job.result())]
    return {"name": "Copernicus Sentinel-2 L2A", "url": result["endpoint"], "kind": "wskaźniki z obserwacji",
            "resolution": "20 m w analizie", "publication_date": (result["scene"] or {}).get("publication_date"),
            **result, "history": baseline, "attribution": SAT_NOTICE + " " + str(day.year),
            "coverage": sorted({s["date"] for s in baseline + ([result["scene"]] if result["scene"] else [])})}


def soil_coverage(prop, depth, bounds, polygon):
    w, s, e, n = bounds
    params = [("map", f"/map/{prop}.map"), ("SERVICE", "WCS"), ("VERSION", "2.0.1"),
              ("REQUEST", "GetCoverage"), ("COVERAGEID", f"{prop}_{depth}_mean"), ("FORMAT", "image/tiff"),
              ("SUBSETTINGCRS", "http://www.opengis.net/def/crs/EPSG/0/4326"),
              ("SUBSET", f"Long({w:.6f},{e:.6f})"), ("SUBSET", f"Lat({s:.6f},{n:.6f})")]
    try:
        raw = fetch(ISRIC, params, timeout=5, limit=2_000_000)
        with MemoryFile(raw) as file, file.open() as src:
            projected = transform(polygon, Transformer.from_crs(4326, src.crs.to_wkt(), always_xy=True).transform, interleaved=False)
            cover = mask(projected, src.transform, src.shape)
            values = src.read(1, masked=True)
            selected = values[cover].compressed()
            support = "piksele wewnątrz granicy"
            if not selected.size:
                p = projected.representative_point()
                selected = next(src.sample([(p.x, p.y)], masked=True)).compressed()
                support = "piksel w punkcie wewnętrznym"
            if prop in ("wv0033", "wv1500"):
                selected = selected[(selected > 0) & (selected <= 1000)]
            else:
                selected = selected[np.isfinite(selected) & (selected >= 0)]
            return (round(float(np.mean(selected)), 1), support) if selected.size else (None, None)
    except (RasterioIOError, SourceError):
        return None, None


def soil(geometry):
    polygon = shape(geometry)
    w, s, e, n = polygon.bounds
    bounds = (w - .004, s - .003, e + .004, n + .003)

    def download():
        jobs = [(prop, depth) for depth in WCS_DEPTHS for prop in ("wv0033", "wv1500")]
        with ThreadPoolExecutor(max_workers=5) as pool:
            futures = [pool.submit(soil_coverage, prop, depth, bounds, polygon) for prop, depth in jobs]
            values = [future.result() for future in futures]
        layers = [[a[0], b[0]] if a[0] is not None and b[0] is not None and a[0] > b[0] else None
                  for a, b in zip(values[::2], values[1::2], strict=True)]
        if not any(layers):
            raise SourceError("Brak prawidłowej pary 33 i 1500 kPa w SoilGrids WCS.")
        return {"name": "ISRIC SoilGrids 2.0 / WCS", "url": ISRIC, "kind": "predykcja przestrzenna",
                "resolution": "250 m", "publication_date": None, "layer_depths": WCS_DEPTHS,
                "layers": layers, "sampling": sorted({support for _, support in values if support}),
                "capacity_unit": "mm/m", "bounds": bounds}

    return cached("soil", geometry, 90, download)


def cop_dem(geometry):
    local = transform(shape(geometry), TO_PL, interleaved=False)
    area = transform(local.envelope.buffer(60), TO_GPS, interleaved=False).bounds

    def download():
        dem = stac("cop-dem-glo-30", area, 5)
        affine, size = grid(local, 30, pad=60, minimum=5)
        merged = np.full(size, np.nan)
        tiles = []
        for scene in dem:
            url = scene["assets"]["data"]["href"]
            data = subset(url, affine, size, Resampling.bilinear)
            valid = np.isfinite(data)
            if valid.any():
                merged[valid] = data[valid]
                tiles.append(scene["id"])
        inside = mask(local, affine, size)
        values = merged[inside]
        if not values.size or np.isfinite(values).sum() / values.size < .8:
            raise SourceError("Za mało pikseli modelu wysokości wewnątrz granicy.")
        grad_y, grad_x = np.gradient(merged, 30, 30)
        slopes = 100 * np.hypot(grad_x, grad_y)[inside]
        slopes = slopes[np.isfinite(slopes)]
        return {"name": "Copernicus DEM GLO-30", "url": STAC, "kind": "model powierzchni",
                "publication_date": "2021-04-22", "coverage": ["2010", "2015"], "resolution": "około 30 m",
                "elevation_m": round(float(np.nanmean(values)), 1),
                "slope_pct": round(float(np.median(slopes)), 1) if slopes.size >= 3 else None,
                "relief_m": round(float(np.nanmax(values) - np.nanmin(values)), 1) if values.size >= 3 else None,
                "pixels": int(np.isfinite(values).sum()), "tiles": tiles, "attribution": DEM_NOTICE}

    return cached("dem", geometry, 90, download)


def terrain(geometry):
    local = transform(shape(geometry), TO_PL, interleaved=False)

    def download():
        global topo_last_request
        affine, dims = grid(local, 25)
        rows, cols = np.where(mask(local, affine, dims))
        if len(rows):
            ids = np.linspace(0, len(rows) - 1, min(9, len(rows)), dtype=int)
            xs, ys = rasterio.transform.xy(affine, rows[ids], cols[ids])
            centers = list(zip(xs, ys, strict=True))
        else:
            point = local.representative_point()
            centers = [(point.x, point.y)]
        offsets = ((0, 0), (-25, 0), (25, 0), (0, -25), (0, 25))
        points = [TO_GPS(x + dx, y + dy) for x, y in centers for dx, dy in offsets]
        coords = "|".join(f"{lat:.6f},{lon:.6f}" for lon, lat in points)
        with TOPO_LOCK:
            sleep(max(0, 1.05 - (monotonic() - topo_last_request)))
            topo_last_request = monotonic()
            answer = payload(TOPO, {"locations": coords}, timeout=4)
        samples = answer.get("results") or []
        if len(samples) != len(points) or any(s.get("elevation") is None for s in samples):
            raise SourceError("EU-DEM nie pokrywa wszystkich punktów wycinka.")
        values = np.array([s["elevation"] for s in samples], dtype=float).reshape(-1, len(offsets))
        if not np.isfinite(values).all():
            raise SourceError("EU-DEM zawiera nieprawidłowe wysokości.")
        heights = values[:, 0]
        slopes = 100 * np.hypot(values[:, 2] - values[:, 1], values[:, 4] - values[:, 3]) / 50
        return {"name": "Copernicus EU-DEM v1.1 / Open Topo Data", "url": TOPO, "kind": "model powierzchni",
                "publication_date": "2016", "coverage": [], "resolution": "25 m, próbki z modelu",
                "elevation_m": round(float(np.mean(heights)), 1),
                "slope_pct": round(float(np.median(slopes)), 1) if len(heights) >= 3 else None,
                "relief_m": round(float(np.ptp(heights)), 1) if len(heights) >= 3 else None,
                "pixels": len(heights), "query_points": points,
                "attribution": "Produced using Copernicus data and information funded by the European Union – EU-DEM layers."}

    try:
        return cached("eu-dem", geometry, 90, download)
    except SourceError:
        return cop_dem(geometry)


def worldcover(geometry):
    local = transform(shape(geometry), TO_PL, interleaved=False)
    search_m = 2000
    w, s, e, n = transform(local.envelope.buffer(search_m + 40), TO_GPS, interleaved=False).bounds

    def download():
        affine, size = grid(local, 20, pad=search_m + 40)
        mosaic = np.full(size, np.nan)
        tiles = []
        for lat in range(math.floor(s / 3) * 3, math.floor(n / 3) * 3 + 1, 3):
            for lon in range(math.floor(w / 3) * 3, math.floor(e / 3) * 3 + 1, 3):
                tile = f"N{lat:02d}E{lon:03d}"
                url = WORLD + f"ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
                values = subset(url, affine, size)
                valid = np.isfinite(values) & (values != 0)
                mosaic[valid] = values[valid]
                tiles.append(url)
        footprint = mask(local, affine, size)
        land = mosaic[footprint]
        valid_land = land[np.isfinite(land)]
        if np.isfinite(mosaic).sum() == 0:
            raise SourceError("Brak danych WorldCover.")
        rows, cols = np.where(mosaic == 80)
        nearest = None
        nearest_point = None
        if rows.size:
            xs, ys = rasterio.transform.xy(affine, rows, cols)
            dists = shapely.distance(local, shapely.points(xs, ys))
            index = int(np.argmin(dists))
            if dists[index] <= search_m:
                nearest = round(float(dists[index]))
                nearest_point = list(TO_GPS(xs[index], ys[index]))
        classes = [{"class": LAND.get(int(key), str(key)), "percent": round(float((valid_land == key).mean() * 100), 1)}
                   for key in np.unique(valid_land)]
        return {"name": "ESA WorldCover 2021 v200", "url": WORLD, "kind": "klasyfikacja obrazu",
                "publication_date": "2022-10", "coverage": ["2021"], "resolution": "10 m wejście, 20 m analiza",
                "classes": sorted(classes, key=lambda item: -item["percent"]), "pixels": int(valid_land.size),
                "nearest_water_m": nearest, "nearest_water_point": nearest_point, "search_m": search_m,
                "tiles": tiles, "attribution": ESA_NOTICE}

    return cached("worldcover", geometry, 90, download)
