"""Uruchom z crona: `python -m wodo.notify`."""

import logging
from fcntl import LOCK_EX, LOCK_NB, flock

from main import AnalysisRequest, ensure_analyzable, today
from wodo.analysis import run
from wodo.db import db_path
from wodo.geo import imported
from wodo.notify.push import send_attention_push
from wodo.notify.recommendation_emails import send_recommendation_emails
from wodo.notify.rules import send_attention_emails
from wodo.science import UNKNOWN_CROP


def analyze(parcel, crop):
    geojson = {"type": "Feature", "id": parcel["id"], "geometry": parcel["geometry"]}
    request = AnalysisRequest(geojson=geojson, crop=crop or UNKNOWN_CROP, day=today())
    resolved = imported(geojson)
    ensure_analyzable(resolved)
    return run(resolved, request)


def main():
    logging.basicConfig(level=logging.INFO)
    # Jeden proces wysyłający na bazę. Blokada nie blokuje dostępu API do SQLite.
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.with_name(path.name + ".notify.lock").open("a") as lock:
        try:
            flock(lock, LOCK_EX | LOCK_NB)
        except BlockingIOError:
            logging.info("Powiadomienia są już sprawdzane.")
            return
        print(f"Wysłano wiadomości: {send_attention_emails()}")
        print(f"Wysłano powiadomienia push: {send_attention_push()}")
        print(f"Wysłano e-maile o nowych rekomendacjach: {send_recommendation_emails(analyze)}")


if __name__ == "__main__":
    main()
