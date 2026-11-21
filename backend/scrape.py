import argparse
from collections import Counter
from contextlib import nullcontext
from pathlib import Path

from intake import input_rows, seed_rules
from jobs import import_items
from store import connect, dump, new_database, target_path, verify_database


def main():
    parser = argparse.ArgumentParser(
        description="Importuj projekty i zapisz materiały publiczne w SQLite."
    )
    parser.add_argument("--input", type=Path, required=True)
    args = parser.parse_args()
    path = target_path()
    try:
        columns, rows = input_rows(args.input.name, args.input.read_bytes())
        existing = path.exists()
        if existing:
            verify_database(path)
        with nullcontext(path) if existing else new_database(path) as database:
            with connect(database, write=True) as db:
                seed_rules(db)
            summary, providers, report = Counter(), Counter(), []
            for item, _ in import_items(
                database,
                {"filename": args.input.name, "columns": columns, "rows": rows},
                lambda: False,
            ):
                report.append(item)
                summary[f"{item['stage']}.{item['status']}"] += 1
            with connect(database) as db:
                providers.update(
                    {
                        row[0]: row[1]
                        for row in db.execute(
                            "SELECT json_extract(data, '$.provider'), count(*) FROM records WHERE kind='source' GROUP BY 1"
                        )
                    }
                )
            print(
                dump(
                    {
                        "input_rows": len(rows),
                        "status": "partial"
                        if any(k.endswith(".error") for k in summary)
                        else "succeeded",
                        "counts": dict(summary),
                        "sources": dict(providers),
                        "report": report,
                    }
                )
            )
            if not existing and not summary["fetch.found"]:
                parser.exit(
                    1,
                    "Brak pobranego materiału publicznego. Baza nie została opublikowana.\n",
                )
            return 0 if summary["import.found"] else 1
    except Exception as exc:
        parser.exit(1, f"{path}: {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
