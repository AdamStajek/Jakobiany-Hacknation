"""Source workers for the parcel passport import."""

import os
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from math import ceil, pi
from statistics import mean
from zoneinfo import ZoneInfo

import numpy as np
from rasterio.io import MemoryFile
from shapely import transform
from shapely.geometry import MultiPolygon, shape

from wodo import geo, spatial, weather
from wodo.passport_hydrology import hydro
from wodo.passport_layers import BDOT, CLMS, bdot_distances, crop_layers
from wodo.science import years_ago
from wodo.store import NMT, SourceError, cached, fetch, payload


def egib(parcel, start, end):
    local = transform(shape(parcel["geometry"]), geo.TO_PL, interleaved=False)
    polygon = local if local.geom_type == "MultiPolygon" else MultiPolygon([local])
    lon, lat = parcel["centroid"]
    values = {
        "parcel_geometry": polygon.wkt, "parcel_area_ha": local.area / 10_000, "parcel_perimeter_m": local.length,
        "centroid_lat": lat, "centroid_lon": lon, "compactness": 4 * pi * local.area / local.length**2,
    }
    if parcel["source"] == "Import użytkownika" and not parcel.get("declared_parcel_id"):
        return values, {"epsg": 2180}
    district, number = parcel["id"].rsplit(".", 1)
    values.update(parcel_id=parcel["id"], parcel_number=number, cadastral_district_id=".".join(district.split(".")[:2]))
    if parcel["source"] == "Import użytkownika":
        return values, {"epsg": 2180, "source_id": "Import użytkownika", "method": "Geometria i identyfikator z pliku użytkownika",
                        "identity_verified": False}
    return values, {"url": parcel["source_url"], "fetched_at": parcel["retrieved_at"], "epsg": 2180}



def soil_retention(parcel, start, end):
    source = spatial.soil(parcel["geometry"])
    values = defaultdict(dict)
    for depth, layer in zip(source["layer_depths"], source["layers"], strict=True):
        if layer is not None:
            fc, wp = layer
            values["field_capacity"][depth] = fc / 1000
            values["wilting_point"][depth] = wp / 1000
            values["available_water_capacity"][depth] = fc - wp
    depths = values.get("field_capacity", {})
    return values, {"depth_top_cm": {d: int(d.split("-")[0]) for d in depths},
                    "depth_bottom_cm": {d: int(d.split("-")[1][:-2]) for d in depths},
                    "url": source["url"], "fetched_at": source["retrieved_at"], "source_version": "SoilGrids 2.0",
                    "spatial_resolution_m": 250, "potentials_kpa": [-33, -1500], "sampling": source["sampling"]}


def sentinel(parcel, start, end):
    source = spatial.satellite(parcel["geometry"], end, earth_search_only=True)
    scene = source["scene"]
    values = {}
    if scene and scene["date"] >= start.isoformat() and (
        not scene.get("publication_date") or scene["publication_date"][:10] <= end.isoformat()
    ):
        values = {**scene["passport_stats"], "s2_scene_id": scene["scene"]}
    return values, {"coverage_fraction": values["clear_pixel_pct"] / 100 if "clear_pixel_pct" in values else None,
                    "url": source["endpoint"], "fetched_at": source["retrieved_at"],
                    "observed_at": scene["date"] if values else None,
                    "available_at": scene.get("publication_date") if values else None,
                    "source_asset_id": scene["scene"] if values else None, "spatial_resolution_m": 20}


def meteo(parcel, url, daily, hourly, params, ttl):
    if os.environ.get("WODO_NONCOMMERCIAL_OPEN_METEO") != "1":
        raise SourceError("Open-Meteo wymaga WODO_NONCOMMERCIAL_OPEN_METEO=1 dla bezpłatnego użycia niekomercyjnego.")
    lon, lat = parcel["sample_point"]
    query = {
        "latitude": lat, "longitude": lon, "timezone": "GMT", "wind_speed_unit": "ms",
        "daily": ",".join(daily), "hourly": ",".join(hourly), **params,
    }
    source = cached("passport-meteo", [url, query], ttl, lambda: payload(url, query, timeout=15))
    return source, {"url": url, "fetched_at": source["retrieved_at"], "grid_point": [source["longitude"], source["latitude"]],
                    "source_version": params.get("models")}


