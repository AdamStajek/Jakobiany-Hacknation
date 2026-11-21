#!/usr/bin/env python3
"""Exercise public providers through the same HTTP API as the application."""

import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

CASES = (
    ("wielkopolskie", "301103_2.0009.549/7", "2024-07-05", "potato"),
    ("lubelskie", "062010_2.0008.14", "2023-07-20", "maize"),
    ("warminsko-mazurskie", "280104_5.0006.98/2", None, "wheat"),
)


def request(base, path, payload=None, binary=False):
    query = Request(base + path, headers={"Content-Type": "application/json"},
                    data=json.dumps(payload).encode() if payload is not None else None)
    with urlopen(query, timeout=48) as response:
        body = response.read()
    return body if binary else json.loads(body)


def check(base, output, only=None):
    report_dir = output / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    health = request(base, "/health")
    assert health["status"] == "ok"
    tests = []
    for case, parcel, day, crop in CASES:
        if only and only != case:
            continue
        parcel_info = request(base, f"/api/parcels/{quote(parcel)}")["parcels"][0]
        assert parcel_info["id"] == parcel and parcel_info["area_ha"] > 0
        payload = dict(parcel_id=parcel, date=day or health["analysis_date_max"], crop=crop,
                       irrigation=True, scenario_mm=12)
        records = []
        for phase in ("cold", "warm"):
            start = time.monotonic()
            result = request(base, "/api/analysis", payload)
            client_elapsed = round((time.monotonic() - start) * 1000)
            metrics = result["metrics"]
            assert result["parcel"]["id"] == parcel and result["date"] == payload["date"]
            assert len(metrics["history"]["seasons"]) >= 7 and metrics["history"]["matched_years"] >= 7
            assert metrics["weather_last_day"] <= payload["date"] and result["recommendations"]
            status = {source["key"]: bool(source.get("scene")) if source["key"] == "satellite" else True
                      for source in result["sources"]}
            records.append({"phase": phase, "api_ms": result["elapsed_ms"], "client_ms": client_elapsed,
                            "status": status, "missing": result["missing"]})
            print(case, phase, client_elapsed, "ms", status, result["missing"], flush=True)
            if phase == "cold":
                assert len(request(base, f"/api/analysis/{result['analysis_id']}/provenance")["sources"]) >= 3
        base_report = result
        document = request(base, f"/api/analysis/{base_report['analysis_id']}/report", binary=True)
        assert document.startswith(b"%PDF") and len(document) > 10_000
        if day:
            (report_dir / f"{case}.pdf").write_bytes(document)
        tests.append({"case": case, "parcel_id": parcel, "date": payload["date"], "crop": crop,
                      "runs": records, "risk": metrics["risk"], "confidence": result["confidence"],
                      "recent": metrics["recent"], "root": metrics["root"], "years": metrics["history"]["matched_years"],
                      "parcel_provenance": {k: parcel_info[k] for k in ("source", "source_url", "retrieved_at") if k in parcel_info},
                      "report_sha256": hashlib.sha256(document).hexdigest() if day else None,
                      "sources": result["sources"]})
    if only is None:
        point = request(base, "/api/parcels/by-point?lon=16.644&lat=52.111")["parcels"][0]
        assert point["id"] == CASES[0][1]
        assert request(base, "/api/parcels/search?query=Bonikowo%20121")["parcels"][0]["id"] == "301103_2.0001.121"
        for url, expected in (("/api/parcels/invalid!!", 422), ("/api/parcels/999999_1.0000.1", 404)):
            try:
                request(base, url)
            except HTTPError as error:
                assert error.code == expected
            else:
                raise AssertionError(url)
    return tests


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("WODO_URL", "http://127.0.0.1:8080"))
    parser.add_argument("--out", default="submission", type=Path)
    parser.add_argument("--case", choices=[x[0] for x in CASES])
    args = parser.parse_args()
    data = check(args.url.rstrip("/"), args.out, args.case)
    path = args.out / (f"live-{args.case}.json" if args.case else "live-verification.json")
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(path)
