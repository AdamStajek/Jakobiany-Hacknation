"""Baza kont i pól (SQLite ze standardowej biblioteki), osobna od cache z `wodo/store.py`."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from threading import Lock

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    email_verified INTEGER NOT NULL DEFAULT 0,
    notify_email INTEGER NOT NULL DEFAULT 1,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    last_seen REAL NOT NULL,
    expires_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS email_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    expires_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS fields (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    crop TEXT,
    parcels TEXT NOT NULL,
    last_report TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS fields_user ON fields(user_id);
CREATE TABLE IF NOT EXISTS notification_log (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    sent_at REAL NOT NULL,
    PRIMARY KEY (user_id, field_id)
);
CREATE TABLE IF NOT EXISTS recommendation_email_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    consent_id TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS recommendation_email_tests (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    attempted_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS recommendation_email_state (
    consent_id TEXT NOT NULL REFERENCES recommendation_email_preferences(consent_id) ON DELETE CASCADE,
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    parcel_id TEXT NOT NULL,
    context TEXT NOT NULL,
    active_ids TEXT NOT NULL,
    pending_ids TEXT NOT NULL,
    sources TEXT NOT NULL,
    PRIMARY KEY (consent_id, field_id, parcel_id)
);
CREATE TABLE IF NOT EXISTS notification_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    push_enabled INTEGER NOT NULL DEFAULT 0,
    quiet_enabled INTEGER NOT NULL DEFAULT 0,
    quiet_start TEXT NOT NULL DEFAULT '22:00',
    quiet_end TEXT NOT NULL DEFAULT '07:00',
    timezone TEXT NOT NULL DEFAULT 'Europe/Warsaw'
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS push_log (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    sent_at REAL NOT NULL,
    PRIMARY KEY (user_id, field_id)
);
"""
READY = set()
LOCK = Lock()


def data_dir():
    path = Path(
        os.environ.get("WODO_DATA_DIR")
        or os.environ.get("WODO_CACHE_DIR")
        or Path(__file__).parent.parent / ".wodo-data"
    )
    path.mkdir(parents=True, exist_ok=True)
    return path


def db_path():
    return Path(os.environ.get("WODO_DB_PATH") or data_dir() / "app.sqlite")


@contextmanager
def connect():
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    try:
        db.execute("PRAGMA foreign_keys = ON")
        with LOCK:
            if str(path) not in READY:
                db.execute("PRAGMA journal_mode = WAL")
                db.executescript(SCHEMA)
                READY.add(str(path))
        with db:
            yield db
    finally:
        db.close()
