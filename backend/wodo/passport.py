"""Build a parcel passport from the catalogue when requested."""

import csv
import json
import logging
from collections import defaultdict
from concurrent.futures import FIRST_COMPLETED, wait
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from time import monotonic

from wodo.analysis import PROVIDERS
from wodo.passport_layers import BDOT, CLMS, anomalies, basin_flow, soil_history
from wodo.passport_sources import ADMIN, ERA, FAO, SUPPORTED_FIELDS, WORKERS
from wodo.science import CROPS, assess, bucket, dates, phenology, retention, years_ago
from wodo.spatial import WCS_DEPTHS
from wodo.store import SourceError
from wodo.weather import nasa

CATALOG = Path(__file__).resolve().parents[2] / "docs/paszport_pola_katalog_danych.csv"
PIPELINE = "Własny pipeline"
METHOD_VERSION = "passport-1"

LOG = logging.getLogger(__name__)
COLLECT_BUDGET_S = 24  # jak w analizie (wodo/analysis.py): źródła po terminie trafiają do braków
PROGRESS_LABELS = {
    BDOT: "Hydrologia", CLMS: "Uprawy", "GUGiK NMT": "Teren", ADMIN: "Granice administracyjne",
    ERA: "Gleba (ERA5-Land)", "ISRIC SoilGrids": "Gleba", "GUGiK EGiB": "Ewidencja działek",
    "ISRIC SoilGrids / funkcje pedotransferowe": "Retencja glebowa", "Sentinel-2 L2A / Earth Search": "Sentinel-2",
    "Open-Meteo Historical API / ERA5-Land": "Pogoda", "Open-Meteo Forecast API": "Prognoza pogody",
}


def load_catalog():
    groups = defaultdict(list)
    with CATALOG.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file, delimiter=";"):
            groups[row["zrodlo"]].append(row)
    return groups


def water_balance(results, end, crop_key, sowing, stage, irrigation_mm, history=None):
    if not crop_key:
        return {}, {"reason": "Wybierz uprawę, aby obliczyć bilans wodny."}, None
    soil = results.get("ISRIC SoilGrids / funkcje pedotransferowe", ({}, {}, None))[0]
    fc, wp = soil.get("field_capacity", {}), soil.get("wilting_point", {})
    layers = [(fc[d] * 1000, wp[d] * 1000) if d in fc and d in wp else None for d in WCS_DEPTHS]
    crop = CROPS[crop_key]
    values = {}
    meta = {"fetched_at": datetime.now(UTC).isoformat(), "crop": crop_key, "sowing": sowing.isoformat() if sowing else None, "stage": stage,
            "irrigation_mm_on_analysis_day": irrigation_mm, "url": "https://www.fao.org/4/X0490E/X0490E00.htm",
            "method": "FAO-56, SoilGrids 33/1500 kPa, pogoda ERA5-Land przez Open-Meteo"}
    taw = retention(layers, crop.root_m)
    if taw is not None:
        values.update(root_zone_taw_mm=taw, root_zone_raw_mm=taw * crop.p)
    era = results.get(ERA, ({}, {}, None))[0]
    archive = results.get("Open-Meteo Historical API / ERA5-Land", ({}, {}, None))[0]
    et0 = archive.get("et0_mm", {})
    rain = era.get("precipitation_mm", {})
    rows = {d: [rain[d], et0[d], era.get("temp_mean_c", {}).get(d)] for d in rain.keys() & et0.keys()}
    if history and end.isoformat() not in rows:
        rows = history["rows"]
        et0 = {d: row[1] for d, row in rows.items() if row[1] is not None}
        meta["weather_source"] = history["name"]
        meta["weather_url"] = history["url"]
    stage_id, kc = phenology(crop, end, sowing, stage)
    if stage_id != 4 and end.isoformat() in et0:
        values["crop_et_mm"] = kc * et0[end.isoformat()]
    if taw and end.isoformat() in rows:
        result = assess(rows, {"layers": layers}, crop_key, end, sowing, stage, irrigation_mm)
        if root := result["root"]:
            low = root["initially_wet"]["depletion_mm"]
            high = root["initially_dry"]["depletion_mm"]
            values["root_zone_depletion_mm"] = low
            meta.update(initial_condition="pełny zapas wody", uncertainty={"depletion_range_mm": [low, high]})
    if taw and history:
        seasons = []
        seasonal_unmet = {}
        episodes = []
        for year in range(end.year - 10, end.year):
            first = date(year, *crop.start)
            days = list(dates(first, first + timedelta(days=sum(crop.stages) - 1)))
            records = [history["rows"].get(d.isoformat()) for d in days]
            if all(row and None not in row[:2] for row in records):
                inputs = [(row[0], row[1] * phenology(crop, d)[1], 0) for row, d in zip(records, days, strict=True)]
                # A season crosses RAW if modelled uptake is reduced by water stress.
                deficits = []
                unmet = bucket(taw, taw, crop.p, inputs, daily_unmet=deficits)["unmet_mm"]
                episode = None
                for day, deficit in zip(days, deficits, strict=True):
                    if deficit <= 0:
                        episode = None
                        continue
                    if episode is None:
                        episode = {"start": str(day), "duration_days": 0, "unmet_mm": 0.0}
                        episodes.append(episode)
                    episode.update(end=str(day), duration_days=episode["duration_days"] + 1,
                                   unmet_mm=episode["unmet_mm"] + deficit)
                seasonal_unmet[str(year)] = unmet
                seasons.append(unmet > 0)
        if len(seasons) == 10:
            values["historical_drought_frequency_pct"] = 100 * sum(seasons) / len(seasons)
            meta["historical_scenario"] = {"episodes": episodes, "unmet_et_mm_by_season": seasonal_unmet, "years": [end.year - 10, end.year - 1], "weather": history["name"],
                                           "criterion": "ET niezaspokojona >0 mm, stała uprawa, pełny zapas na start sezonu, bez nawadniania"}
    return values, meta, None