def series(section, key):
    return {stamp: value for stamp, value in zip(section["time"], section[key], strict=True) if value is not None}


def hourly_mean(section, key):
    grouped = defaultdict(list)
    for stamp, value in series(section, key).items():
        grouped[stamp[:10]].append(value)
    return {day: mean(values) for day, values in grouped.items() if len(values) == 24}


def historical(parcel, start, end):
    daily = {
        "rain_sum": "rain_mm", "wind_gusts_10m_max": "wind_gust_max_m_s",
        "sunshine_duration": "sunshine_duration_h", "et0_fao_evapotranspiration": "et0_mm",
    }
    hourly = {
        "relative_humidity_2m": "relative_humidity_pct", "cloud_cover": "cloud_cover_pct",
        "vapour_pressure_deficit": "vpd_kpa", "snow_depth": "snow_depth_m",
    }
    # Reanalysis arrives with a delay. Only return observations within the requested window.
    last = min(end, date.today() - timedelta(days=6))
    if start > last:
        return {}, {"url": weather.OPEN_METEO}
    source, meta = meteo(parcel, weather.OPEN_METEO, [*daily, "precipitation_sum"], hourly,
                         {"start_date": start.isoformat(), "end_date": last.isoformat(), "models": "era5_land"}, 1)
    values = {field: series(source["daily"], key) for key, field in daily.items()}
    values.update({field: hourly_mean(source["hourly"], key) for key, field in hourly.items()})
    values["sunshine_duration_h"] = {day: seconds / 3600 for day, seconds in values["sunshine_duration_h"].items()}
    precip = series(source["daily"], "precipitation_sum")
    et0 = values["et0_mm"]
    balance = {d: precip[d] - et0[d] for d in precip.keys() & et0.keys()}
    for days in (30, 60):
        window = [(end - timedelta(days=i)).isoformat() for i in range(days)]
        if all(d in balance for d in window):
            values[f"climatic_water_balance_{days}d_mm"] = sum(balance[d] for d in window)
    return values, meta


def forecast(parcel, start, end):
    url = weather.OPEN_METEO_FORECAST
    if end != datetime.now(ZoneInfo("Europe/Warsaw")).date():
        return {}, {"url": url, "reason": "Bieżąca prognoza jest dostępna wyłącznie dla bieżącej daty analizy."}
    daily = {
        "precipitation_sum": "forecast_precipitation_mm",
        "precipitation_probability_max": "forecast_precip_probability_pct",
        "temperature_2m_max": "forecast_temp_max_c", "temperature_2m_min": "forecast_temp_min_c",
        "et0_fao_evapotranspiration": "forecast_et0_mm",
    }
    layers = [f"soil_moisture_{depth}cm" for depth in ("0_to_1", "1_to_3", "3_to_9", "9_to_27", "27_to_81")]
    source, meta = meteo(parcel, url, [*daily, "rain_sum", "showers_sum"], ["wind_speed_10m", "rain", "showers", *layers],
                         {"timezone": "Europe/Warsaw", "start_date": str(end),
                          "end_date": str(end + timedelta(days=6))}, 1 / 24)
    values = {field: series(source["daily"], key) for key, field in daily.items()}
    values["forecast_liquid_precipitation_mm"] = weather.liquid_rain(source["daily"], "rain_sum", "showers_sum")
    values["forecast_hourly_rain_mm"] = weather.liquid_rain(source["hourly"], "rain", "showers")
    values["forecast_wind_speed_m_s"] = series(source["hourly"], "wind_speed_10m")
    values["forecast_soil_moisture"] = {
        key: samples for key in layers if (samples := series(source["hourly"], key))
    }
    return values, meta


