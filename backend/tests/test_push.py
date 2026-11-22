from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from tests.test_accounts import client, verified_user_with_field  # noqa: F401
from wodo.auth import security
from wodo.notify import mailer, push, quiet, rules

BAD = {"risk": "Podwyższone", "dry_spell_days": 8, "crop_balance_mm": -5}
SUB = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "k", "auth": "a"}}


def at(hour, minute=0, tz="Europe/Warsaw"):
    return datetime(2026, 7, 1, hour, minute, tzinfo=ZoneInfo(tz)).timestamp()


def test_quiet_window_same_day_and_over_midnight():
    assert quiet.is_quiet(at(23), "Europe/Warsaw", "22:00", "07:00")
    assert quiet.is_quiet(at(6, 59), "Europe/Warsaw", "22:00", "07:00")
    assert not quiet.is_quiet(at(7), "Europe/Warsaw", "22:00", "07:00")
    assert not quiet.is_quiet(at(12), "Europe/Warsaw", "22:00", "07:00")
    assert quiet.is_quiet(at(13), "Europe/Warsaw", "12:00", "14:00")
    assert not quiet.is_quiet(at(14), "Europe/Warsaw", "12:00", "14:00")
    assert not quiet.is_quiet(at(3), "Europe/Warsaw", "08:00", "08:00")


def test_quiet_uses_user_timezone():
    moment = at(23, tz="Europe/Warsaw")  # 21:00 UTC, 17:00 w Nowym Jorku
    assert quiet.is_quiet(moment, "Europe/Warsaw", "22:00", "07:00")
    assert not quiet.is_quiet(moment, "America/New_York", "22:00", "07:00")


def test_preferences_validation_and_roundtrip(client):  # noqa: F811
    verified_user_with_field(client, BAD)
    got = client.get("/api/me/notifications").json()
    assert got["quiet_enabled"] is False and got["timezone"] == "Europe/Warsaw" and got["push_enabled"] is False
    saved = client.patch(
        "/api/me/notifications",
        json={"quiet_enabled": True, "quiet_start": "21:30", "quiet_end": "06:15", "timezone": "Europe/London"},
    ).json()
    assert saved["quiet_enabled"] and saved["quiet_start"] == "21:30" and saved["timezone"] == "Europe/London"
    for bad in ({"quiet_start": "25:00"}, {"timezone": "Mars/Base"}, {"timezone": None}, {"quiet_end": "7"}):
        assert client.patch("/api/me/notifications", json=bad).status_code == 422


def test_email_waits_during_quiet_hours(client, monkeypatch):  # noqa: F811
    verified_user_with_field(client, BAD)
    client.patch("/api/me/notifications", json={"quiet_enabled": True, "quiet_start": "00:00", "quiet_end": "23:59"})
    before = len(mailer.outbox())
    assert rules.send_attention_emails() == 0 and len(mailer.outbox()) == before
    client.patch("/api/me/notifications", json={"quiet_enabled": False})
    assert rules.send_attention_emails() == 1


def test_push_subscription_requires_https_and_is_per_user(client):  # noqa: F811
    verified_user_with_field(client, BAD)
    assert client.put("/api/me/push/subscription", json={**SUB, "endpoint": "http://x"}).status_code == 422
    assert client.put("/api/me/push/subscription", json=SUB).status_code == 204
    assert client.get("/api/me/notifications").json()["push_devices"] == 1
    assert client.post("/api/me/push/unsubscribe", json={"endpoint": SUB["endpoint"]}).status_code == 204
    assert client.get("/api/me/notifications").json()["push_devices"] == 0


def test_push_key_needs_configuration(client, monkeypatch):  # noqa: F811
    verified_user_with_field(client, BAD)
    monkeypatch.delenv("WODO_VAPID_PUBLIC_KEY", raising=False)
    assert client.get("/api/me/push/key").status_code == 503
    monkeypatch.setenv("WODO_VAPID_PUBLIC_KEY", "pub")
    monkeypatch.setenv("WODO_VAPID_PRIVATE_KEY", "priv")
    assert client.get("/api/me/push/key").json() == {"public_key": "pub"}
    assert client.get("/api/me/notifications").json()["push_available"] is True


@pytest.fixture
def push_env(monkeypatch):
    monkeypatch.setenv("WODO_VAPID_PUBLIC_KEY", "pub")
    monkeypatch.setenv("WODO_VAPID_PRIVATE_KEY", "priv")


def test_attention_push_dedup_quiet_and_gone(client, push_env):  # noqa: F811
    field = verified_user_with_field(client, BAD)
    client.put("/api/me/push/subscription", json=SUB)
    calls = []

    def send(subscription, payload):
        calls.append((subscription["endpoint"], payload))
        return "ok"

    assert push.send_attention_push(send) == 0  # push wyłączony
    client.patch("/api/me/notifications", json={"push_enabled": True})
    assert push.send_attention_push(send) == 1
    assert calls[0][1]["url"] == "/pola" and "Łąka" in calls[0][1]["body"]
    assert push.send_attention_push(send) == 0  # deduplikacja
    client.put(f"/api/fields/{field['id']}/last-report", json={**BAD, "dry_spell_days": 1})
    client.patch("/api/me/notifications", json={"quiet_enabled": True, "quiet_start": "00:00", "quiet_end": "23:59"})
    assert push.send_attention_push(send) == 0  # cisza
    client.patch("/api/me/notifications", json={"quiet_enabled": False})
    assert push.send_attention_push(send) == 1
    client.put(f"/api/fields/{field['id']}/last-report", json={**BAD, "dry_spell_days": 9})
    assert push.send_attention_push(lambda *_: "gone") == 0
    assert client.get("/api/me/notifications").json()["push_devices"] == 0


def test_push_email_logs_are_independent(client, push_env):  # noqa: F811
    verified_user_with_field(client, BAD)
    client.put("/api/me/push/subscription", json=SUB)
    client.patch("/api/me/notifications", json={"push_enabled": True})
    assert push.send_attention_push(lambda *_: "ok") == 1
    assert rules.send_attention_emails() == 1
    assert security.now()
