#!/usr/bin/env python3
"""Build the provenance manifest from actual API verification results."""

import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
submission = root / "submission"
cases = json.loads((submission / "live-verification.json").read_text())
terms = {
    "weather": "https://power.larc.nasa.gov/docs/",
    "station": "https://danepubliczne.imgw.pl/pl/datastore",
    "gauge": "https://danepubliczne.imgw.pl/pl/datastore",
    "soil": "https://www.isric.org/explore/soilgrids",
    "satellite": "https://ewds.climate.copernicus.eu/licences/ec-sentinel",
    "terrain": "https://www.opentopodata.org/datasets/eudem/",
    "land": "https://worldcover2021.esa.int/data/docs/WorldCover_PUM_V2.0.pdf",
    "parcel": "https://opendata.geoportal.gov.pl/",
}
artifacts = [
    submission / "live-verification.json", submission / "WodoStraznik-prezentacja.pdf",
    submission / "demo.mp4", *sorted((submission / "reports").glob("*.pdf")),
]
manifest = {
    "schema_version": 1,
    "processing_version": "1.0",
    "dataset_policy": "Źródła są pobierane na żądanie. W manifeście zapisano konkretne pobrania, ich okres i licencję.",
    "artifact_sha256": {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in artifacts if p.is_file()},
    "validations": [
        {"case": case["case"], "parcel_id": case["parcel_id"], "analysis_date": case["date"], "crop": case["crop"],
         "coverage_years": case["years"], "runs": case["runs"], "parcel": {**case.get("parcel_provenance", {}), "terms": terms["parcel"]},
         "sources": [{**s, "terms": terms[s["key"]]} for s in case["sources"]]}
        for case in cases
    ],
}
path = root / "data" / "manifest.json"
path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(path)
