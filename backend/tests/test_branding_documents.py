"""Szablony PDF i HTML w barwach Pole Widzenia: logo, kody QR tylko pod publicznym adresem, wielostronicowy raport."""
import json
from pathlib import Path

from fastapi.testclient import TestClient

import main
from wodo import brand
from wodo.notify import email_layout, mailer, templates
from wodo.pdf_kit import qr_block, styles
from wodo.report import pdf

DOCS = Path(__file__).resolve().parents[2] / "docs"
ROWS = [
    {"name": "Za stodołą", "crop_label": "Pszenica ozima", "area_ha": 3.2, "parcels": 2, "risk": "Podwyższone",
     "reasons": ["ryzyko: Podwyższone"], "report_date": "2026-11-20", "stale": False},
    {"name": "Łąka", "crop_label": "Uprawa nieokreślona", "area_ha": None, "parcels": 1, "risk": None,
     "reasons": [], "report_date": None, "stale": False},
]


def test_assets_exist():
    assert brand.LOGO.exists() and brand.LOGO_WORDMARK.exists()
    assert (brand.FONTS / "DejaVuSans.ttf").exists() and (brand.FONTS / "DejaVuSans-Bold.ttf").exists()


def test_qr_only_for_public_url(monkeypatch):
    monkeypatch.setenv("WODO_PUBLIC_URL", "http://localhost:4200")
    assert brand.public_link("pola") is None and qr_block(brand.public_link("pola"), "x", styles()) is None
    monkeypatch.setenv("WODO_PUBLIC_URL", "https://polewidzenia.example.pl/")
    assert brand.public_link("/pola") == "https://polewidzenia.example.pl/pola"
    assert qr_block(brand.public_link("pola"), "x", styles()) is not None


def test_field_pdf_with_and_without_qr(monkeypatch):
    analysis = json.loads((DOCS / "field-analysis-koscian.json").read_text())
    monkeypatch.setenv("WODO_PUBLIC_URL", "http://localhost:4200")
    plain = pdf(analysis)
    monkeypatch.setenv("WODO_PUBLIC_URL", "https://polewidzenia.example.pl")
    with_qr = pdf(analysis)
    assert plain.startswith(b"%PDF-") and with_qr.startswith(b"%PDF-")
    assert with_qr != plain


def test_farm_report_pdf_endpoint():
    client = TestClient(main.app)
    response = client.post("/api/farm-report", json={"rows": ROWS}, headers={"X-Requested-With": "XMLHttpRequest"})
    assert response.status_code == 200 and response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    empty = client.post("/api/farm-report", json={"rows": []}, headers={"X-Requested-With": "XMLHttpRequest"})
    assert empty.status_code == 200 and empty.content.startswith(b"%PDF-")
    bad = client.post("/api/farm-report", json={"rows": [{"name": "x"}]}, headers={"X-Requested-With": "XMLHttpRequest"})
    assert bad.status_code == 422


def test_every_template_has_branded_html():
    mails = [templates.verification("Ania", "tok"), templates.reset("Ania", "tok"), templates.welcome("Ania"),
             templates.password_changed("Ania"), templates.attention("Ania", [{"name": "Łąka <1>", "reasons": ["suszą"]}]),
             templates.recommendations("Ania", "f1", "Łąka", "P1", [{"action": "a", "why": "w", "evidence": "e", "when": "k", "limits": "l"}]),
             templates.test_recommendation("Ania")]
    for subject, text, html in mails:
        assert "Pole Widzenia" in subject + text and "WodoStra" not in subject + text + html
        assert f"cid:{email_layout.LOGO_CID}" in html and brand.ORANGE in html and brand.FOREST in html
        assert "<1>" not in html and text.strip()


def test_mail_with_html_is_multipart_with_inline_logo(monkeypatch):
    sent = []

    class FakeSMTP:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self):
            pass

        def send_message(self, message):
            sent.append(message)

    monkeypatch.setenv("WODO_SMTP_HOST", "smtp.test")
    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    assert mailer.send("a@b.pl", *templates.welcome("Ania"))
    message = sent[0]
    assert message.get_body(("plain",)) is not None and message.get_body(("html",)) is not None
    assert [part.get_content_type() for part in message.walk() if part.get_content_maintype() == "image"] == ["image/png"]


