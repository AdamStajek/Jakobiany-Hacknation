#!/usr/bin/env python3
"""Record licensing declarations of the currently installed dependency set."""

import importlib.metadata
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
frontend = root / "frontend"
lock = json.loads((frontend / "package-lock.json").read_text())
results = set()
for path, metadata in lock["packages"].items():
    if not path:
        continue
    file = frontend / path / "package.json"
    actual = json.loads(file.read_text()) if file.exists() else {}
    name = actual.get("name", path.rsplit("node_modules/", 1)[-1])
    license_ = actual.get("license", metadata.get("license", "odczytaj z paczki dystrybucyjnej"))
    results.add(("npm", name, metadata.get("version", ""), str(license_).replace("\n", " ")))
for dist in importlib.metadata.distributions():
    metadata = dist.metadata
    license_ = metadata.get("License-Expression") or metadata.get("License")
    if not license_ or len(license_) > 140:
        license_ = ", ".join(c.split(" :: ")[-1] for c in metadata.get_all("Classifier", []) if c.startswith("License ::"))
    results.add(("Python", metadata["Name"], dist.version, (license_ or "odczytaj z pliku licencji").replace("\n", " ")))
path = root / "docs" / "COMPONENTS.tsv"
path.write_text("Ekosystem\tNazwa\tWersja\tDeklaracja licencji\n" +
                "".join("\t".join(row) + "\n" for row in sorted(results)), encoding="utf-8")
print(path, len(results), "implementacji lub wariantów pakietów")
