"""Cotygodniowe podsumowanie pól: uwaga, brak raportu, nieaktualny raport. Najwyżej jedna wiadomość na 7 dni."""
import json
import logging

from wodo.auth import security
from wodo.db import connect
from wodo.notify import mailer, quiet, rules, templates

log = logging.getLogger(__name__)
DIGEST_SECONDS = 7 * 86400
STALE_SECONDS = 14 * 86400


def summarize(rows, now):
    """Zlicza pola użytkownika. `updated_at` pola jest ostatnią zmianą raportu lub ustawień (przybliżenie wieku raportu)."""
    summary = {"total": len(rows), "attention": [], "no_report": [], "stale": []}
    for row in rows:
        if row["last_report"] is None:
            summary["no_report"].append(row["name"])
            continue
        found = rules.reasons(json.loads(row["last_report"]))
        if found:
            summary["attention"].append({"name": row["name"], "reasons": [text for _, text in found]})
        if now - row["updated_at"] > STALE_SECONDS:
            summary["stale"].append(row["name"])
    return summary


def send_weekly_digests(send=mailer.send, now=None):
    """Zwraca liczbę wysłanych podsumowań. Wiadomość czeka, gdy trwa cisza lub minęło mniej niż 7 dni."""
    now = now if now is not None else security.now()
    with connect() as db:
        users = db.execute("SELECT * FROM users WHERE email_verified = 1 AND notify_email = 1").fetchall()
    sent = 0
    for user in users:
        try:
            with connect() as db:
                last = db.execute("SELECT sent_at FROM digest_log WHERE user_id = ? AND kind = 'weekly'",
                                  (user["id"],)).fetchone()
                if (last and now - last["sent_at"] < DIGEST_SECONDS) or quiet.quiet_now(db, user["id"], now):
                    continue
                rows = db.execute("SELECT name, last_report, updated_at FROM fields WHERE user_id = ? "
                                  "ORDER BY created_at, id", (user["id"],)).fetchall()
                if not rows:
                    continue
                if not send(user["email"], *templates.weekly_summary(user["username"], summarize(rows, now))):
                    continue
                db.execute("INSERT OR REPLACE INTO digest_log VALUES (?, 'weekly', ?)", (user["id"], now))
                sent += 1
        except Exception:
            log.exception("Podsumowanie tygodniowe dla użytkownika %s nie powiodło się", user["id"])
    return sent
