"""Alerty pogodowe z prognozy Open-Meteo: intensywny deszcz i upał w najbliższych dniach. Raz na pole i dzień."""
import json
import logging
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from shapely.geometry import shape

from wodo import weather
from wodo.auth import security
from wodo.db import connect
from wodo.notify import mailer, quiet, templates
from wodo.store import SourceError

log = logging.getLogger(__name__)
HORIZON_DAYS = 3
RAIN_DAY_MM = 20
RAIN_HOUR_MM = 10
HEAT_C = 32
KEEP_DAYS = 14


def today():
    return datetime.now(ZoneInfo("Europe/Warsaw")).date()


def alerts_in(rows, start):
    """Zwraca [(rodzaj, dzień, opis)] dla dni z progiem przekroczonym w oknie `HORIZON_DAYS`."""
    found = []
    for offset in range(HORIZON_DAYS):
        day = (start + timedelta(days=offset)).isoformat()
        row = rows.get(day) or {}
        rain, hourly, heat = row.get("rain"), row.get("hourly_rain_max"), row.get("temperature")
        if (rain is not None and rain >= RAIN_DAY_MM) or (hourly is not None and hourly >= RAIN_HOUR_MM):
            parts = ([f"opad do {rain:g} mm w dobie".replace(".", ",")] if rain is not None else [])
            if hourly is not None and hourly >= RAIN_HOUR_MM:
                parts.append(f"do {hourly:g} mm na godzinę".replace(".", ","))
            found.append(("rain", day, ", ".join(parts) or "intensywny deszcz"))
        if heat is not None and heat >= HEAT_C:
            found.append(("heat", day, f"maksymalnie {heat:g} °C".replace(".", ",")))
    return found


def field_point(parcels):
    for parcel in json.loads(parcels):
        try:
            point = shape(parcel["geometry"]).representative_point()
        except (KeyError, ValueError, TypeError):
            continue
        return point.x, point.y
    return None


def send_weather_alerts(forecast=weather.forecast, send=mailer.send, start=None, now=None):
    """Zwraca liczbę wysłanych maili. Bez zgody na użycie prognozy (WODO_NONCOMMERCIAL_OPEN_METEO) nic nie robi."""
    if forecast is weather.forecast and os.environ.get("WODO_NONCOMMERCIAL_OPEN_METEO") != "1":
        return 0
    start = start or today()
    now = now if now is not None else security.now()
    with connect() as db:
        db.execute("DELETE FROM alert_log WHERE sent_at < ?", (now - KEEP_DAYS * 86400,))
        users = db.execute("SELECT * FROM users WHERE email_verified = 1 AND notify_email = 1").fetchall()
    sent = 0
    for user in users:
        try:
            with connect() as db:
                if quiet.quiet_now(db, user["id"], now):
                    continue
                known = {tuple(r) for r in db.execute(
                    "SELECT field_id, kind, day FROM alert_log WHERE user_id = ?", (user["id"],))}
                fields = db.execute("SELECT id, name, parcels FROM fields WHERE user_id = ? ORDER BY created_at, id",
                                    (user["id"],)).fetchall()
                items = []
                for field in fields:
                    point = field_point(field["parcels"])
                    if point is None:
                        continue
                    try:
                        rows = forecast(point[0], point[1], start)["rows"]
                    except SourceError:
                        log.warning("Brak prognozy dla pola %s", field["id"])
                        continue
                    items += [{"field_id": field["id"], "name": field["name"], "kind": kind, "day": day, "detail": detail}
                              for kind, day, detail in alerts_in(rows, start) if (field["id"], kind, day) not in known]
                if not items or not send(user["email"], *templates.weather_alert(user["username"], items)):
                    continue
                db.executemany("INSERT OR IGNORE INTO alert_log VALUES (?, ?, ?, ?, ?)",
                               [(user["id"], i["field_id"], i["kind"], i["day"], now) for i in items])
                sent += 1
        except Exception:
            log.exception("Alert pogodowy dla użytkownika %s nie powiódł się", user["id"])
    return sent
