import hashlib
import json
import logging
import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing, contextmanager
from datetime import UTC, datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import uuid4

API = "/api/v1"
ROOT = Path(__file__).resolve().parent.parent
APPLICATION_ID = 0x524D3230
SCHEMA_VERSION = 1
ACCEPTED = {"approved", "corrected"}
SCHEMA = """
CREATE TABLE projects (
    id TEXT PRIMARY KEY, owner TEXT, data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE TABLE records (
    kind TEXT NOT NULL, id TEXT NOT NULL, project_id TEXT REFERENCES projects(id),
    data TEXT NOT NULL CHECK(json_valid(data)), meta TEXT NOT NULL CHECK(json_valid(meta)),
    PRIMARY KEY(kind, id)
);
CREATE INDEX records_project ON records(project_id, kind, id);
CREATE INDEX records_review ON records(kind, json_extract(data, '$.review_status'), id);
CREATE INDEX records_target ON records(kind, json_extract(data, '$.target_id'));
CREATE INDEX records_external ON records(kind, json_extract(meta, '$.external_key'));
CREATE INDEX records_job ON records(kind, json_extract(data, '$.status'), json_extract(data, '$.created_at'));
CREATE TABLE assets (id TEXT PRIMARY KEY, content BLOB NOT NULL);
CREATE TABLE idempotency (
    actor TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL, key TEXT NOT NULL,
    fingerprint TEXT NOT NULL, response TEXT NOT NULL CHECK(json_valid(response)),
    PRIMARY KEY(actor, method, path, key)
);
"""
TABLES = {"projects", "records", "assets", "idempotency"}


class Problem(Exception):  # noqa: N818
    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status = status
        self.data = {"code": code, "message": message}
        if details:
            self.data["details"] = details


