import logging
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import date, timedelta
from statistics import median

from wodo.science import CROPS, STAGES, assess, bucket, phenology
from wodo.spatial import satellite_history, soil, terrain, worldcover
from wodo.store import SourceError
from wodo.weather import gauge, history, station

LOG = logging.getLogger(__name__)
PROVIDERS = ThreadPoolExecutor(max_workers=14)
SOURCE_LABELS = {
    "weather": "Pogoda wieloletnia", "station": "Stacja meteorologiczna IMGW", "soil": "Retencja glebowa",
    "satellite": "Sentinel-2", "terrain": "Ukształtowanie terenu", "land": "Pokrycie terenu i wody powierzchniowe",
    "gauge": "Wodowskaz IMGW",
}


def recommendations(metrics, inputs, irrigation_available, agricultural, soil_observation=None):
    hints = []

    def add(group, title, action, why, evidence, when, confidence, limits):
        hints.append(dict(group=group, title=title, action=action, why=why, evidence=evidence, when=when,
                          confidence=confidence, limits=limits))

    recent, root, hist = metrics["recent"], metrics["root"], metrics["history"]
    land, terrain = inputs.get("land"), inputs.get("terrain")
    soil = inputs.get("soil")
    sat = inputs.get("satellite", {}).get("scene")
    weather_need = recent and recent["crop_balance_mm"] < 0
    if not agricultural or not (recent or hist["seasons"] or root):
        return hints
    if soil_observation != "wet" and root and root["initially_wet"]["depletion_mm"] > root["raw_mm"]:
        low = root["initially_wet"]["depletion_mm"]
        add("Agrotechnika", "Sprawdź wilgotność przy korzeniach", "Odkop ziemię obok kilku roślin w różnych częściach pola. Sprawdź, czy jest wilgotna tam, gdzie sięgają żywe korzenie.",
            f"Model wskazuje przekroczenie progu łatwo dostępnej wody w fazie «{metrics['stage'].lower()}».",
            f"Ubytek modelowy co najmniej {low:g} mm przy progu {root['raw_mm']:g} mm.",
            "Przy najbliższym obchodzie pola", "umiarkowana",
            "Pogoda jest uśredniona przestrzennie, a pojemność gleby pochodzi z modelu.")
    if weather_need or (root and root["taw_mm"] / metrics["crop"]["root_m"] < 100):
        evidence = (f"Opad minus zapotrzebowanie uprawy w oknie 30 dni do {recent['end']}: {recent['crop_balance_mm']:+g} mm."
                    if weather_need else f"Szacowana pojemność strefy korzeni: {root['taw_mm']:g} mm.")
        add("Retencja glebowa", "Zostaw osłonę na powierzchni gleby",
            "Po zbiorze rozłóż resztki równomiernie. Ogranicz dodatkowe przejazdy, jeśli pole jest suche.",
            "Osłona ogranicza parowanie z powierzchni i uderzenia kropel deszczu.", evidence,
            "Po żniwach, przed kolejną uprawą", "umiarkowana",
            "Dopasuj pracę z resztkami do zdrowotności roślin i warunków siewu.")
    if hist["riskiest_months"]:
        months = ", ".join(hist["riskiest_months"])
        add("Agrotechnika", f"Obserwuj uprawę w okresie «{metrics['crop']['sensitive']}»",
            "Sprawdź ziemię przy korzeniach w kilku miejscach. Jeśli masz międzyplon, a gleba pod nim przesycha, rozważ wcześniejsze zakończenie jego uprawy.",
            "W okresach powtarzalnego deficytu wcześniejsze sprawdzenie gleby pomaga dostosować zabiegi.",
            f"Miesiące o najniższej medianie opad − ET₀: {months}. Pełne sezony: {len(hist['seasons'])}.",
            f"Miesiące, na które warto zaplanować obchód pola: {months}.", "umiarkowana",
            "Bilans klimatyczny i kalendarz uprawy są przybliżone.")
    if terrain and terrain["slope_pct"] is not None and terrain["slope_pct"] >= 3 and (weather_need or hist["riskiest_months"]):
        add("Retencja krajobrazowa", "Spowolnij odpływ ze stoku",
            "Przejdź pole po deszczu. W miejscach zaobserwowanego spływu rozważ pas roślinności i dostosuj kierunek prac do stoku.",
            "Spadek powierzchni sprzyja szybkiemu odpływowi niezależnie od bilansu opadów.",
            f"Mediana nachylenia z modelu 30 m: {terrain['slope_pct']:g}%. Próg przesiewowy: 3%.",
            "Po większym deszczu, przed kolejnym siewem", "wstępna",
            "Teren i ślady spływu sprawdź w terenie. Model obejmuje również wysokość roślin i zabudowy.")
    if land and land["nearest_water_m"] is not None and (weather_need or hist["riskiest_months"]):
        add("Retencja krajobrazowa", "Sprawdź istniejące miejsca zatrzymywania wody",
            "Obejrzyj zaznaczone otoczenie i sprawdź przebieg rowów oraz naturalne obniżenia z doradcą.",
            "Pokrycie terenu wskazuje stałą wodę w pobliżu oraz uzasadnia terenowe rozpoznanie odpływu.",
            f"Najbliższy wykryty piksel stałej wody około {land['nearest_water_m']} m od granicy. Klasyfikacja 2021.",
            "Po opadach i przed planowaniem robót", "wstępna",
            "Lokalna wizja, weryfikacja właściciela, specjalista i wymagane zgody są konieczne przed pracami.")
    if soil and hist["riskiest_months"] and not any(h["group"].startswith("Retencja") for h in hints):
        add("Retencja glebowa", "Zaplanuj osłonę gleby między sezonami",
            "Sprawdź strukturę i zawartość materii organicznej. Dopasuj resztki i międzyplon do pola, następstwa upraw i zapasu wody.",
            "Osłona sprzyja infiltracji, a dobór terminu pozwala kontrolować konkurencję międzyplonu o wodę.",
            f"Typowe miesiące deficytu: {', '.join(hist['riskiest_months'])}. Model wody glebowej: 250 m.",
            "Po zbiorze i przy planowaniu zmianowania", "wstępna",
            "Zalecenie wymaga sprawdzenia gleby i przebiegu pogody.")
    if sat and metrics.get("satellite_comparison") and metrics["satellite_comparison"]["ndmi_delta"] < -.1 and weather_need:
        add("Monitoring", "Sprawdź fragmenty o słabszym łanie",
            "Porównaj podczas lustracji równomierność roślin i wilgotność gleby.",
            "Słabszy sygnał wilgotności łanu współwystępuje z ujemnym bilansem pogodowym.",
            f"NDMI względem scen sezonowych: {metrics['satellite_comparison']['ndmi_delta']:+.3f}.",
            "Podczas najbliższej lustracji", "wstępna",
            "Zmianowanie, faza, zbiór, choroby i gleba mogą zmieniać odczyt.")
    if soil_observation == "wet":
        add("Monitoring", "Sprawdź odpływ po deszczu", "Wstrzymaj nawadnianie na mokrym polu i sprawdź, gdzie zalega woda.",
            "Przy mokrej glebie kolejny dopływ wody może zwiększać odpływ i ugniatanie.",
            "Obserwacja użytkownika: mokra gleba.", "Przed nawodnieniem i wjazdem w pole",
            "wstępna", "Sprawdź wilgotność w kilku miejscach i na głębokości korzeni.")
    if irrigation_available and soil_observation != "wet" and metrics.get("stage_id") != 4:
        supported = root and root["initially_wet"]["depletion_mm"] > root["raw_mm"]
        add("Nawadnianie", "Zweryfikuj potrzebę nawodnienia" if supported else "Zacznij od pomiaru wilgotności",
            "Zmierz wilgotność w kilku punktach i sprawdź przewidywany deszcz przed ustaleniem terminu.",
            "Model wskazuje stres nawet przy wilgotnym starcie." if supported else
            "Dostępne dane nie pozwalają bezpiecznie wyznaczyć dawki.",
            f"Próg łatwo dostępnej wody {root['raw_mm']:g} mm. Ubytek {root['initially_wet']['depletion_mm']:g}–{root['initially_dry']['depletion_mm']:g} mm."
            if root else "Brak kompletnego dziennego bilansu glebowego.",
            "Przed decyzją o nawadnianiu", "wstępna",
            "Sprawdź zasoby, uprawnienia, infiltrację i sprawność instalacji. Ocena nie wyznacza dawki ani prognozy.")
    if soil_observation == "wet":
        hints.sort(key=lambda item: item["title"] != "Sprawdź odpływ po deszczu")
    return hints


