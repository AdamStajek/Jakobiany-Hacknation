import csv
import io
import os
import unicodedata
import zipfile
from collections import defaultdict
from datetime import date
from math import isfinite

from pyproj import Geod

from wodo.science import et0_fao56, et0_hargreaves
from wodo.store import IMGW, NASA, SourceError, cached, fetch, payload

GEOD = Geod(ellps="WGS84")
IMGW_NOTICE = "Dane Instytutu Meteorologii i Gospodarki Wodnej – Państwowego Instytutu Badawczego zostały przetworzone."
PARAMETERS = ("PRECTOTCORR", "T2M", "T2M_MIN", "T2M_MAX", "T2MDEW", "WS2M", "ALLSKY_SFC_SW_DWN")
ARCHIVE = "https://danepubliczne.imgw.pl/data/dane_pomiarowo_obserwacyjne/dane_meteorologiczne/dobowe/synop/"
OPEN_METEO = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAILY = {
    "et0_fao_evapotranspiration": "et0",
    "precipitation_probability_max": "probability", "temperature_2m_max": "temperature", "wind_speed_10m_max": "wind",
}


def number(value):
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if isfinite(result) and result not in (-999, -9999) else None


def liquid_rain(section, rain_key, showers_key):
    rain = {}
    for stamp, widespread, convective in zip(section["time"], section[rain_key], section[showers_key], strict=True):
        widespread, convective = number(widespread), number(convective)
        if widespread is not None and convective is not None and min(widespread, convective) >= 0:
            rain[stamp] = widespread + convective
    return rain


def forecast_rows(daily, hourly_rain):
    rows = defaultdict(dict)
    for name, series in daily.items():
        for day, value in series.items():
            value = number(value)
            if value is not None and (name == "temperature" or value >= 0) and (name != "probability" or value <= 100):
                rows[day][name] = value
    for stamp, value in hourly_rain.items():
        if (value := number(value)) is not None and value >= 0:
            row = rows[stamp[:10]]
            row["hourly_rain_max"] = max(row.get("hourly_rain_max", 0), value)
    return dict(rows)


def forecast(lon, lat, day):
    if os.environ.get("WODO_NONCOMMERCIAL_OPEN_METEO") != "1":
        raise SourceError("Włącz WODO_NONCOMMERCIAL_OPEN_METEO=1 przy bezpłatnym użyciu niekomercyjnym prognozy.")
    query = {"latitude": lat, "longitude": lon, "timezone": "Europe/Warsaw", "wind_speed_unit": "ms",
             "forecast_days": 4, "daily": ",".join((*FORECAST_DAILY, "rain_sum", "showers_sum")), "hourly": "rain,showers"}

    def download():
        data = payload(OPEN_METEO_FORECAST, query, timeout=7)
        daily, hourly = data["daily"], data["hourly"]
        series = {name: dict(zip(daily["time"], daily[key], strict=True)) for key, name in FORECAST_DAILY.items()}
        series["rain"] = liquid_rain(daily, "rain_sum", "showers_sum")
        rows = forecast_rows(series, liquid_rain(hourly, "rain", "showers"))
        if not any(rows.values()):
            raise SourceError("Prognoza nie zawiera użytecznych danych przez najbliższe dni.")
        return {"name": "Open-Meteo Forecast API", "url": OPEN_METEO_FORECAST, "kind": "prognoza",
                "resolution": "punkt siatki modelu pogodowego dla lokalizacji pola",
                "coverage": [min(rows), max(rows)], "publication_date": None, "rows": rows}

    return cached("recommendation-forecast-v2", [day.isoformat(), query], 1 / 24, download)


