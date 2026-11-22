"""Reguły „pole wymaga uwagi” (te same progi co front) i wysyłka e-maila z deduplikacją."""

import json
import logging

from wodo.auth import security
from wodo.db import connect
from wodo.notify import mailer, quiet, templates

log = logging.getLogger(__name__)
DRY_SPELL_DAYS = 7


def reasons(report):
    """Zwraca listę (kod, opis) powodów; pusta, gdy pole nie wymaga uwagi."""
    found = []
    risk = str(report.get("risk") or "").lower()
    if "podwyższon" in risk or "sygnał niedoboru" in risk:
        found.append(("risk", f"ryzyko: {report['risk']}"))
    days = report.get("dry_spell_days")
    if isinstance(days, int | float) and days >= DRY_SPELL_DAYS:
        found.append(("dry", f"{int(days)} dni bez istotnego opadu"))
    balance = report.get("crop_balance_mm")
    if isinstance(balance, int | float) and balance < 0:
        found.append(("balance", f"ujemny bilans wody uprawy ({balance:g} mm)"))
    return found


def attention_for(db, user_id):
    items = []
    for row in db.execute(
        "SELECT id, name, last_report FROM fields WHERE user_id = ? AND last_report IS NOT NULL "
        "ORDER BY created_at, id",
        (user_id,),
    ):
        found = reasons(json.loads(row["last_report"]))
        if found:
            items.append(
                {
                    "field_id": row["id"],
                    "name": row["name"],
                    "key": ",".join(code for code, _ in found),
                    "reasons": [text for _, text in found],
                }
            )
    return items


def fresh_items(db, user_id, table):
    """Pola wymagające uwagi, o których kanał (`notification_log` albo `push_log`) jeszcze nie informował."""
    items = attention_for(db, user_id)
    current = {item["field_id"] for item in items}
    sent = {
        row["field_id"]: row["dedupe_key"]
        for row in db.execute(f"SELECT field_id, dedupe_key FROM {table} WHERE user_id = ?", (user_id,))
    }
    for field_id in set(sent) - current:
        db.execute(f"DELETE FROM {table} WHERE user_id = ? AND field_id = ?", (user_id, field_id))
    return [item for item in items if sent.get(item["field_id"]) != item["key"]]


def remember(db, user_id, table, items):
    for item in items:
        db.execute(
            f"INSERT OR REPLACE INTO {table} VALUES (?, ?, ?, ?)",
            (user_id, item["field_id"], item["key"], security.now()),
        )


def notify_user(user, send=mailer.send):
    """Wysyła jedną wiadomość z polami, o których użytkownik jeszcze nie został powiadomiony."""
    if not (user["email_verified"] and user["notify_email"]):
        return 0
    with connect() as db:
        if quiet.quiet_now(db, user["id"], security.now()):
            return 0
        fresh = fresh_items(db, user["id"], "notification_log")
        if not fresh:
            return 0
        if not send(user["email"], *templates.attention(user["username"], fresh)):
            return 0
        remember(db, user["id"], "notification_log", fresh)
    return len(fresh)


def send_attention_emails(send=mailer.send):
    """Dla wszystkich użytkowników; zwraca liczbę wysłanych wiadomości."""
    with connect() as db:
        users = db.execute(
            "SELECT * FROM users WHERE email_verified = 1 AND notify_email = 1"
        ).fetchall()
    messages = 0
    for user in users:
        try:
            messages += 1 if notify_user(dict(user), send) else 0
        except Exception:
            log.exception("Powiadomienie użytkownika %s nie powiodło się", user["id"])
    return messages