ADMIN = "GUGiK PRG"
ERA = "Copernicus CDS ERA5-Land"
FAO = "FAO 56 + dane pogodowe/glebowe"
SOIL = {"sand": "sand_pct", "silt": "silt_pct", "clay": "clay_pct", "phh2o": "soil_ph_h2o", "soc": "soc_g_kg"}
ERA_DAILY = {"precipitation_sum": "precipitation_mm", "temperature_2m_mean": "temp_mean_c",
             "temperature_2m_min": "temp_min_c", "temperature_2m_max": "temp_max_c",
             "shortwave_radiation_sum": "shortwave_radiation_mj_m2"}
ERA_HOURLY = {f"soil_moisture_{a}_to_{b}cm": f"soil_moisture_{a}_{b}_cm"
              for a, b in ((0, 7), (7, 28), (28, 100))}


def terrain_profile(parcel, start, end):
    local = transform(shape(parcel["geometry"]), geo.TO_PL, interleaved=False)
    west, south, east, north = local.bounds
    step = max(1, ceil(max(east - west, north - south) / 512))
    width = ceil((east - west) / step) + 4
    height = ceil((north - south) / step) + 4
    west -= 2 * step
    south -= 2 * step
    query = {"SERVICE": "WCS", "VERSION": "1.0.0", "REQUEST": "GetCoverage",
             "COVERAGE": "DTM_PL-KRON86-NH_TIFF", "FORMAT": "GEOTIFF", "CRS": "EPSG:2180",
             "WIDTH": width, "HEIGHT": height,
             "BBOX": f"{west},{south},{west + width * step},{south + height * step}"}

    def download():
        with MemoryFile(fetch(NMT, query, timeout=12, limit=4_000_000)) as file, file.open() as src:
            if src.crs is None or src.crs.to_epsg() != 2180 or src.shape != (height, width):
                raise SourceError("NMT zwrócił nieoczekiwaną siatkę.")
            z = src.read(1, masked=True).astype(float).filled(np.nan)
            inside = spatial.mask(local, src.transform, src.shape)
            valid = inside & np.isfinite(z)
            if not valid.any():
                raise SourceError("Brak pikseli NMT w granicy działki.")
            dy, dx = np.gradient(z, *reversed(src.res))
            slope = np.degrees(np.arctan(np.hypot(dx, dy)))
            values = {"elevation_mean_m": float(z[valid].mean())}
            if valid.sum() == inside.sum():
                values.update(hydro(z, src.transform, inside, local))
            slopes = slope[valid & np.isfinite(slope)]
            if slopes.size:
                values["slope_mean_deg"] = float(slopes.mean())
            return {"values": values, "coverage_fraction": float(valid.sum() / inside.sum())}

    data = cached("passport-nmt-depressions-v1", parcel["geometry"], 90, download)
    return data["values"], {"url": NMT, "vertical_datum": "PL-KRON86-NH", "depression_threshold_m": .25,
                            "depression_extent": "lokalny wycinek NMT z odpływem na krawędziach", "spatial_resolution_m": step,
                            "coverage_fraction": data["coverage_fraction"], "fetched_at": data["retrieved_at"]}


def administrative(parcel, start, end):
    values = {"municipality": parcel.get("commune"), "municipality_teryt": parcel["id"][:8].replace("_", "")}
    meta = {"url": parcel["source_url"], "fetched_at": parcel["retrieved_at"], "method": f"{parcel['source']} i prefiks EGiB"}
    params = {"request": "GetParcelById", "id": parcel["id"], "result": "id,county,voivodeship"}

    def download():
        lines = fetch(geo.ULDK, params, timeout=5, limit=4096).decode("utf-8-sig").strip().splitlines()
        if len(lines) != 2 or lines[0].strip() != "0":
            raise SourceError("Brak nazw jednostek administracyjnych w ULDK.")
        parts = lines[1].split("|")
        if len(parts) != 3 or parts[0] != parcel["id"]:
            raise SourceError("Niepełna odpowiedź administracyjna ULDK.")
        return {"county": parts[1] or None, "voivodeship": parts[2] or None}

    try:
        names = cached("passport-administration", params, 7, download)
        values.update(county=names["county"], voivodeship=names["voivodeship"])
    except SourceError as error:
        meta["reason"] = str(error)
    return values, meta