def nasa(lon, lat):
    today = date.today()
    first = date(today.year - 21, 1, 1)
    params = {"latitude": lat, "longitude": lon, "start": first.strftime("%Y%m%d"),
              "end": today.strftime("%Y%m%d"), "parameters": ",".join(PARAMETERS), "community": "AG",
              "time-standard": "UTC", "format": "JSON"}

    def download():
        data = payload(NASA, params, timeout=7)
        values = data["properties"]["parameter"]
        if data["parameters"][PARAMETERS[-1]]["units"] != "MJ/m^2/day":
            raise SourceError("NASA POWER zwrócił nieoczekiwane jednostki promieniowania.")
        elev = data["geometry"]["coordinates"][2]
        rows = {}
        fallback_days = []
        for stamp in values[PARAMETERS[0]]:
            d = date(int(stamp[:4]), int(stamp[4:6]), int(stamp[6:]))
            rain, temp, low, high, dew, wind, solar = (number(values[key].get(stamp)) for key in PARAMETERS)
            et = None
            if None not in (temp, low, high, dew, wind, solar) and wind >= 0 and solar >= 0:
                et = round(et0_fao56(d, lat, elev, temp, low, high, dew, wind, solar), 3)
            elif None not in (temp, low, high) and (today - d).days <= 100:
                et = round(et0_hargreaves(d, lat, temp, low, high), 3)
                fallback_days.append(d.isoformat())
            rows[d.isoformat()] = [rain if rain is not None and rain >= 0 else None, et, temp, low, high, solar]
        if not any(None not in row[:2] for row in rows.values()):
            raise SourceError("Brak wspólnych dni z opadem i ET₀.")
        return {"name": "NASA POWER / MERRA-2, GEOS i CERES", "url": NASA, "kind": "reanaliza i dane satelitarne",
                "resolution": "0,5° × 0,625° meteorologia, 1° promieniowanie", "coverage": [min(rows), max(rows)],
                "parameters": params, "provider_version": data["header"]["api"]["version"],
                "publication_date": None, "et0_fallback_days": fallback_days, "rows": rows}

    return cached("nasa-extrema-v1", [lon, lat], .33, download)


def open_meteo(lon, lat):
    today = date.today()
    fields = ("precipitation_sum", "et0_fao_evapotranspiration", "temperature_2m_mean")
    params = {"latitude": lat, "longitude": lon, "start_date": date(today.year - 21, 1, 1).isoformat(),
              "end_date": today.isoformat(), "daily": ",".join(fields), "models": "era5_land", "timezone": "GMT"}

    def download():
        daily = payload(OPEN_METEO, params, timeout=7)["daily"]
        rows = dict(zip(daily["time"], map(list, zip(*(daily[key] for key in fields), strict=True)), strict=True))
        return {"name": "Open-Meteo / ERA5-Land", "url": OPEN_METEO, "kind": "reanaliza",
                "resolution": "około 11 km", "coverage": [min(rows), max(rows)],
                "publication_date": None, "parameters": params, "rows": rows}

    return cached("open-meteo", [lon, lat], .33, download)


def history(lon, lat):
    try:
        return nasa(lon, lat)
    except SourceError:
        if os.environ.get("WODO_NONCOMMERCIAL_OPEN_METEO") == "1":
            return open_meteo(lon, lat)
        raise


def normalize(name):
    name = name.replace("ł", "l").replace("Ł", "L").strip().lower()
    return "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c))


def imgw_feed(feed):
    base = IMGW + feed + ("/" if feed != "synop" else "")
    return cached(f"imgw-{feed}", [], 1 / 48, lambda: {"items": payload(base, timeout=5), "url": base})


def nearest(items, lon, lat):
    ranked = []
    for item in items:
        x, y = number(item.get("lon")), number(item.get("lat"))
        if x is not None and y is not None and 13 <= x <= 25 and 48 <= y <= 56:
            distance = GEOD.inv(lon, lat, x, y)[2] / 1000
            ranked.append((distance, item))
    return sorted(ranked, key=lambda item: item[0])


