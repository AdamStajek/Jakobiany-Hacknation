"""Ocena okresowego alarmu dla pszenicy ozimej. Uruchom z katalogu repozytorium Pythonem backendu."""
import csv
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from wodo.geo import lookup
from wodo.science import complete_climate_balance, years_ago
from wodo.store import SourceError
from wodo.weather import history


def features(rows, start, end):
    value = complete_climate_balance(rows, start, end)
    previous = [complete_climate_balance(rows, years_ago(start, n), years_ago(end, n)) for n in range(1, 11)]
    if value is None or None in previous:
        return None, None
    return value, sum(x <= value for x in previous) * 10


def choose_rule(training):
    # Równa waga obu klas oraz każdego okresu gminnego w klasie.
    groups = Counter((r["gmina"], r["date"]) for r in training)
    weight = [1 / groups[(r["gmina"], r["date"])] for r in training]
    totals = {label: sum(w for w, r in zip(weight, training) if r["drought"] == label) for label in (True, False)}
    if not all(totals.values()):
        raise ValueError("W zbiorze doboru progu brakuje jednej klasy")
    rules = ([("balance_mm", t) for t in range(-240, 1, 10)] +
             [("percentile", t) for t in range(0, 101, 10)])

    def score(rule):
        metric, threshold = rule
        return round(sum(w / totals[r["drought"]] for w, r in zip(weight, training)
                         if (r[metric] <= threshold) == r["drought"]), 10)

    return max(rules, key=score)


def main():
    by_parcel = defaultdict(list)
    for filename in ("iung_results_100.csv", "iung_additional_results.csv"):
        with (ROOT / "docs" / filename).open() as f:
            for c in csv.DictReader(f):
                pct = float(c["iung_pct"])
                if pct == 0 or pct >= 95:
                    by_parcel[c["parcel_id"]].append(c)
    records = []
    for parcel, cases in sorted(by_parcel.items()):
        lon, lat = lookup(parcel)[0]["sample_point"]
        try:
            weather = history(lon, lat)["rows"]
        except SourceError as error:
            print(parcel, error, file=sys.stderr)
            weather = {}
        for c in cases:
            start, end = map(date.fromisoformat, (c["period_start"], c["date"]))
            value, rank = features(weather, start, end)
            records.append(dict(parcel_id=parcel, date=c["date"], gmina=c["gmina"], iung_pct=c["iung_pct"],
                                drought=float(c["iung_pct"]) >= 95, baseline=c["risk"],
                                baseline_verdict=c["verdict"], balance_mm=value, percentile=rank))
    writer = csv.DictWriter(sys.stdout, lineterminator="\n",
                            fieldnames=[*records[0], "metric", "threshold", "alarm", "candidate_verdict"])
    writer.writeheader()
    for gmina in sorted({r["gmina"] for r in records}):
        training = [x for x in records if x["gmina"] != gmina and x["percentile"] is not None]
        metric, threshold = choose_rule(training)
        for r in (x for x in records if x["gmina"] == gmina):
            alarm = None if r[metric] is None else r[metric] <= threshold
            verdict = "brak danych" if alarm is None else "zgodny" if alarm == r["drought"] else "rozbieżny"
            writer.writerow(dict(r, metric=metric, threshold=threshold, alarm=alarm, candidate_verdict=verdict))


if __name__ == "__main__":
    main()