# --- Podsumowanie tygodniowe i alerty pogodowe ---

from datetime import date  # noqa: E402

from wodo.auth import security  # noqa: E402
from wodo.db import connect  # noqa: E402
from wodo.notify import digest, weather_alerts  # noqa: E402

SQUARE = {"type": "Polygon", "coordinates": [[[17, 52], [17.01, 52], [17.01, 52.01], [17, 52.01], [17, 52]]]}


def make_user(now):
    with connect() as db:
        db.execute("INSERT INTO users (id, email, username, password_hash, email_verified, notify_email, created_at) "
                   "VALUES (1, 'a@b.pl', 'Ania', 'x', 1, 1, ?)", (now,))
        for fid, name, report, updated in (
            ("f1", "Łąka", json.dumps({"risk": "Podwyższone", "dry_spell_days": 9, "crop_balance_mm": -12}), now),
            ("f2", "Za stodołą", None, now),
            ("f3", "Stare", json.dumps({"risk": "Niskie w modelu", "dry_spell_days": 0, "crop_balance_mm": 3}), now - 20 * 86400),
        ):
            db.execute("INSERT INTO fields (id, user_id, name, color, crop, parcels, last_report, created_at, updated_at) "
                       "VALUES (?, 1, ?, '#2f7d4f', NULL, ?, ?, ?, ?)",
                       (fid, name, json.dumps([{"id": "p", "geometry": SQUARE}]), report, now, updated))


def test_weekly_digest_content_and_dedupe(tmp_path, monkeypatch):
    monkeypatch.setenv("WODO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("WODO_DB_PATH", raising=False)
    now = security.now()
    make_user(now)
    sent = []
    assert digest.send_weekly_digests(lambda *a: sent.append(a) or True, now=now) == 1
    to, subject, text, html = sent[0]
    assert to == "a@b.pl" and "Łąka" in text and "Za stodołą" in text and "Stare" in text
    assert "Łąka" in html and f"cid:{email_layout.LOGO_CID}" in html
    assert digest.send_weekly_digests(lambda *a: sent.append(a) or True, now=now + 3 * 86400) == 0
    assert digest.send_weekly_digests(lambda *a: sent.append(a) or True, now=now + 8 * 86400) == 1


def test_weather_alerts_thresholds_and_dedupe(tmp_path, monkeypatch):
    monkeypatch.setenv("WODO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("WODO_DB_PATH", raising=False)
    now = security.now()
    make_user(now)
    start = date(2026, 6, 1)
    rows = {"2026-06-01": {"rain": 3, "temperature": 20}, "2026-06-02": {"rain": 25, "hourly_rain_max": 12, "temperature": 33},
            "2026-06-09": {"rain": 40}}
    assert [(k, d) for k, d, _ in weather_alerts.alerts_in(rows, start)] == [("rain", "2026-06-02"), ("heat", "2026-06-02")]
    sent = []
    forecast = lambda lon, lat, day: {"rows": rows}  # noqa: E731
    send = lambda *a: sent.append(a) or True  # noqa: E731
    assert weather_alerts.send_weather_alerts(forecast, send, start=start, now=now) == 1
    _, subject, text, html = sent[0]
    assert "Upał" in subject and "Łąka" in text and "Co warto zrobić?" in html
    assert weather_alerts.send_weather_alerts(forecast, send, start=start, now=now + 3600) == 0


def test_weather_alerts_need_open_meteo_consent(tmp_path, monkeypatch):
    monkeypatch.setenv("WODO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("WODO_NONCOMMERCIAL_OPEN_METEO", raising=False)
    assert weather_alerts.send_weather_alerts() == 0


def test_new_templates_branded():
    summary = {"total": 3, "attention": [{"name": "Łąka <1>", "reasons": ["suchy okres"]}], "no_report": ["A"], "stale": ["B"]}
    items = [{"name": "Łąka", "kind": "rain", "day": "2026-06-02", "detail": "opad do 25 mm"},
             {"name": "Łąka", "kind": "heat", "day": "2026-06-02", "detail": "maksymalnie 33 °C"}]
    for _subject, text, html in (templates.weekly_summary("Ania", summary), templates.weather_alert("Ania", items)):
        assert "Pole Widzenia" in text and brand.FOREST in html and "<1>" not in html
        assert f"cid:{email_layout.LOGO_CID}" in html
