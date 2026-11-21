#!/usr/bin/env python3
"""Verify local cache entries and display aggregate acquisition metadata."""

import argparse
import json
from datetime import UTC, datetime

from wodo.store import connect, digest

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--expire", action="store_true", help="Expire source entries only so the next analysis refreshes them.")
args = parser.parse_args()
with connect() as db:
    if args.expire:
        db.execute("UPDATE entries SET updated = 0 WHERE key NOT LIKE 'report:%' AND key != 'last-sources'")
    rows = db.execute("SELECT key, updated, digest, value FROM entries ORDER BY key")
    good = total = 0
    for key, updated, sha, raw in rows:
        current = digest(raw)
        total += 1
        good += current == sha
        result = json.loads(raw)
        print(key.split(":")[0:2], datetime.fromtimestamp(updated, UTC).isoformat(),
              result.get("retrieved_at"), len(raw), "SHA-256 OK" if current == sha else "SHA-256 ERROR")
    print(f"{good}/{total} valid")
    raise SystemExit(good != total)
