"""Porównywanie kolejnych analiz zapisanych działek i dostarczanie nowych porad."""

import json
import logging
from hashlib import sha256

from wodo.db import connect
from wodo.notify import mailer, templates

log = logging.getLogger(__name__)
RECOMMENDATION_SOURCES = {"weather", "soil", "satellite", "terrain", "land", "forecast"}


def record_refresh(field, parcel, report):
    recommendations = {item["id"]: item for item in report["recommendations"]}
    sources = {source["key"] for source in report["sources"]} & RECOMMENDATION_SOURCES
    if not sources:
        return None
    context = sha256(
        json.dumps([field["crop"], parcel["geometry"]], sort_keys=True).encode()
    ).hexdigest()
    key = (field["consent_id"], field["id"], parcel["id"])
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        recipient = db.execute(
            "SELECT u.email, u.username, f.name FROM fields f "
            "JOIN recommendation_email_preferences p ON p.user_id = f.user_id "
            "JOIN users u ON u.id = f.user_id "
            "WHERE p.consent_id = ? AND f.id = ? AND f.parcels = ? "
            "AND f.crop IS ? AND u.email_verified = 1",
            (*key[:2], field["parcels"], field["crop"]),
        ).fetchone()
        if recipient is None:
            return None
        previous = db.execute(
            "SELECT context, active_ids, pending_ids, sources FROM recommendation_email_state "
            "WHERE consent_id = ? AND field_id = ? AND parcel_id = ?",
            key,
        ).fetchone()
        active = set(recommendations)
        pending = set()
        if previous and previous["context"] == context:
            old_sources = set(json.loads(previous["sources"]))
            if not old_sources <= sources:
                # Utrata źródła może ukryć istniejącą poradę lub wyzwolić poradę o brakujących danych.
                return None
            old_active = set(json.loads(previous["active_ids"]))
            pending = (set(json.loads(previous["pending_ids"])) & active) | (active - old_active)
        db.execute(
            "INSERT INTO recommendation_email_state VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(consent_id, field_id, parcel_id) DO UPDATE SET "
            "context = excluded.context, active_ids = excluded.active_ids, "
            "pending_ids = excluded.pending_ids, sources = excluded.sources",
            (*key, context, json.dumps(sorted(active)), json.dumps(sorted(pending)), json.dumps(sorted(sources))),
        )
    ready = [item for rec_id, item in recommendations.items() if rec_id in pending]
    return recipient, ready, pending, key


def send_recommendation_emails(analyze, send=None):
    """Odświeża wybrane działki, zapisuje pierwszą obserwację i wysyła nowe porady."""
    send = send or mailer.send
    with connect() as db:
        fields = db.execute(
            "SELECT f.id, f.crop, f.parcels, p.consent_id FROM fields f "
            "JOIN recommendation_email_preferences p ON p.user_id = f.user_id "
            "JOIN users u ON u.id = f.user_id WHERE u.email_verified = 1 "
            "ORDER BY f.created_at, f.id"
        ).fetchall()
    messages = 0
    for field in fields:
        parcels = {parcel["id"]: parcel for parcel in json.loads(field["parcels"])}
        for parcel in parcels.values():
            try:
                report = analyze(parcel, field["crop"])
                refresh = record_refresh(field, parcel, report)
                if refresh is None:
                    continue
                recipient, ready, pending, key = refresh
                if not ready or not send(
                    recipient["email"],
                    *templates.recommendations(
                        recipient["username"], field["id"], recipient["name"], parcel["id"], ready
                    ),
                ):
                    continue
                pending.difference_update(item["id"] for item in ready)
                with connect() as db:
                    db.execute(
                        "UPDATE recommendation_email_state SET pending_ids = ? "
                        "WHERE consent_id = ? AND field_id = ? AND parcel_id = ?",
                        (json.dumps(sorted(pending)), *key),
                    )
                messages += 1
            except Exception:
                log.exception("Odświeżenie rekomendacji dla pola %s nie powiodło się", field["id"])
    return messages
