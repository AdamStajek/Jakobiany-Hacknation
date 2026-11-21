import logging
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import date, datetime, timedelta
from statistics import median
from time import monotonic
from zoneinfo import ZoneInfo

from wodo.recommendations import recommendations
from wodo.science import (
    CROPS,
    STAGES,
    UNKNOWN_CROP,
    assess,
    bucket,
    phenology,
    retention,
    years_ago,
)
from wodo.spatial import satellite_history, soil, terrain, worldcover
from wodo.store import SourceError
from wodo.weather import forecast, gauge, history, station

LOG = logging.getLogger(__name__)
PROVIDERS = ThreadPoolExecutor(max_workers=14)
SOURCE_LABELS = {
    "weather": "Pogoda wieloletnia", "station": "Stacja meteorologiczna IMGW", "soil": "Retencja glebowa",
    "satellite": "Sentinel-2", "terrain": "Ukształtowanie terenu", "land": "Pokrycie terenu i wody powierzchniowe",
    "gauge": "Wodowskaz IMGW", "forecast": "Prognoza pogody Open-Meteo",
}


def run(parcel, request, on_progress=None):
    """on_progress(done, total, label) wołane po każdym źródle (z wątku wywołującego run)."""
    geom = parcel["geometry"]
    lon, lat = parcel["sample_point"]
    day = request.day
    jobs = {"weather": (history, lon, lat), "station": (station, lon, lat, day), "soil": (soil, geom),
            "satellite": (satellite_history, geom, day), "terrain": (terrain, geom), "land": (worldcover, geom)}
    if day == date.today():
        jobs["gauge"] = (gauge, lon, lat, day)
    if day == datetime.now(ZoneInfo("Europe/Warsaw")).date():
        jobs["forecast"] = (forecast, lon, lat, day)
    tasks = {PROVIDERS.submit(fn, *args): key for key, (fn, *args) in jobs.items()}
    total, finished = len(tasks), set()
    deadline, pending = monotonic() + 24, set(tasks)
    while pending and (left := deadline - monotonic()) > 0:
        newly, pending = wait(pending, timeout=left, return_when=FIRST_COMPLETED)
        finished |= newly
        for task in newly:
            if on_progress:
                on_progress(len(finished) - len(newly) + list(newly).index(task) + 1, total, SOURCE_LABELS[tasks[task]])
    done = finished
    inputs, missing = {}, {}
    if "forecast" not in jobs:
        missing[SOURCE_LABELS["forecast"]] = "Bieżąca prognoza jest dostępna w analizie dzisiejszej daty."
    for task in pending:
        task.cancel()
        missing[SOURCE_LABELS[tasks[task]]] = "Przekroczono czas oczekiwania na źródło."
    for task in done:
        key = tasks[task]
        try:
            inputs[key] = task.result()
        except SourceError as error:
            missing[SOURCE_LABELS[key]] = str(error)
        except Exception:
            LOG.exception("Failure in %s", key)
            missing[SOURCE_LABELS[key]] = "Źródło zwróciło dane w nieobsługiwanym formacie."
    rows = inputs.get("weather", {}).get("rows", {})
    metrics = assess(rows, inputs.get("soil"), request.crop, day, request.sowing, request.stage, request.irrigation_mm)
    sat = inputs.get("satellite")
    if sat and not sat["scene"]:
        missing["Sentinel-2"] = "Brak sceny z minimum 60% użytecznych pikseli w granicach działki lub brak sceny w okresie."
    if not inputs.get("station", {}).get("observations"):
        missing.setdefault("Stacja meteorologiczna IMGW", "Brak kompletnego odczytu w pobliżu dla wybranej daty.")
    fallback_days = [d for d in inputs.get("weather", {}).get("et0_fallback_days", []) if d <= day.isoformat()]
    if fallback_days and fallback_days[-1] >= (day - timedelta(days=30)).isoformat():
        missing["Metoda ET₀"] = "W części ostatnich dni promieniowanie było niedostępne. Użyto uproszczenia Hargreavesa (FAO-56)."
    if metrics["weather_last_day"] != day.isoformat():
        missing["Pogoda w dniu analizy"] = "Brak opadu i ET₀ dla całej doby. Ostatni pełny dzień: " + (
            metrics["weather_last_day"] or "brak")
    scene = sat["scene"] if sat else None
    stage_at_scene = None
    unknown_crop = request.crop == UNKNOWN_CROP
    if unknown_crop:
        missing["Rodzaj uprawy"] = ("Nie podano uprawy. Użyto ogólnych parametrów (ET₀ trawy referencyjnej, strefa korzeni 0,5 m) "
                                    "bez fazy rozwoju i porównania sezonowego. Wynik jest orientacyjny; wybierz uprawę, aby go doprecyzować.")
    if scene and not unknown_crop:
        acquisition = date.fromisoformat(scene["date"])
        stage_at_scene, _ = phenology(CROPS[request.crop], acquisition, request.sowing)
        scene["crop_stage"] = STAGES[stage_at_scene]
    if scene and not unknown_crop and metrics["stage_id"] != 4 and stage_at_scene == metrics["stage_id"]:
        reference = []
        for sample in sat["history"]:
            sample_day = date.fromisoformat(sample["date"])
            sample_sowing = years_ago(request.sowing, day.year - sample_day.year) if request.sowing else None
            if phenology(CROPS[request.crop], sample_day, sample_sowing)[0] == stage_at_scene:
                reference.append(sample)
        if len(reference) >= 2:
            crop = metrics["crop"]
            metrics["satellite_comparison"] = {
                "ndmi_delta": round(scene["ndmi"] - median(s["ndmi"] for s in reference), 3),
                "ndvi_delta": round(scene["ndvi"] - median(s["ndvi"] for s in reference), 3),
                "n": len(reference), "interpretation": f"Sezonowy kontekst dla {crop['label'].lower()}. Faza: {metrics['stage']}."
            }
    land = inputs.get("land", {})
    classes = {item["class"]: item["percent"] for item in land.get("classes", [])}
    agricultural_pct = classes.get("Grunty orne", 0) + classes.get("Roślinność trawiasta", 0)
    after_land_reference = day.year >= 2022
    agricultural = not (after_land_reference and land.get("pixels", 0) >= 5 and agricultural_pct < 40) or request.confirm_land
    if not agricultural:
        missing["Użytkowanie działki"] = "Klasyfikacja 2021 wskazuje głównie inne użytkowanie. Potwierdź aktualną uprawę, aby włączyć zalecenia."
    if not after_land_reference:
        missing["Kontekst przestrzenny"] = "Pokrycie terenu z 2021 r. służy wyłącznie jako późniejszy kontekst; nie uruchamia zaleceń historycznych."
    if not agricultural:
        metrics["risk"] = "Ocena uprawy wstrzymana"
    context = dict(inputs)
    if not after_land_reference:
        context.pop("land", None)
        if day.year < 2016:
            context.pop("terrain", None)
    context["retention_available"] = bool(
        inputs.get("soil") and retention(inputs["soil"]["layers"], metrics["crop"]["root_m"])
    )
    output = recommendations(metrics, context, request, agricultural)
    scenario = None
    if (root := metrics["root"]) and request.scenario_mm and agricultural:
        sample = rows.get(day.isoformat())
        crop = metrics["crop"]
        extra = request.scenario_mm
        baseline_next = [bucket(root[key]["storage_mm"], root["taw_mm"], crop["p"], [(0, sample[1] * metrics["kc"], 0)])
                         for key in ("initially_dry", "initially_wet")]
        scenario_next = [bucket(root[key]["storage_mm"], root["taw_mm"], crop["p"], [(extra, sample[1] * metrics["kc"], 0)])
                         for key in ("initially_dry", "initially_wet")]
        effects = [round(b["depletion_mm"] - s["depletion_mm"], 1) for b, s in zip(baseline_next, scenario_next, strict=True)]
        scenario = {"input_mm": extra, "depletion_reduction_mm": [min(effects), max(effects)],
                    "note": "Hipotetyczny kolejny dzień z takim samym zapotrzebowaniem. Dodatkowa woda dociera do gleby. To symulacja, bez prognozy i bez zalecenia dawki."}
    source_list = []
    for key, value in inputs.items():
        details = {k: v for k, v in value.items() if k != "rows"}
        if key == "weather":
            details.update(et0_fallback_days=fallback_days, coverage=[metrics["weather_first_day"], metrics["weather_last_day"]], days=sum(
                d <= day.isoformat() and None not in row[:2] for d, row in rows.items()),
                analysis_cutoff=day.isoformat())
        source_list.append({"key": key, **details})
    source_list.sort(key=lambda s: list(SOURCE_LABELS).index(s["key"]))
    confidence = "Niska" if not (metrics["recent"] and agricultural) else "Umiarkowana" if (
        inputs.get("soil") and sat and sat["scene"] and metrics["weather_last_day"] == day.isoformat()
        and not unknown_crop) else "Ograniczona"
    current = rows.get(day.isoformat(), [None, None, None])
    return {"parcel": parcel, "date": day.isoformat(), "metrics": metrics, "confidence": confidence,
            "recommendations": output, "missing": missing, "sources": source_list, "scenario": scenario,
            "daily": {"rain_mm": current[0], "et0_mm": current[1], "temp_c": current[2]},
            "model_version": "1.1", "agricultural": agricultural, "soil_observation": request.soil_observation}
