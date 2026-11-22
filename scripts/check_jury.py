"""Próba finałowa KOWR. Uruchom po starcie backendu: python scripts/check_jury.py."""
import json
import sys
from time import monotonic

from check_live import CASES, request


def main():
    base = "http://127.0.0.1:8080"
    health = request(base, "/health")
    trials = [(CASES[0], health["analysis_date_min"]), (CASES[1], "2024-02-29"),
              (CASES[1], "2024-06-20"), (CASES[2], health["analysis_date_max"])]
    passed = True
    for (region, parcel, _, _), day in trials:
        start = monotonic()
        record = dict(region=region, parcel_id=parcel, date=day)
        try:
            report = request(base, "/api/analysis", {"parcel_id": parcel, "date": day})
            record["seconds"] = round(monotonic() - start, 2)
            metrics = report["metrics"]
            record.update(risk=metrics["risk"], confidence=report["confidence"],
                          weather_last_day=metrics["weather_last_day"], missing=report["missing"],
                          recommendations=len(report["recommendations"]))
            record["checks"] = {
                "parcel": report["parcel"]["id"] == parcel, "date": report["date"] == day,
                "weather": bool(record["weather_last_day"]) and record["weather_last_day"] <= day,
                "advice": bool(report["recommendations"]), "sources": bool(report["sources"]),
            }
            passed &= all(record["checks"].values())
        except Exception as error:
            record.update(error=str(error), seconds=round(monotonic() - start, 2))
            passed = False
        print(json.dumps(record, ensure_ascii=False), flush=True)
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