def add_nasa_fallback(results, history, start, end):
    rows = history["rows"]
    window = {d: row for d, row in rows.items() if str(start) <= d <= str(end)}
    precipitation = {d: row[0] for d, row in window.items() if row[0] is not None}
    et0 = {d: row[1] for d, row in window.items() if row[1] is not None}
    values = {
        ERA: {"precipitation_mm": precipitation,
              "temp_mean_c": {d: row[2] for d, row in window.items() if row[2] is not None}},
        "Open-Meteo Historical API / ERA5-Land": {"et0_mm": et0},
    }
    for index, name in enumerate(("temp_min_c", "temp_max_c", "shortwave_radiation_mj_m2"), start=3):
        values[ERA][name] = {day: row[index] for day, row in window.items() if len(row) > index and row[index] is not None}
    for days in (7, 30, 60):
        dates = [str(end - timedelta(days=i)) for i in range(days)]
        if not all(d in precipitation for d in dates):
            continue
        rain = sum(precipitation[d] for d in dates)
        if days in (7, 30):
            values[ERA][f"precip_sum_{days}d_mm"] = rain
        if days in (30, 60) and all(d in et0 for d in dates):
            values["Open-Meteo Historical API / ERA5-Land"][f"climatic_water_balance_{days}d_mm"] = (
                rain - sum(et0[d] for d in dates))
    day = end
    while (stamp := str(day)) in precipitation:
        if precipitation[stamp] >= 1:
            values[ERA]["consecutive_dry_days"] = (end - day).days
            break
        day -= timedelta(days=1)
    if "precip_sum_30d_mm" in values[ERA]:
        baseline = []
        for year in range(1, 11):
            comparable = years_ago(end, year)
            days = [str(comparable - timedelta(days=i)) for i in range(30)]
            if all(d in rows and rows[d][0] is not None for d in days):
                baseline.append(sum(rows[d][0] for d in days))
        if len(baseline) == 10:
            values[ERA]["precip_anomaly_30d_mm"] = values[ERA]["precip_sum_30d_mm"] - sum(baseline) / 10
    for source, fields in values.items():
        existing, meta, error = results.get(source, ({}, {}, None))
        for name, value in fields.items():
            if value != {} and existing.get(name) in (None, {}):
                existing[name] = value
                meta.setdefault("field_sources", {})[name] = {
                    "source_id": history["name"], "url": history["url"], "fetched_at": history.get("retrieved_at"),
                    "resolution": history.get("resolution"), "method": "Zastępcze dane NASA POWER"}
        results[source] = existing, meta, error


