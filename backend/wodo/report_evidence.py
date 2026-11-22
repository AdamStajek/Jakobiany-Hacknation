"""Explain the saved parcel assessment using the inputs available on its analysis date."""
from datetime import date, timedelta

from wodo.science import years_ago


def number(value):
    return f"{value:g}".replace(".", ",")


def diagnosis(report, balance_note):
    metrics = report["metrics"]
    if not report["agricultural"]:
        return "Trzeba potwierdzić uprawę na tej działce", "Na mapie z 2021 r. przeważa inne użytkowanie terenu."
    if metrics["stage_id"] == 4:
        return "Uprawa jest poza sezonem wzrostu", "Dla podanej daty i fazy model nie ocenia niedoboru przy korzeniach."
    if root := metrics["root"]:
        threshold = f'{number(root["raw_mm"])} mm'
        return {
            "Podwyższone": ("Korzeniom może brakować wody",
                           f"Nawet przy wilgotnej glebie na początku ubytek wody przekracza próg {threshold}."),
            "Niepewne": ("Wody mogło zabraknąć, jeśli gleba była początkowo sucha",
                         f"Tylko przy suchej glebie na początku ubytek wody przekracza próg {threshold}."),
            "Niskie w modelu": ("Według modelu korzenie mają jeszcze zapas wody",
                                f"W obu wariantach ubytek wody mieści się w granicach progu {threshold}."),
        }[metrics["risk"]]
    if metrics["recent"]:
        return "Nie wiadomo, ile wody zostało przy korzeniach", balance_note
    return "Za mało danych, żeby ocenić niedobór wody", "Brakuje bilansu pogodowego oraz oszacowania zapasu w glebie."


def report_evidence(report):
    metrics = report["metrics"]
    selected = date.fromisoformat(report["date"])
    sources = {source["key"]: source for source in report["sources"]}
    recent, root = metrics["recent"], metrics["root"]
    if recent:
        balance = recent["crop_balance_mm"]
        balance_note = (f"Deszczu było o {number(-balance)} mm mniej, niż potrzebowała uprawa." if balance < 0 else
                        f"Deszczu było o {number(balance)} mm więcej, niż potrzebowała uprawa." if balance > 0 else
                        "Suma opadu odpowiadała obliczonym potrzebom uprawy.")
    else:
        balance_note = "Za mało wspólnych dni z opadem i parowaniem, aby porównać ich sumy."

    title, reason = diagnosis(report, balance_note)
    if report["agricultural"] and (period := metrics.get("period_drought")):
        signal = "wskazuje na zagrożenie" if period["alarm"] else "nie wskazuje na zagrożenie"
        balance_note += (f' Od {period["start"]} do {period["end"]} bilans opadu i parowania referencyjnego '
                         f'wyniósł {number(period["balance_mm"])} mm. Dla pszenicy ozimej nasz wskaźnik {signal} '
                         f'suszą w okolicy pola (próg {number(period["threshold_mm"])} mm).')
    scene = sources.get("satellite", {}).get("scene")
    comparison = metrics.get("satellite_comparison")
    if not scene:
        satellite = "Brak użytecznego zdjęcia. Nie możemy sprawdzić, jak wyglądał łan."
    elif comparison:
        delta = comparison["ndmi_delta"]
        relation = "niższy od mediany" if delta < 0 else "wyższy od mediany" if delta > 0 else "równy medianie"
        satellite = f'Wskaźnik uwilgotnienia roślin był {relation} zdjęć z podobnej fazy rozwoju.'
    else:
        satellite = "Zdjęcie pokazuje łan, ale brakuje porównania dla tej fazy rozwoju."

    notes = []
    if not recent and root:
        notes.append("Brakuje pełnego bilansu za ostatnie 30 dni.")
    elif recent and recent["samples"] < recent["days"]:
        notes.append(f'Bilans pogody obejmuje {recent["samples"]} z {recent["days"]} dni.')
    if "Rodzaj uprawy" in report["missing"]:
        notes.append("Użyto parametrów ogólnych, bo nie podano uprawy.")
    if metrics["weather_last_day"] and metrics["weather_last_day"] != report["date"]:
        last = date.fromisoformat(metrics["weather_last_day"])
        notes.append(f"Ostatnia pełna doba pogody to {last:%d.%m.%Y}.")
    if not scene:
        notes.append("Brakuje zdjęcia do sprawdzenia kondycji roślin.")
    if not root and recent and report["agricultural"] and metrics["stage_id"] != 4:
        notes.append("Sam opad nie określa zapasu w glebie.")
    if root and report.get("soil_observation") == "wet":
        notes.append("Zgłaszasz mokrą glebę. Model nie uwzględnia tej obserwacji w obliczeniu zapasu.")
    if not notes:
        notes.append("Zapas szacujemy z pogody i mapy gleby. Początkowa wilgotność gleby jest nieznana." if root else
                     "Ocenę ogranicza zakres danych dla podanej daty.")

    slope = sources.get("terrain", {}).get("slope_pct")
    runoff = report.get("farmer_answers", {}).get("surface_runoff_frequency")
    if runoff and runoff.casefold() in ("czasami", "często"):
        runoff_note = f"Według obserwacji z pola woda {runoff.lower()} spływa podczas ulewy."
    elif slope is not None:
        runoff_note = f"Typowe nachylenie pola wynosi {number(slope)}%. Ilość spływającej wody pozostaje nieznana."
    else:
        runoff_note = "Brakuje odczytu nachylenia, który pomógłby ocenić możliwość spływu."

    start = years_ago(selected, 10)
    eligible = sum(start <= date(year, 4, 1) and date(year, 9, 30) <= selected
                   for year in range(start.year, selected.year + 1))
    return {"headline": title, "reason": reason, "confidence_note": " ".join(notes),
            "balance": balance_note, "satellite": satellite, "runoff": runoff_note,
            "history_start": start.isoformat(), "eligible_seasons": eligible,
            "root_start": (selected - timedelta(days=root["days"] - 1)).isoformat() if root else None}
