"""Uruchom z crona: `python -m wodo.notify` (wysyła e-maile „pole wymaga uwagi”)."""

import logging

from wodo.notify.rules import send_attention_emails

logging.basicConfig(level=logging.INFO)
print(f"Wysłano wiadomości: {send_attention_emails()}")
