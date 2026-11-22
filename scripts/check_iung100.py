"""Porównanie 100 analiz z SMSR. Uruchom po starcie backendu."""
import argparse
import csv
import sys
from collections import Counter
from pathlib import Path
from time import sleep
from urllib.error import HTTPError

from check_iung import compare
from check_live import request

DATA = Path(__file__).resolve().parents[1] / "data/iung_cases_100.csv"


def evaluate(base, case, *, period=False):
    payload = {k: case[k] for k in ("parcel_id", "date", "crop")}
    try:
        try:
            result = request(base, "/api/analysis", payload)
        except HTTPError as exc:
            if exc.code != 429:
                raise
            sleep(int(exc.headers.get("Retry-After", 60)))
            result = request(base, "/api/analysis", payload)
        if result["parcel"]["id"] != payload["parcel_id"] or result["date"] != payload["date"]:
            raise ValueError("Inna działka lub data odpowiedzi")
        risk = result["metrics"]["risk"]
        pct = float(case["iung_pct"])
        if period:
            signal = result["metrics"].get("period_drought")
            if signal and (signal["start"], signal["end"]) == (case["period_start"], case["date"]):
                risk = "Alarm okresowy" if signal["alarm"] else "Brak alarmu okresowego"
                if 0 < pct < 95:
                    verdict = "pośredni wynik IUNG"
                else:
                    verdict = "zgodny" if signal["alarm"] == (pct >= 95) else "rozbieżny"
            else:
                risk, verdict = "Brak wskaźnika dla tego okresu", "brak jednoznacznej diagnozy"
            return dict(case, risk=risk, confidence="", verdict=verdict, error="")
        verdict = compare(pct, risk)
        return dict(case, risk=risk, confidence=result["confidence"], verdict=verdict, error="")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return dict(case, risk="", confidence="", verdict="błąd", error=str(exc))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8080")
    parser.add_argument("--cases", type=Path, default=DATA, help="CSV ze 100 parami działka–data i referencjami IUNG")
    parser.add_argument("--period", action="store_true", help="Oceń wskaźnik okresowy dla pszenicy ozimej")
    args = parser.parse_args()
    with args.cases.open(encoding="utf-8") as source:
        cases = list(csv.DictReader(source))
    if len(cases) != 100 or len({(c["parcel_id"], c["date"]) for c in cases}) != 100:
        raise ValueError("Oczekiwano 100 różnych par działka–data")
    totals = Counter()
    writer = csv.DictWriter(sys.stdout, lineterminator="\n", fieldnames=[*cases[0], "risk", "confidence", "verdict", "error"])
    writer.writeheader()
    for i, case in enumerate(cases, 1):
        row = evaluate(args.url.rstrip("/"), case, period=args.period)
        writer.writerow(row)
        sys.stdout.flush()
        totals[row["verdict"]] += 1
        if i % 10 == 0:
            print(f"{i}/100", dict(totals), file=sys.stderr, flush=True)
    return int(bool(totals["błąd"]))


if __name__ == "__main__":
    sys.exit(main())