def texture(sand, silt, clay):
    total = sand + silt + clay
    if not 95 <= total <= 105:
        return None
    sand, silt, clay = (100 * x / total for x in (sand, silt, clay))
    if silt + 1.5 * clay < 15:
        return "sand"
    if silt + 2 * clay < 30:
        return "loamy sand"
    if clay >= 40 and silt >= 40:
        return "silty clay"
    if clay >= 35 and sand > 45:
        return "sandy clay"
    if clay >= 40:
        return "clay"
    if clay >= 27 and sand <= 20:
        return "silty clay loam"
    if clay >= 27 and sand <= 45:
        return "clay loam"
    if clay >= 20 and silt < 28 and sand > 45:
        return "sandy clay loam"
    if silt >= 80 and clay < 12:
        return "silt"
    if silt >= 50:
        return "silt loam"
    if clay >= 7 and silt >= 28 and sand <= 52:
        return "loam"
    return "sandy loam"


def soil_profile(parcel, start, end):
    polygon = shape(parcel["geometry"])
    w, s, e, n = polygon.bounds
    bounds = (w - .004, s - .003, e + .004, n + .003)

    def download():
        values = defaultdict(dict)
        sampling = {}
        with ThreadPoolExecutor(max_workers=5) as pool:
            jobs = {(prop, depth): pool.submit(spatial.soil_coverage, prop, depth, bounds, polygon)
                    for depth in (*spatial.WCS_DEPTHS, "100-200cm") for prop in SOIL}
            for (prop, depth), job in jobs.items():
                value, support = job.result()
                if value is not None:
                    values[SOIL[prop]][depth] = value / 10
                    sampling[f"{prop}/{depth}"] = support
        for depth in values.get("sand_pct", {}).keys() & values.get("silt_pct", {}).keys() & values.get("clay_pct", {}).keys():
            label = texture(values["sand_pct"][depth], values["silt_pct"][depth], values["clay_pct"][depth])
            if label:
                values["soil_texture_class"][depth] = label
        if not values:
            raise SourceError("Brak wartości właściwości gleby w SoilGrids WCS.")
        return {"values": values, "sampling": sampling}

    source = cached("passport-soil-profile", parcel["geometry"], 7, download)
    return source["values"], {"url": spatial.ISRIC, "spatial_resolution_m": 250, "source_version": "SoilGrids 2.0",
                              "sampling": source["sampling"], "texture_classification": "USDA", "fetched_at": source["retrieved_at"]}


def era_land(parcel, start, end):
    last = min(end, date.today() - timedelta(days=6))
    if last < start:
        return {}, {"url": weather.OPEN_METEO}
    source, meta = meteo(parcel, weather.OPEN_METEO, ERA_DAILY, ERA_HOURLY,
                         {"start_date": start.isoformat(), "end_date": last.isoformat(), "models": "era5_land"}, 1)
    values = {field: series(source["daily"], key) for key, field in ERA_DAILY.items()}
    values.update({field: hourly_mean(source["hourly"], key) for key, field in ERA_HOURLY.items()})
    rain = values["precipitation_mm"]
    for days in (7, 30):
        window = [(end - timedelta(days=i)).isoformat() for i in range(days)]
        if all(day in rain for day in window):
            values[f"precip_sum_{days}d_mm"] = sum(rain[day] for day in window)
    day = end
    while day.isoformat() in rain:
        if rain[day.isoformat()] >= 1:
            values["consecutive_dry_days"] = (end - day).days
            break
        day -= timedelta(days=1)
    if "precip_sum_30d_mm" in values:
        try:
            baseline = weather.open_meteo(*parcel["sample_point"])["rows"]
        except SourceError:
            baseline = {}
        totals = []
        for n in range(1, 11):
            prior = years_ago(end, n)
            dates = [(prior - timedelta(days=i)).isoformat() for i in range(30)]
            if all(d in baseline and baseline[d][0] is not None for d in dates):
                totals.append(sum(baseline[d][0] for d in dates))
        if len(totals) == 10:
            values["precip_anomaly_30d_mm"] = values["precip_sum_30d_mm"] - mean(totals)
    return values, {**meta, "method": "ERA5-Land przez Open-Meteo, doby UTC, próg suchego dnia <1 mm"}