def collect(parcel, end, crop=None, sowing=None, stage=None, irrigation_mm=0, on_progress=None, budget=COLLECT_BUDGET_S):
    """on_progress(done, total, label) jest wołane po każdym ukończonym źródle (z wątku wywołującego)."""
    start = end - timedelta(days=364)
    groups = load_catalog()
    tasks = {PROVIDERS.submit(worker, parcel, start, end): source
             for source, worker in WORKERS.items()
             if source in groups and (source != ADMIN or parcel.get("source") != "Import użytkownika")}
    supplements = {PROVIDERS.submit(worker, parcel, start, end): (source, names)
                   for source, worker, names in (
                       (ERA, soil_history, ("soil_moisture_100_289_cm", "soil_moisture_percentile")),
                       ("GUGiK NMT", basin_flow, ("flow_direction_raster_uri", "flow_accumulation_raster_uri")),
                   ) if source in groups}
    historical = PROVIDERS.submit(nasa, *parcel["sample_point"]) if ERA in groups and "sample_point" in parcel else None
    labels = {**{f: PROGRESS_LABELS.get(source, source) for f, source in tasks.items()},
              **{f: PROGRESS_LABELS.get(source, source) for f, (source, _) in supplements.items()}}
    if historical:
        labels[historical] = "Pogoda historyczna"
    done, pending, deadline = set(), set(labels), monotonic() + budget
    while pending and (remaining := deadline - monotonic()) > 0:
        finished, pending = wait(pending, timeout=remaining, return_when=FIRST_COMPLETED)
        for future in finished:
            done.add(future)
            if on_progress:
                on_progress(len(done), len(labels), labels[future])
    history = None
    if historical:
        if historical in done:
            done.remove(historical)
            try:
                history = historical.result()
            except Exception:
                LOG.info("Brak historii pogody dla modelu FAO-56", exc_info=True)
        else:
            pending.discard(historical)
            historical.cancel()
    results = {}
    for task in pending.intersection(tasks):
        task.cancel()
        results[tasks[task]] = {}, {}, "Przekroczono czas oczekiwania na źródło."
    for task in done.intersection(tasks):
        source = tasks[task]
        try:
            values, metadata = task.result()
            results[source] = values, metadata, None
        except SourceError as error:
            results[source] = {}, {}, str(error)
        except Exception:
            LOG.exception("Failure in passport source %s", source)
            results[source] = {}, {}, "Źródło zwróciło dane w nieobsługiwanym formacie."

    for future, (source, names) in supplements.items():
        values, meta, error = results.get(source, ({}, {}, None))
        details = meta.setdefault("field_details", {})
        try:
            if future not in done:
                future.cancel()
                raise SourceError("Przekroczono czas oczekiwania na warstwę.")
            extra, provenance = future.result()
            for name, value in extra.items():
                if value is not None and value != {}:
                    values[name] = value
                    meta.setdefault("field_sources", {})[name] = provenance
        except Exception as exc:
            LOG.info("Brak warstwy %s", source, exc_info=False)
            details.update(dict.fromkeys(names, str(exc) if isinstance(exc, SourceError) else "Błąd warstwy źródłowej."))
        results[source] = values, meta, error
    satellite_source = "Sentinel-2 L2A / Earth Search"
    if satellite_source in results:
        values, meta, _ = results[satellite_source]
        try:
            values.update(anomalies(parcel, end, crop, sowing, stage, values, meta))
        except (OSError, ValueError, KeyError):
            LOG.warning("Niepoprawna referencja Sentinel-2.")
        for name in ("ndvi_anomaly", "ndmi_anomaly"):
            if name not in values:
                meta.setdefault("field_details", {})[name] = "Brak porównywalnej sceny lub trzech sezonów referencyjnych."
    if parcel.get("source") == "Import użytkownika" and "GUGiK EGiB" in results:
        values, metadata, _ = results["GUGiK EGiB"]
        if values:
            source = parcel["source"]
            rows = groups["GUGiK EGiB"]
            groups[source] = [
                {**row, "url_pobrania_lub_katalogu": "", "url_dokumentacji": ""}
                for row in rows if row["pole_db"] in values
            ]
            groups["GUGiK EGiB"] = [row for row in rows if row["pole_db"] not in values]
            results[source] = values, metadata, None
            del results["GUGiK EGiB"]
    results[FAO] = water_balance(results, end, crop, sowing, stage, irrigation_mm, history)
    if history:
        add_nasa_fallback(results, history, start, end)
    if parcel.get("source") == "Import użytkownika" and (parcel.get("commune") or parcel.get("declared_parcel_id")):
        admin = {"municipality": parcel.get("commune")}
        if parcel.get("declared_parcel_id"):
            admin["municipality_teryt"] = parcel["declared_parcel_id"][:8].replace("_", "")
        results[ADMIN] = admin, {"source_id": "Import użytkownika", "method": "Nazwa gminy i prefiks identyfikatora z pliku użytkownika",
                                                              "identity_verified": False}, None

    if ADMIN in results and (code := results[ADMIN][0].get("municipality_teryt")):
        values, meta, _ = results[ADMIN]
        terc = json.loads(Path(__file__).with_name("terc_counties.json").read_text(encoding="utf-8"))
        for field, prefix in (("county", code[:4]), ("voivodeship", code[:2])):
            if not values.get(field) and prefix in terc["names"]:
                values[field] = terc["names"][prefix]
                meta.setdefault("field_sources", {})[field] = {
                    "source_id": "GUS TERC", "source_version": terc["date"], "url": terc["source"],
                    "method": "Nazwa według prefiksu identyfikatora EGiB",
                    "identity_verified": parcel.get("source") != "Import użytkownika"}

    provenance = {"analysis_as_of": end.isoformat(), "method_version": METHOD_VERSION}
    for key in ("source_version", "observed_at", "available_at", "fetched_at", "spatial_resolution_m",
                "source_asset_id", "coverage_fraction", "uncertainty", "grid_cell_id", "depth_top_cm", "depth_bottom_cm",
                "forecast_issued_at"):
        provenance[key] = {source: meta[key] for source, (_, meta, _) in results.items() if meta.get(key) is not None}
        for source, (values, meta, _) in results.items():
            for field, details in meta.get("field_sources", {}).items():
                if field in values and details.get(key) is not None:
                    provenance[key][f"{source}/{field}"] = details[key]
    provenance["source_id"] = {source: source for source in results}
    provenance["quality_status"] = {
        source: "error" if error else "partial" if values else "missing"
        for source, (values, _, error) in results.items()
    }
    results[PIPELINE] = provenance, {}, None
    return {"parcel_id": parcel["id"], "date_from": start, "analysis_as_of": end,
            "fields": list(fields_for(groups, results, end))}