def run(parcel, request):
    geom = parcel["geometry"]
    lon, lat = parcel["sample_point"]
    day = request.day
    jobs = {"weather": (history, lon, lat), "station": (station, lon, lat, day), "soil": (soil, geom),
            "satellite": (satellite_history, geom, day), "terrain": (terrain, geom), "land": (worldcover, geom)}
    if day == date.today():
        jobs["gauge"] = (gauge, lon, lat, day)
    tasks = {PROVIDERS.submit(fn, *args): key for key, (fn, *args) in jobs.items()}
    done, pending = wait(tasks, timeout=24)
    inputs, missing = {}, {}
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
    if scene:
        acquisition = date.fromisoformat(scene["date"])
        stage_at_scene, _ = phenology(CROPS[request.crop], acquisition, request.sowing)
        scene["crop_stage"] = STAGES[stage_at_scene]
    if scene and len(sat["history"]) >= 2 and metrics["stage_id"] != 4 and stage_at_scene == metrics["stage_id"]:
        crop = metrics["crop"]
        metrics["satellite_comparison"] = {
            "ndmi_delta": round(scene["ndmi"] - median(s["ndmi"] for s in sat["history"]), 3),
            "ndvi_delta": round(scene["ndvi"] - median(s["ndvi"] for s in sat["history"]), 3),
            "n": len(sat["history"]), "interpretation": f"Sezonowy kontekst dla {crop['label'].lower()}. Faza: {metrics['stage']}."
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
    output = recommendations(metrics, context, request.irrigation, agricultural, request.soil_observation)
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
        inputs.get("soil") and sat and sat["scene"] and metrics["weather_last_day"] == day.isoformat()) else "Ograniczona"
    current = rows.get(day.isoformat(), [None, None, None])
    return {"parcel": parcel, "date": day.isoformat(), "metrics": metrics, "confidence": confidence,
            "recommendations": output, "missing": missing, "sources": source_list, "scenario": scenario,
            "daily": {"rain_mm": current[0], "et0_mm": current[1], "temp_c": current[2]},
            "model_version": "1.0", "agricultural": agricultural, "soil_observation": request.soil_observation}