WORKERS = {
    BDOT: bdot_distances, CLMS: crop_layers,
    "GUGiK NMT": terrain_profile,
    ADMIN: administrative, ERA: era_land, "ISRIC SoilGrids": soil_profile,
    "GUGiK EGiB": egib,
    "ISRIC SoilGrids / funkcje pedotransferowe": soil_retention,
    "Sentinel-2 L2A / Earth Search": sentinel,
    "Open-Meteo Historical API / ERA5-Land": historical,
    "Open-Meteo Forecast API": forecast,
}

SUPPORTED_FIELDS = {
    BDOT: {"nearest_stream_distance_m", "nearest_ditch_distance_m", "nearest_pond_distance_m"},
    CLMS: {"crop_type_clms", "crop_type_confidence_pct"},
    "GUGiK NMT": {"elevation_mean_m", "slope_mean_deg", "flow_direction_raster_uri", "flow_accumulation_raster_uri",
                  "potential_depression_area_m2", "potential_depression_volume_m3", "potential_depression_geometry"},
    ADMIN: {"municipality", "voivodeship", "county", "municipality_teryt"},
    ERA: {*ERA_DAILY.values(), *ERA_HOURLY.values(), "precip_sum_7d_mm", "precip_sum_30d_mm", "consecutive_dry_days", "precip_anomaly_30d_mm",
          "soil_moisture_100_289_cm", "soil_moisture_percentile"},
    "ISRIC SoilGrids": {*SOIL.values(), "soil_texture_class"},
    FAO: {"root_zone_taw_mm", "root_zone_raw_mm", "root_zone_depletion_mm", "crop_et_mm", "historical_drought_frequency_pct"},
    "GUGiK EGiB": set("""
        parcel_id parcel_number parcel_geometry parcel_area_ha parcel_perimeter_m
        centroid_lat centroid_lon compactness cadastral_district_id
    """.split()),
    "ISRIC SoilGrids / funkcje pedotransferowe": {"field_capacity", "wilting_point", "available_water_capacity"},
    "Sentinel-2 L2A / Earth Search": set("""
        s2_scene_id clear_pixel_pct ndvi_mean ndvi_p10 ndvi_p90 ndvi_std ndmi_mean ndmi_p10 ndmi_std
        ndwi_mean mndwi_mean s2_rgb_asset_uri valid_pixel_count ndvi_anomaly ndmi_anomaly
    """.split()),
    "Open-Meteo Historical API / ERA5-Land": set("""
        rain_mm relative_humidity_pct wind_gust_max_m_s sunshine_duration_h cloud_cover_pct et0_mm
        vpd_kpa snow_depth_m climatic_water_balance_30d_mm climatic_water_balance_60d_mm
    """.split()),
    "Open-Meteo Forecast API": set("""
        forecast_precipitation_mm forecast_precip_probability_pct forecast_temp_max_c forecast_temp_min_c
        forecast_et0_mm forecast_wind_speed_m_s forecast_soil_moisture forecast_hourly_rain_mm forecast_liquid_precipitation_mm
    """.split()),
}