def now():
    return datetime.now(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")


def dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def fingerprint(*values):
    return hashlib.sha256(dump(values).encode()).hexdigest()


def identifier(kind, *values):
    return f"{kind}_{fingerprint(*values)[:32] if values else uuid4().hex}"


def ref(kind, record_id):
    return {"type": kind, "id": record_id}


def unique(values):
    return list(dict.fromkeys(values))


def missing():
    return Problem(404, "not_found", "Nie znaleziono dostępnego zasobu.")


@contextmanager
def connect(path: Path, write=False) -> Iterator[sqlite3.Connection]:
    with closing(
        sqlite3.connect(
            path.as_uri() + "?mode=rw", uri=True, timeout=15, check_same_thread=False
        )
    ) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        with db:
            db.execute("BEGIN IMMEDIATE" if write else "BEGIN")
            yield db


def target_path():
    return Path(
        os.getenv("RISK_MINER_DB_PATH", str(ROOT / "data/risk-miner.db"))
    ).absolute()


@contextmanager
def new_database(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, suffix=".db") as temporary:
        staging = Path(temporary.name)
        with closing(sqlite3.connect(staging)) as db:
            db.executescript(SCHEMA)
            db.execute(f"PRAGMA application_id = {APPLICATION_ID}")
            db.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        yield staging
        verify_database(staging)
        os.link(staging, path)


def verify_database(path):
    try:
        with connect(path) as db:
            app_id = db.execute("PRAGMA application_id").fetchone()[0]
            version = db.execute("PRAGMA user_version").fetchone()[0]
            tables = {
                row[0]
                for row in db.execute(
                    "SELECT name FROM sqlite_schema WHERE type = 'table'"
                )
            }
            if (app_id, version) != (
                APPLICATION_ID,
                SCHEMA_VERSION,
            ) or not TABLES <= tables:
                raise ValueError(
                    f"nieobsługiwany schemat SQLite (application_id={app_id}, user_version={version})"
                )
            for table, columns in (
                ("projects", "id, owner, data"),
                ("records", "kind, id, project_id, data, meta"),
                ("assets", "id, content"),
                ("idempotency", "actor, method, path, key, fingerprint, response"),
            ):
                db.execute(f"SELECT {columns} FROM {table} LIMIT 0")
            if (
                db.execute("PRAGMA quick_check").fetchone()[0] != "ok"
                or db.execute("PRAGMA foreign_key_check").fetchone()
            ):
                raise ValueError("błąd integralności SQLite")
    except (OSError, ValueError, sqlite3.DatabaseError) as exc:
        raise RuntimeError(f"{path}: {exc}") from exc


def open_backend(seed):
    path = target_path()
    mock = not os.path.lexists(path)
    if mock:
        path = path.with_name(f"{path.stem}.mock{path.suffix}")
        if not os.path.lexists(path):
            try:
                with new_database(path) as staging, connect(staging, write=True) as db:
                    seed(db)
            except FileExistsError:
                pass
    verify_database(path)
    logging.getLogger("uvicorn.error").info(
        "Risk Miner SQLite: %s (%s)", path, "mock" if mock else "real"
    )
    return path, mock


def put_project(db, value, owner=None):
    db.execute(
        "INSERT INTO projects VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        (value["id"], owner, dump(value)),
    )


def project(db, project_id, actor=None):
    row = db.execute(
        "SELECT owner, data FROM projects WHERE id=?", (project_id,)
    ).fetchone()
    if row is None or (actor is not None and row["owner"] not in (None, actor)):
        raise missing()
    return json.loads(row["data"])


def projects(db, actor):
    return [
        json.loads(row[0])
        for row in db.execute(
            "SELECT data FROM projects WHERE owner IS NULL OR owner=? ORDER BY id",
            (actor,),
        )
    ]


def put(db, kind, value, project_id=None, **meta):
    db.execute(
        """INSERT INTO records VALUES (?, ?, ?, ?, ?) ON CONFLICT(kind, id)
           DO UPDATE SET data=excluded.data, meta=excluded.meta""",
        (kind, value["id"], project_id, dump(value), dump(meta)),
    )
    return value


def unpack(row):
    return json.loads(row["data"]), row["project_id"], json.loads(row["meta"])


def find(db, kind, record_id):
    row = db.execute(
        "SELECT * FROM records WHERE kind=? AND id=?", (kind, record_id)
    ).fetchone()
    return unpack(row) if row else None


def record(db, kind, record_id, actor=None):
    result = find(db, kind, record_id)
    if result is None:
        raise missing()
    _, project_id, meta = result
    if actor is not None:
        if project_id is not None:
            project(db, project_id, actor)
        if meta.get("owner") not in (None, actor):
            raise missing()
    return result


def entries(db, kind, project_id=None):
    if project_id is None:
        rows = db.execute("SELECT * FROM records WHERE kind=? ORDER BY id", (kind,))
    else:
        rows = db.execute(
            "SELECT * FROM records WHERE kind=? AND project_id=? ORDER BY id",
            (kind, project_id),
        )
    return [unpack(row) for row in rows]


def values(db, kind, project_id=None):
    return [value for value, _, _ in entries(db, kind, project_id)]


def asset(db, asset_id, content=None):
    if content is not None:
        db.execute("INSERT OR IGNORE INTO assets VALUES (?, ?)", (asset_id, content))
    row = db.execute("SELECT content FROM assets WHERE id=?", (asset_id,)).fetchone()
    return row[0] if row is not None else None


def revision(db, kind, value, project_id):
    put(
        db,
        "revision",
        {
            "id": identifier("revision", kind, value["id"], value["revision"]),
            "value": value,
        },
        project_id,
    )


def source(db, provider, key, version, project_id=None, raw=None, **fields):
    source_id = identifier("src", provider, key, version)
    previous = find(db, "source", source_id)
    if previous:
        return previous[0]
    return put(
        db,
        "source",
        {
            "id": source_id,
            "provider": provider,
            "identifier": key,
            "version": str(version),
            "retrieved_at": now(),
            **fields,
        },
        project_id,
        raw=raw,
        external_key=key,
    )


def evidence(db, project_id, origin, locator, quote=None, **fields):
    evidence_id = identifier("ev", project_id, origin["id"], locator, fields)
    value = {"id": evidence_id, "source": origin, "locator": locator, **fields}
    if quote:
        value["quote"] = quote
    return put(db, "evidence", value, project_id)


def review_fields(record_id, status="proposed"):
    return {"id": record_id, "revision": 1, "review_status": status}


def confidence(level, rationale):
    return {"level": level, "rationale": rationale}
