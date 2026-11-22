"""Web Push (VAPID): zapis subskrypcji przeglądarki i wysyłka powiadomień o polach wymagających uwagi.

Klucze: `WODO_VAPID_PRIVATE_KEY` i `WODO_VAPID_PUBLIC_KEY` (base64url; wygeneruje je
`python -m wodo.notify.push`). Bez nich Web Push jest wyłączony, a reszta aplikacji działa.
Biblioteka `pywebpush` jest ładowana dopiero przy wysyłce.
"""

import base64
import json
import logging
import os

from wodo.auth import security
from wodo.db import connect
from wodo.notify import quiet, rules, templates

log = logging.getLogger(__name__)
GONE = {404, 410}


def public_key():
    return os.environ.get("WODO_VAPID_PUBLIC_KEY") or None


def configured():
    return bool(public_key() and os.environ.get("WODO_VAPID_PRIVATE_KEY"))


def deliver(subscription, payload):
    """Wysyła jedną wiadomość. Zwraca 'ok', 'gone' (subskrypcja wygasła) albo 'error'."""
    try:
        from py_vapid import Vapid01
        from pywebpush import WebPushException, webpush
    except ImportError:
        log.error("Brak biblioteki pywebpush: Web Push nie został wysłany.")
        return "error"
    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=Vapid01.from_raw(os.environ["WODO_VAPID_PRIVATE_KEY"].encode()),
            vapid_claims={"sub": os.environ.get("WODO_VAPID_SUBJECT", templates.base_url())},
            ttl=12 * 3600,
        )
    except WebPushException as error:
        status = getattr(error.response, "status_code", None)
        if status in GONE:
            return "gone"
        log.warning("Web Push nie powiódł się (%s): %s", status, error)
        return "error"
    except OSError:
        log.exception("Web Push: błąd sieci")
        return "error"
    return "ok"


def subscription_info(row):
    return {"endpoint": row["endpoint"], "keys": {"p256dh": row["p256dh"], "auth": row["auth"]}}


def push_to_user(db, user_id, payload, send=deliver):
    """Wysyła do wszystkich urządzeń użytkownika i usuwa wygasłe. Zwraca liczbę dostarczonych."""
    delivered = 0
    for row in db.execute("SELECT * FROM push_subscriptions WHERE user_id = ?", (user_id,)).fetchall():
        result = send(subscription_info(row), payload)
        if result == "gone":
            db.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (row["endpoint"],))
        delivered += result == "ok"
    return delivered


def attention_payload(items):
    names = ", ".join(item["name"] for item in items)
    count = len(items)
    return {
        "title": "Pole wymaga uwagi" if count == 1 else f"Pola wymagające uwagi: {count}",
        "body": f"{names}. {'; '.join(items[0]['reasons'])}" if count == 1 else names,
        "url": "/pola",
        "tag": "pole-uwaga",
    }


def notify_user(user_id, send=deliver):
    """Jedno powiadomienie push z nowymi polami; poza ciszą i tylko gdy użytkownik je włączył."""
    with connect() as db:
        enabled = db.execute(
            "SELECT push_enabled FROM notification_settings WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not enabled or not enabled["push_enabled"] or quiet.quiet_now(db, user_id, security.now()):
            return 0
        fresh = rules.fresh_items(db, user_id, "push_log")
        if not fresh or not push_to_user(db, user_id, attention_payload(fresh), send):
            return 0
        rules.remember(db, user_id, "push_log", fresh)
    return len(fresh)


def send_attention_push(send=deliver):
    if not configured():
        return 0
    with connect() as db:
        ids = [
            row["user_id"]
            for row in db.execute(
                "SELECT DISTINCT s.user_id FROM push_subscriptions s JOIN notification_settings n "
                "ON n.user_id = s.user_id WHERE n.push_enabled = 1"
            )
        ]
    sent = 0
    for user_id in ids:
        try:
            sent += 1 if notify_user(user_id, send) else 0
        except Exception:
            log.exception("Push do użytkownika %s nie powiódł się", user_id)
    return sent


def generate_keys():
    from cryptography.hazmat.primitives import serialization
    from py_vapid import Vapid01

    vapid = Vapid01()
    vapid.generate_keys()

    def b64(raw):
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    private = b64(vapid.private_key.private_numbers().private_value.to_bytes(32, "big"))
    public = b64(
        vapid.public_key.public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
        )
    )
    return private, public


if __name__ == "__main__":
    private_key, public_key_value = generate_keys()
    print(f"WODO_VAPID_PRIVATE_KEY={private_key}\nWODO_VAPID_PUBLIC_KEY={public_key_value}")
