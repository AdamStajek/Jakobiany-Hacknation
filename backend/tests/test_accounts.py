import re
import sqlite3

import pytest
from fastapi.testclient import TestClient

import main
from wodo.auth import security
from wodo.db import db_path
from wodo.notify import mailer, rules

XHR = {"X-Requested-With": "test"}
PASSWORD = "dlugie-haslo-123"
SQUARE = {
    "type": "Polygon",
    "coordinates": [[[17, 52], [17.01, 52], [17.01, 52.01], [17, 52.01], [17, 52]]],
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("WODO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("WODO_DB_PATH", raising=False)
    monkeypatch.delenv("WODO_SMTP_HOST", raising=False)
    monkeypatch.setenv("WODO_ENV", "dev")
    security.throttle.reset()
    main.buckets.clear()
    with TestClient(main.app, headers=XHR) as c:
        yield c


def register(client, name="ola", email="ola@example.com", password=PASSWORD):
    return client.post(
        "/api/auth/register", json={"email": email, "username": name, "password": password}
    )


def fresh(client):
    other = TestClient(main.app, headers=XHR)
    other.cookies.clear()
    return other


def token_from_outbox(kind):
    body = [m for m in mailer.outbox() if kind in m["body"]][-1]["body"]
    return re.search(r"token=([\w-]+)", body).group(1)


def test_register_sends_verification_and_verify(client):
    response = register(client)
    assert response.status_code == 201
    assert response.json()["email_verified"] is False
    assert set(response.json()) == {"id", "email", "username", "email_verified", "role"}
    assert client.get("/api/me").json()["username"] == "ola"
    client.post("/api/auth/verify", json={"token": token_from_outbox("potwierd")})
    assert client.get("/api/me").json()["email_verified"] is True
    again = client.post("/api/auth/verify", json={"token": "zly"})
    assert again.status_code == 400


def test_register_validation_and_duplicates(client):
    assert register(client, password="krotkie").status_code == 422
    assert register(client, name="a b").status_code == 422
    assert register(client, email="nie-mail").status_code == 422
    assert register(client).status_code == 201
    assert register(client, name="OLA", email="inny@example.com").status_code == 409
    assert register(client, name="inna", email="OLA@example.com").status_code == 409


def test_login_with_email_and_username_and_bad_login(client):
    register(client)
    for identifier in ("ola@example.com", "OLA", "Ola@Example.com"):
        other = fresh(client)
        assert other.post(
            "/api/auth/login", json={"identifier": identifier, "password": PASSWORD}
        ).status_code == 200
        assert other.get("/api/me").status_code == 200
    other = fresh(client)
    wrong = other.post("/api/auth/login", json={"identifier": "ola", "password": "zle-haslo-123"})
    missing = other.post("/api/auth/login", json={"identifier": "nikt", "password": "zle-haslo-123"})
    assert wrong.status_code == missing.status_code == 401
    assert wrong.json() == missing.json()
    assert other.get("/api/me").status_code == 401


def test_cookie_flags(client, monkeypatch):
    register(client)
    cookie = client.post(
        "/api/auth/login", json={"identifier": "ola", "password": PASSWORD}
    ).headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "secure" not in cookie
    monkeypatch.setenv("WODO_ENV", "production")
    cookie = client.post(
        "/api/auth/login", json={"identifier": "ola", "password": PASSWORD}
    ).headers["set-cookie"].lower()
    assert "secure" in cookie


def test_requires_requested_with_header(client):
    response = TestClient(main.app).post(
        "/api/auth/login", json={"identifier": "ola", "password": PASSWORD}
    )
    assert response.status_code == 403


def test_login_throttle_grows_and_recovers(client, monkeypatch):
    register(client)
    other = fresh(client)
    clock = [1000.0]
    monkeypatch.setattr(security, "now", lambda: clock[0])
    bad = {"identifier": "ola", "password": "zle-haslo-123"}
    for _ in range(5):
        assert other.post("/api/auth/login", json=bad).status_code == 401
    blocked = other.post("/api/auth/login", json={"identifier": "ola", "password": PASSWORD})
    assert blocked.status_code == 429 and int(blocked.headers["Retry-After"]) >= 1
    clock[0] += 5
    assert other.post("/api/auth/login", json={"identifier": "ola", "password": PASSWORD}).status_code == 200


def test_session_expires_after_idle(client, monkeypatch):
    register(client)
    start = security.now()
    monkeypatch.setattr(security, "now", lambda: start + security.SESSION_IDLE + 10)
    assert client.get("/api/me").status_code == 401


def test_logout_ends_session(client):
    register(client)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/me").status_code == 401


def test_change_password(client):
    register(client)
    assert client.post("/api/me/password", json={"current": "zle-haslo-123", "new": "nowe-haslo-456"}).status_code == 403
    assert client.post("/api/me/password", json={"current": PASSWORD, "new": "krotkie"}).status_code == 422
    assert client.post("/api/me/password", json={"current": PASSWORD, "new": "nowe-haslo-456"}).status_code == 200
    other = fresh(client)
    assert other.post("/api/auth/login", json={"identifier": "ola", "password": PASSWORD}).status_code == 401
    assert other.post("/api/auth/login", json={"identifier": "ola", "password": "nowe-haslo-456"}).status_code == 200
    assert client.get("/api/me").status_code == 200


def test_forgot_and_reset(client):
    register(client)
    other = fresh(client)
    assert other.post("/api/auth/forgot", json={"email": "nikt@example.com"}).status_code == 202
    assert len([m for m in mailer.outbox() if "nikt@" in m["to"]]) == 0
    assert other.post("/api/auth/forgot", json={"email": "ola@example.com"}).status_code == 202
    token = token_from_outbox("reset")
    assert other.post("/api/auth/reset", json={"token": token, "password": "krotkie"}).status_code == 422
    assert other.post("/api/auth/reset", json={"token": token, "password": "reset-haslo-789"}).status_code == 200
    assert other.post("/api/auth/reset", json={"token": token, "password": "reset-haslo-789"}).status_code == 400
    assert client.get("/api/me").status_code == 401
    assert other.post("/api/auth/login", json={"identifier": "ola", "password": "reset-haslo-789"}).status_code == 200


def test_password_stored_only_as_hash(client):
    register(client)
    with sqlite3.connect(db_path()) as db:
        stored = db.execute("SELECT password_hash FROM users").fetchone()[0]
        dump = "\n".join(db.iterdump())
    assert stored.startswith("scrypt$") and PASSWORD not in dump
    token = client.cookies.get(security.COOKIE)
    assert token not in dump
    assert security.verify_password(PASSWORD, stored)


def test_fields_crud_and_isolation(client):
    register(client)
    created = client.post(
        "/api/fields",
        json={"name": "Pole nad rzeką", "crop": "wheat", "parcels": [{"id": "x", "geometry": SQUARE}]},
    )
    assert created.status_code == 201
    field = created.json()
    assert field["last_report"] is None and field["parcels"][0]["id"] == "x" and field["color"]
    patched = client.patch(f"/api/fields/{field['id']}", json={"name": "Nowa", "color": "#112233"})
    assert patched.json()["name"] == "Nowa" and patched.json()["parcels"]
    report = {"risk": "Podwyższone", "dry_spell_days": 9, "crop_balance_mm": -12.5}
    saved = client.put(f"/api/fields/{field['id']}/last-report", json=report).json()
    assert saved["last_report"]["saved_at"] and saved["last_report"]["risk"] == "Podwyższone"
    assert client.post("/api/fields", json={"name": "x", "crop": "nieznana"}).status_code == 422
    assert client.post("/api/fields", json={"name": "x", "parcels": [{"id": "a", "geometry": {"type": "Point"}}]}).status_code == 422

    register(fresh_client := fresh(client), name="ewa", email="ewa@example.com")
    assert fresh_client.get("/api/fields").json() == []
    for call in (
        fresh_client.get(f"/api/fields/{field['id']}"),
        fresh_client.patch(f"/api/fields/{field['id']}", json={"name": "obce"}),
        fresh_client.put(f"/api/fields/{field['id']}/last-report", json=report),
        fresh_client.delete(f"/api/fields/{field['id']}"),
    ):
        assert call.status_code == 404
    assert client.get(f"/api/fields/{field['id']}").json()["name"] == "Nowa"
    assert client.delete(f"/api/fields/{field['id']}").status_code == 204
    assert client.get("/api/fields").json() == []


def test_fields_need_session_and_account_deletion_removes_fields(client):
    assert client.get("/api/fields").status_code == 401
    register(client)
    client.post("/api/fields", json={"name": "A"})
    assert client.delete("/api/me").status_code == 204
    with sqlite3.connect(db_path()) as db:
        assert db.execute("SELECT COUNT(*) FROM fields").fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    assert client.get("/api/me").status_code == 401


def test_core_works_without_session(client):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/crops").status_code == 200
    assert client.get("/api/passport/questions").status_code == 200


def verified_user_with_field(client, report):
    register(client)
    client.post("/api/auth/verify", json={"token": token_from_outbox("potwierd")})
    field = client.post("/api/fields", json={"name": "Łąka"}).json()
    client.put(f"/api/fields/{field['id']}/last-report", json=report)
    return field


def test_attention_thresholds():
    ok = {"risk": "Niskie", "dry_spell_days": 6, "crop_balance_mm": 0}
    assert rules.reasons(ok) == []
    assert [c for c, _ in rules.reasons({**ok, "risk": "Podwyższone"})] == ["risk"]
    assert [c for c, _ in rules.reasons({**ok, "risk": "Sygnał niedoboru"})] == ["risk"]
    assert [c for c, _ in rules.reasons({**ok, "dry_spell_days": 7})] == ["dry"]
    assert [c for c, _ in rules.reasons({**ok, "crop_balance_mm": -0.1})] == ["balance"]


def test_attention_email_dedup(client):
    bad = {"risk": "Podwyższone", "dry_spell_days": 8, "crop_balance_mm": -5}
    field = verified_user_with_field(client, bad)
    before = len(mailer.outbox())
    assert rules.send_attention_emails() == 1
    sent = mailer.outbox()[before:]
    assert len(sent) == 1 and "Łąka" in sent[0]["body"] and sent[0]["to"] == "ola@example.com"
    assert rules.send_attention_emails() == 0
    assert len(mailer.outbox()) == before + 1
    # zmiana powodów -> nowa wiadomość
    client.put(f"/api/fields/{field['id']}/last-report", json={**bad, "dry_spell_days": 1})
    assert rules.send_attention_emails() == 1
    # powrót do normy czyści deduplikację, kolejny alarm znów wysyła
    client.put(f"/api/fields/{field['id']}/last-report", json={"risk": "Niskie", "dry_spell_days": 0, "crop_balance_mm": 3})
    assert rules.send_attention_emails() == 0
    client.put(f"/api/fields/{field['id']}/last-report", json=bad)
    assert rules.send_attention_emails() == 1


def test_attention_respects_preferences_and_verification(client):
    bad = {"risk": "Podwyższone", "dry_spell_days": 8, "crop_balance_mm": -5}
    register(client)
    field = client.post("/api/fields", json={"name": "A"}).json()
    client.put(f"/api/fields/{field['id']}/last-report", json=bad)
    assert rules.send_attention_emails() == 0  # niepotwierdzony e-mail
    client.post("/api/auth/verify", json={"token": token_from_outbox("potwierd")})
    assert client.get("/api/me/notifications").json()["email_enabled"] is True
    assert client.patch("/api/me/notifications", json={"email_enabled": False}).json()["email_enabled"] is False
    assert rules.send_attention_emails() == 0
    client.patch("/api/me/notifications", json={"email_enabled": True})
    assert rules.send_attention_emails() == 1
