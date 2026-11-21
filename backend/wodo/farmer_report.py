"""Plain Polish explanations of the existing water assessment."""
from collections import Counter
from datetime import date

MONTHS_IN = ("styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu",
             "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu")


def root_message(low, high, threshold):
    if low > threshold:
        return "Według obliczeń przy korzeniach jest już tak sucho, że roślinom może brakować wody."
    if high > threshold:
        return "Roślinom może brakować wody. Wynik zależy od tego, ile wody było wcześniej w glebie."
    return "Według obliczeń przy korzeniach zostało dość wody na dzień oceny."


def report_message(report):
    metrics = report["metrics"]
    if not report["agricultural"]:
        return "Mapa wskazuje tu głównie inne użytkowanie. Ocena wody dla uprawy wymaga potwierdzenia użytkowania pola."
    if report.get("soil_observation") == "wet":
        return "Podajesz, że gleba jest mokra. W takich warunkach nośność gleby może być ograniczona."
    if metrics.get("stage_id") == 4:
        return "Według podanego terminu uprawa jest poza sezonem wzrostu."
    if root := metrics["root"]:
        return root_message(root["initially_wet"]["depletion_mm"], root["initially_dry"]["depletion_mm"], root["raw_mm"])
    if (recent := metrics["recent"]) and recent["crop_balance_mm"] < 0:
        return (f"Do {date.fromisoformat(recent['end']):%d.%m.%Y} w dniach z dostępnymi danymi spadło mniej deszczu, "
                "niż według obliczeń potrzebowała uprawa.")
    return "Brakuje danych o zapasie wody przy korzeniach."


def seasonal_timing(scenario):
    """Most frequent month of the first modelled shortfall in each affected season."""
    starts = {}
    episodes = scenario.get("episodes") if isinstance(scenario, dict) else None
    for event in episodes if isinstance(episodes, list) else []:
        try:
            first = date.fromisoformat(event["start"])
        except (TypeError, KeyError, ValueError):
            continue
        starts[first.year] = min(first, starts.get(first.year, first))
    if not starts:
        return "W następnym sezonie", "W obliczeniach dla poprzednich sezonów uprawie okresami brakowało wody."
    counts = Counter(day.month for day in starts.values())
    peak = max(counts.values())
    months = [MONTHS_IN[m - 1] for m in sorted(counts) if counts[m] == peak]
    if len(months) == 1:
        return (f"W {months[0]} podczas kolejnej uprawy",
                f"W {peak} z {len(starts)} sezonów z niedoborem wody pierwszy taki okres zaczął się właśnie w tym miesiącu.")
    return "W następnym sezonie", "Według obliczeń pierwsze niedobory równie często zaczynały się w tych miesiącach: " + ", ".join(
        f"w {month}" for month in months) + "."
