"""Bounded, persistent cache for independently retrieved inputs and reports."""

import hashlib
import json
import os
import random
import sqlite3
import time
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock

import httpx

VERSION = "5"
ROOT = Path(os.environ.get("WODO_CACHE_DIR", ".wodo-cache"))
LIMIT = 20_000_000
ULDK = "https://uldk.gugik.gov.pl/"
NASA = "https://power.larc.nasa.gov/api/temporal/daily/point"
IMGW = "https://danepubliczne.imgw.pl/api/data/"
STAC = "https://earth-search.aws.element84.com/v1/search"
ISRIC = "https://maps.isric.org/mapserv"
WORLD = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
MS_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
NMT = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DigitalTerrainModelFormatTIFF"
TOPO = "https://api.opentopodata.org/v1/eudem25m"
HOSTS = {
    httpx.URL(url).host for url in (ULDK, NASA, IMGW, STAC, ISRIC, WORLD, TOPO, MS_STAC, NMT)
} | {"archive-api.open-meteo.com", "api.open-meteo.com"}
INIT_LOCK = Lock()
INITIALIZED = set()
CLIENT = httpx.Client(timeout=httpx.Timeout(9, connect=4), limits=httpx.Limits(max_connections=24),
                      headers={"User-Agent": "PoleWidzenia/1.0 (HackNation research prototype)"})


class SourceError(Exception):
    """An upstream source answered without usable evidence."""


def timestamp():
    return datetime.now(UTC).isoformat(timespec="seconds")


def fetch(url, params=None, timeout=None, limit=LIMIT):
    target = httpx.URL(url)
    if target.scheme != "https" or target.host not in HOSTS or target.port is not None:
        raise SourceError("Niedozwolony adres źródła.")
    for attempt in range(2):
        try:
            with CLIENT.stream("GET", url, params=params, timeout=timeout or CLIENT.timeout) as response:
                response.raise_for_status()
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > limit:
                        raise SourceError("Odpowiedź źródła przekroczyła limit rozmiaru.")
                return bytes(body)
        except (httpx.TransportError, httpx.HTTPStatusError) as error:
            code = error.response.status_code if isinstance(error, httpx.HTTPStatusError) else None
            if attempt == 0 and (code is None or code in (429, 502, 503, 504)):
                time.sleep(0.25 + random.random() * 0.2)
                continue
            raise SourceError(f"Usługa zwróciła HTTP {code}." if code else "Brak połączenia ze źródłem.") from error


def payload(url, params=None, timeout=None):
    try:
        return json.loads(fetch(url, params, timeout))
    except (ValueError, UnicodeError) as error:
        raise SourceError("Źródło zwróciło nieczytelną odpowiedź.") from error


@contextmanager
def connect():
    path = ROOT / "data.sqlite3"
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=6)
    try:
        if path not in INITIALIZED:
            with INIT_LOCK:
                if path not in INITIALIZED:
                    db.execute("PRAGMA journal_mode=WAL")
                    db.execute("""CREATE TABLE IF NOT EXISTS entries (
                        key TEXT PRIMARY KEY, updated REAL, digest TEXT, value BLOB
                    )""")
                    INITIALIZED.add(path)
        with db:
            yield db
    finally:
        db.close()


def read(key, ttl):
    with connect() as db:
        row = db.execute("SELECT updated, digest, value FROM entries WHERE key=?", (key,)).fetchone()
    if row is None or time.time() - row[0] > ttl or digest(row[2]) != row[1]:
        return None
    return json.loads(row[2])


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write(key, value):
    raw = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
    if len(raw) > LIMIT:
        raise SourceError("Przetworzone dane przekroczyły limit rozmiaru.")
    now = time.time()
    with connect() as db:
        db.execute("INSERT OR REPLACE INTO entries VALUES (?,?,?,?)", (key, now, digest(raw), raw))
        db.execute("DELETE FROM entries WHERE updated < ?", (now - 120 * 86400,))
        db.execute("DELETE FROM entries WHERE key IN (SELECT key FROM entries ORDER BY updated DESC LIMIT -1 OFFSET 700)")


def cached(name, args, days, operation):
    key = f"{VERSION}:{name}:{digest(json.dumps(args, sort_keys=True).encode())}"
    result = read(key, days * 86400)
    if result is None:
        result = operation()
        result["retrieved_at"] = timestamp()
        write(key, result)
        return {**result, "cached": False}
    return {**result, "cached": True}