def station(lon, lat, day):
    meteo = imgw_feed("meteo")
    closest = nearest(meteo["items"], lon, lat)
    if not closest or closest[0][0] > 50:
        raise SourceError("Brak stacji meteorologicznej IMGW w promieniu 50 km.")
    distance, item = closest[0]
    result = {"name": "IMGW-PIB / stacje", "url": meteo["url"], "kind": "obserwacja punktowa", "attribution": IMGW_NOTICE,
              "resolution": "punkt", "station": item["nazwa_stacji"], "distance_km": round(distance, 1),
              "publication_date": None, "retrieved_at": meteo["retrieved_at"], "cached": meteo["cached"]}
    if day == date.today():
        result["observations"] = [{"label": label, "value": number(item.get(key)), "date": item.get(timestamp)}
                                  for key, timestamp, label in (("opad_10min", "opad_10min_data", "Opad 10 min [mm]"),
                                      ("temperatura_powietrza", "temperatura_powietrza_data", "Temperatura [°C]"))
                                  if number(item.get(key)) is not None and str(item.get(timestamp)).startswith(day.isoformat())]
    else:
        synop = imgw_feed("synop")
        codes = {normalize(row["stacja"]): row["id_stacji"][-3:] for row in synop["items"]}
        archive_candidates = [(distance, s, codes[normalize(s["nazwa_stacji"])]) for distance, s in closest
                              if distance <= 50 and normalize(s["nazwa_stacji"]) in codes]
        for distance, s, code in archive_candidates[:2]:
            url = f"{ARCHIVE}{day.year}/{day.year}_{code}_s.zip"
            try:
                data = cached("imgw-daily", url, 30, lambda url=url: archive_station(url))
            except SourceError:
                continue
            if sample := data["rows"].get(day.isoformat()):
                observations = [{"label": label, "value": val, "date": day.isoformat()}
                                for label, val in sample if val is not None]
                if observations:
                    result.update(station=s["nazwa_stacji"], distance_km=round(distance, 1), url=url,
                                  cached=data["cached"], retrieved_at=data["retrieved_at"], observations=observations)
                    break
    return result


def archive_station(url):
    raw = fetch(url, timeout=4, limit=500_000)
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as files:
            file = next(info for info in files.infolist() if info.filename.startswith("s_d_")
                        and not info.filename.startswith("s_d_t_") and info.file_size < 2_000_000)
            rows = {}
            for row in csv.reader(files.read(file).decode("cp1250").splitlines()):
                if len(row) >= 15:
                    stamp = f"{row[2]}-{row[3]}-{row[4]}"
                    rows[stamp] = [["Opad dobowy [mm]", number(row[13]) if not row[14].strip() else None],
                                   ["Średnia temperatura [°C]", number(row[9]) if not row[10].strip() else None]]
            return {"rows": rows}
    except (zipfile.BadZipFile, StopIteration, UnicodeError) as error:
        raise SourceError("Archiwum stacji IMGW jest nieczytelne.") from error


def gauge(lon, lat, day):
    if day != date.today():
        raise SourceError("Bieżące odczyty IMGW są wyłączone dla dat historycznych.")
    feed = imgw_feed("hydro")
    valid = [row for row in feed["items"] if str(row.get("stan_wody_data_pomiaru")).startswith(day.isoformat())
             and number(row.get("stan_wody")) is not None]
    ranked = nearest(valid, lon, lat)
    if not ranked or ranked[0][0] > 50:
        raise SourceError("Brak aktualnego wodowskazu w promieniu 50 km.")
    distance, row = ranked[0]
    return {"name": "IMGW-PIB / wodowskazy", "url": feed["url"], "kind": "obserwacja punktowa", "attribution": IMGW_NOTICE,
            "station": row["stacja"], "river": row["rzeka"], "gauge_cm": number(row["stan_wody"]),
            "warning_cm": number(row.get("stan_ostrzegawczy")), "distance_km": round(distance, 1),
            "resolution": "punkt", "publication_date": row["stan_wody_data_pomiaru"],
            "retrieved_at": feed["retrieved_at"], "cached": feed["cached"]}
