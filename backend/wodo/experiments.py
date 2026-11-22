"""Terenowe sprawdzenie hipotez z raportu wodnego."""


def experiment_checks(report):
    if not report["agricultural"]:
        return []

    metrics = report["metrics"]
    recent, root = metrics["recent"], metrics["root"]
    terrain = next((source for source in report["sources"] if source["key"] == "terrain"), {})
    deficit = recent is not None and recent["crop_balance_mm"] < 0
    runoff = (terrain.get("slope_pct") or 0) >= 3
    results = report.get("experiment_results", {})
    wet = report.get("soil_observation") == "wet" or results.get("wilgotnosc-gleby") == "wet"
    checks = []

    def add(slug, title, reason, impact, options):
        checks.append(dict(slug=slug, title=title, reason=reason, impact=impact,
                           options=[dict(value=value, label=label, conclusion=conclusion)
                                    for value, label, conclusion in options]))

    stress = root and root["initially_dry"]["depletion_mm"] > root["raw_mm"]
    if deficit or stress or root is None or wet or "wilgotnosc-gleby" in results:
        add("wilgotnosc-gleby", "Wilgotność gleby w dłoni",
            "Sprawdź, ile wilgoci jest tam, gdzie rosną korzenie. Dane modelowe i ogólny opis pola nie pokazują wilgotności poszczególnych warstw.",
            "Sucho przy korzeniach wzmacnia podejrzenie niedoboru. Wilgotny profil je osłabia, a mokry kieruje uwagę na zaleganie wody.",
            [
                ("dry", "Sucho na głębokości korzeni", "Obserwacja wspiera rozpoznanie niedoboru wody w sprawdzonych miejscach."),
                ("moist", "Wilgotno na głębokości korzeni", "Obserwacja osłabia podejrzenie niedoboru wody w sprawdzonych miejscach. Przy słabym wzroście sprawdź korzenie i inne przyczyny."),
                ("wet", "Mokro na głębokości korzeni", "Sprawdź, czy woda zalega w profilu. Przed podlewaniem poczekaj i ponownie oceń wilgotność."),
            ])
    if runoff or wet or "wsiakanie-wody" in results:
        add("wsiakanie-wody", "Wsiąkanie wody",
            "Mokra gleba lub nachylenie pola uzasadniają sprawdzenie, czy woda wsiąka równomiernie.",
            "Wolniejsze wsiąkanie w miejscu problemowym wzmacnia hipotezę, że spływ lub zastoiska wiążą się z ograniczonym wsiąkaniem.",
            [
                ("slower", "W miejscu problemowym woda wsiąka wolniej lub stoi", "Ograniczone wsiąkanie jest prawdopodobniejsze. Obejrzyj powierzchnię oraz bryły i korzenie w tym miejscu."),
                ("similar", "W miejscu problemowym woda wsiąka podobnie lub szybciej", "Wynik osłabia hipotezę miejscowego ograniczenia wsiąkania. Sprawdź, którędy dopływa i odpływa woda po deszczu."),
            ])
    if wet or results.get("wsiakanie-wody") == "slower" or "struktura-gleby" in results:
        add("struktura-gleby", "Struktura gleby pod szpadlem (VESS)",
            "Sprawdź, czy przy zaleganiu wody lub wolnym wsiąkaniu widać warstwę utrudniającą wzrost korzeni.",
            "Zbita warstwa z korzeniami skręcającymi w bok wskazuje, że struktura gleby może ograniczać dostęp do wody.",
            [
                ("poor", "Zbite bryły i korzenie głównie w szczelinach lub skręcające w bok", "Zbita warstwa może ograniczać ukorzenienie i przepływ wody. Sprawdź jej głębokość i zasięg w kolejnych punktach."),
                ("open", "Korzenie przechodzą przez bryły, bez wyraźnie zbitej warstwy", "W zbadanej warstwie ubicie jest mniej prawdopodobną przyczyną. Porównaj wilgotność i odpływ w innych miejscach."),
            ])
    if deficit or recent is None or "deszczomierz" in results:
        add("deszczomierz", "Pomiar deszczu deszczomierzem",
            "Sprawdź, czy opad przy polu odpowiada danym pogodowym dla okolicy.",
            "Porównaj sumy z tego samego okresu. Niższy opad lokalny wzmacnia podejrzenie, że pole dostało mniej wody, a wyższy może tłumaczyć wilgotniejszą glebę.",
            [
                ("less", "Przy polu spadło mniej deszczu", "Dane pogodowe mogą zawyżać dopływ wody do pola w porównanym okresie."),
                ("similar", "Sumy opadów są zbliżone", "Różnica w opadzie jest mniej prawdopodobnym wyjaśnieniem stanu pola w porównanym okresie."),
                ("more", "Przy polu spadło więcej deszczu", "Dane pogodowe mogą zaniżać dopływ wody do pola w porównanym okresie. Sprawdź, czy deszcz dotarł do korzeni."),
            ])
    return checks


def experiment_diagnosis(report, results):
    options = {check["slug"]: {option["value"]: option["conclusion"] for option in check["options"]}
               for check in experiment_checks(report)}
    try:
        return {slug: options[slug][value] for slug, value in results.items()}
    except KeyError as error:
        raise ValueError("Nieprawidłowy wynik lub próba spoza listy w raporcie.") from error
