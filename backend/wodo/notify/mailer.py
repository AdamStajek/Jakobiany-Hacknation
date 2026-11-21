"""Wysyłka e-maili przez smtplib; bez SMTP w trybie dev wiadomość trafia do logu i outboxu."""

import json
import logging
import os
import smtplib
from email.message import EmailMessage

from wodo.auth import security
from wodo.db import data_dir

log = logging.getLogger(__name__)


def smtp_config():
    host = os.environ.get("WODO_SMTP_HOST")
    if not host:
        return None
    tls = os.environ.get("WODO_SMTP_TLS", "starttls").lower()
    return {
        "host": host,
        "port": int(os.environ.get("WODO_SMTP_PORT") or (465 if tls == "ssl" else 587)),
        "user": os.environ.get("WODO_SMTP_USER"),
        "password": os.environ.get("WODO_SMTP_PASSWORD"),
        "sender": os.environ.get("WODO_SMTP_FROM") or os.environ.get("WODO_SMTP_USER"),
        "tls": tls,
    }


def outbox_path():
    return data_dir() / "outbox.jsonl"


def outbox():
    path = outbox_path()
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def send(to, subject, body):
    """Zwraca True, gdy wiadomość wysłano albo zapisano w outboxie (dev)."""
    config = smtp_config()
    if config is None:
        from wodo.auth.deps import is_dev

        if not is_dev():
            log.error("Brak WODO_SMTP_HOST: e-mail do %s nie został wysłany.", to)
            return False
        log.warning("E-mail (dev, bez SMTP) do %s: %s\n%s", to, subject, body)
        with outbox_path().open("a", encoding="utf-8") as file:
            file.write(
                json.dumps(
                    {"at": security.now(), "to": to, "subject": subject, "body": body},
                    ensure_ascii=False,
                )
                + "\n"
            )
        return True
    message = EmailMessage()
    message["From"] = config["sender"] or "wodostraznik@localhost"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        if config["tls"] == "ssl":
            client = smtplib.SMTP_SSL(config["host"], config["port"], timeout=15)
        else:
            client = smtplib.SMTP(config["host"], config["port"], timeout=15)
        with client:
            if config["tls"] == "starttls":
                client.starttls()
            if config["user"]:
                client.login(config["user"], config["password"] or "")
            client.send_message(message)
    except (OSError, smtplib.SMTPException):
        log.exception("Nie udało się wysłać e-maila do %s", to)
        return False
    return True
