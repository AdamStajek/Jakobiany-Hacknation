#!/usr/bin/env python3
"""Build a portable private source package from the WodoStrażnik files."""

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ".gitignore", ".dockerignore", "README.md", "SUBMISSION_CHECKLIST.md", "Dockerfile", "docker-compose.yml",
    "backend/.python-version", "backend/main.py", "backend/pyproject.toml", "backend/uv.lock",
    "backend/tests/test_wodo.py", "frontend/.postcssrc.json", "frontend/angular.json", "frontend/package.json",
    "frontend/package-lock.json", "frontend/tsconfig.json", "frontend/proxy.conf.mjs", "frontend/e2e/smoke.mjs",
    "frontend/e2e/deck.mjs", "frontend/eslint.config.js", "frontend/.prettierrc.json", "frontend/tsconfig.spec.json", "frontend/src/index.html", "frontend/src/main.ts", "frontend/src/styles.css",
]
PATTERNS = [
    "frontend/src/**/*.ts", "frontend/src/**/*.css", "docs/FRONTEND_REBUILD_PLAN.md",
    "backend/wodo/*.py", "scripts/*.py", "scripts/run.sh", "docs/DATA_*.md", "docs/REQUIREMENTS_MATRIX.md",
    "docs/COMPONENTS.tsv", "docs/VERIFICATION.md", "submission/*.md", "submission/live-verification.json",
    "submission/*.pdf", "submission/demo.mp4", "submission/reports/*.pdf",
]


def package(path):
    selected = {ROOT / rel: rel for rel in FILES}
    selected.update({p: str(p.relative_to(ROOT)) for glob in PATTERNS for p in ROOT.glob(glob)})
    for name in ("README.md", "manifest.json"):
        selected[ROOT / "data" / name] = f"data/{name}"
    with ZipFile(path, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for src, name in sorted(selected.items(), key=lambda item: item[1]):
            if not src.is_file():
                raise FileNotFoundError(src)
            archive.write(src, name)
    print(path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, nargs="?", default=ROOT / "submission" / "WodoStraznik-source.zip")
    package(parser.parse_args().output)