def fields_for(groups, results, end):
    assembled = datetime.now(UTC).isoformat()
    for source, fields in groups.items():
        values, metadata, error = results.get(source, ({}, {}, None))
        for row in fields:
            field = row["pole_db"]
            value = values.get(field)
            detail = metadata.get("field_details", {}).get(field) or error or metadata.get("reason")
            if value is not None and value != {}:
                status, detail = "ok", None
            elif source != PIPELINE and field not in SUPPORTED_FIELDS.get(source, ()):
                status, detail = "unsupported", row["metoda_pozyskania_krajowego"]
            elif error:
                status = "error"
            else:
                status = "missing"
            provenance = {"source_id": source, **metadata, "analysis_as_of": end.isoformat(),
                          "method_version": METHOD_VERSION, "quality_status": status}
            provenance.pop("field_details", None)
            supplement = provenance.pop("field_sources", {}).get(field)
            if supplement:
                provenance = {"source_id": source, **supplement, "analysis_as_of": end.isoformat(),
                              "method_version": METHOD_VERSION, "quality_status": status}
            if not provenance.get("url") and provenance.get("identity_verified") is not False:
                provenance["url"] = row["url_pobrania_lub_katalogu"] or row["url_dokumentacji"] or None
            provenance["assembled_at"] = assembled
            yield {"field": field, "label": row["nazwa_pl"], "source": source, "table": row["tabela_docelowa"],
                   "sql_type": row["typ_sql"], "unit": row["jednostka"] or None, "status": status,
                   "value": value if status == "ok" else None, "detail": detail, "provenance": provenance}


def farmer_questions():
    path = CATALOG.with_name("paszport_pola_15_danych_od_rolnika.csv")
    with path.open(encoding="utf-8-sig", newline="") as file:
        return [
            {"field": row["pole_db"], "label": row["nazwa_pl"], "question": row["pytanie_do_rolnika"],
             "format": row["format_lub_opcje_odpowiedzi"], "table": row["tabela_docelowa"],
             "sql_type": row["typ_sql"], "source": row["zrodlo"], "unit": row["jednostka"] or None}
            for row in csv.DictReader(file, delimiter=";")
        ]
