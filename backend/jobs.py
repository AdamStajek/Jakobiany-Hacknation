import logging
import os
from threading import Event, Thread
from urllib.parse import quote

from analysis import evaluate
from domain import active_rules
from enrichment import enrich
from extensions import run_chaos
from intake import MAX_TEXT, document_text, extract_document, import_row
from model import review_document
from store import (
    API,
    Problem,
    asset,
    connect,
    entries,
    find,
    identifier,
    now,
    project,
    put,
    record,
)

LOG = logging.getLogger("uvicorn.error")


def result(kind, key, route):
    return {"resource_type": kind, "resource_id": key, "href": API + route}


def enqueue(db, kind, payload, owner, project_id=None):
    value = {
        "id": identifier("job"),
        "type": kind,
        "status": "queued",
        "created_at": now(),
        "results": [],
        "report": [],
    }
    return put(db, "job", value, project_id, owner=owner, payload=payload)


def import_items(path, payload, stopped):
    for line, fields in payload["rows"]:
        if stopped():
            return
        try:
            with connect(path, write=True) as db:
                project_id = import_row(
                    db, payload["filename"], payload["columns"], line, fields
                )
        except Problem as exc:
            yield (
                {
                    "stage": "validation",
                    "status": "error",
                    "row": line,
                    "error": exc.data,
                },
                None,
            )
            continue
        yield (
            {
                "stage": "import",
                "status": "found",
                "row": line,
                "project_id": project_id,
            },
            result("project", project_id, f"/projects/{quote(project_id, safe='')}"),
        )
        for report in enrich(path, project_id, []):
            if stopped():
                return
            yield {"row": line, **report}, None


def extract_version(path, project_id, version_id):
    with connect(path, write=True) as db:
        version, _, meta = record(db, "document_version", version_id)
        if version["extraction_status"] == "ready":
            return None, None
        version["extraction_status"] = "running"
        put(db, "document_version", version, project_id, **meta)
        blob = asset(db, version_id)
        rules = active_rules(
            db, project(db, project_id).get("sector_code", "water_and_sewerage")
        )
        categories = (
            {item["code"]: item["label"] for item in rules["risk_categories"]}
            if rules
            else {}
        )
    try:
        sections = document_text(version["media_type"], blob)
        if not any(text.strip() for _, text in sections):
            raise ValueError("Dokument nie zawiera warstwy tekstowej.")
        if sum(len(text) for _, text in sections) > MAX_TEXT:
            raise ValueError("Warstwa tekstowa przekracza dopuszczalną długość.")
        findings, model_error = review_document(sections, categories)
        with connect(path, write=True) as db:
            proofs = extract_document(db, version, project_id, sections, findings)
            version["extraction_status"] = "ready"
            put(
                db,
                "document_version",
                version,
                project_id,
                evidence_ids=proofs,
                sections=sections,
            )
            document = record(db, "document", version["document_id"])[0]
            if document["current_version_id"] == version_id:
                supersede_old_proposals(db, project_id, version)
        return None, model_error
    except Exception as exc:
        LOG.info(
            "Document extraction failed for %s (%s)", version_id, type(exc).__name__
        )
        with connect(path, write=True) as db:
            version["extraction_status"] = "failed"
            put(db, "document_version", version, project_id, **meta)
        return {
            "code": "extraction_failed",
            "message": str(exc)
            if isinstance(exc, ValueError)
            else "Nie można odczytać warstwy tekstowej dokumentu.",
        }, None


def supersede_old_proposals(db, project_id, version):
    for kind in ("fact", "risk"):
        for item, _, meta in entries(db, kind, project_id):
            if item["review_status"] != "proposed":
                continue
            proofs = [record(db, "evidence", key)[0] for key in item["evidence_ids"]]
            document_versions = {
                proof.get("document_version_id")
                for proof in proofs
                if proof.get("document_id") == version["document_id"]
            }
            if document_versions and version["id"] not in document_versions:
                put(
                    db,
                    kind,
                    {
                        **item,
                        "review_status": "superseded",
                        "revision": item["revision"] + 1,
                    },
                    project_id,
                    **meta,
                )


def work(path, job, project_id, meta, stopped):
    payload = meta["payload"]
    kind = job["type"]
    if kind == "import":
        yield from import_items(path, payload, stopped)
        return
    if kind == "enrichment":
        for report in enrich(path, project_id, payload.get("references", [])):
            if stopped():
                return
            yield report, None
        yield (
            None,
            result("project", project_id, f"/projects/{quote(project_id, safe='')}"),
        )
        return
    if kind == "document_extraction":
        version_id = payload["version_id"]
        with connect(path) as db:
            version = record(db, "document_version", version_id)[0]
        error, model_error = extract_version(path, project_id, version_id)
        report = {
            "stage": "extraction",
            "status": "error" if error else "found",
            "project_id": project_id,
        }
        if error:
            report["error"] = error
        yield (
            report,
            result(
                "document_version",
                version_id,
                f"/documents/{version['document_id']}/versions/{version_id}",
            ),
        )
        if model_error:
            yield (
                {
                    "stage": "extraction",
                    "status": "error",
                    "project_id": project_id,
                    "error": {"code": "model_unavailable", "message": model_error},
                },
                None,
            )
        return
    with connect(path, write=True) as db:
        if kind == "assessment":
            key = identifier("assessment", job["id"])
            if not find(db, "assessment", key):
                evaluate(db, key, meta["owner"], payload)
            outputs = [result("assessment", key, f"/assessments/{key}")]
        else:
            outputs = [
                result(
                    "chaos_run",
                    item["id"],
                    f"/assessments/{item['assessment_id']}/chaos/{item['id']}",
                )
                for item in run_chaos(db, job["id"], payload)
            ]
    for output in outputs:
        yield {"stage": kind, "status": "found", "project_id": project_id}, output


def next_job(path):
    with connect(path, write=True) as db:
        row = db.execute("""SELECT * FROM records WHERE kind='job' AND json_extract(data, '$.status')='queued'
                            ORDER BY json_extract(data, '$.created_at'), id LIMIT 1""").fetchone()
        if row is None:
            return None
        from store import unpack

        job, project_id, meta = unpack(row)
        job["status"] = "running"
        put(db, "job", job, project_id, **meta)
        return job, project_id, meta


def finish_job(path, job, project_id, meta, stopped):
    try:
        for report, output in work(path, job, project_id, meta, stopped):
            if report:
                job["report"].append(report)
            if output and output not in job["results"]:
                job["results"].append(output)
            with connect(path, write=True) as db:
                put(db, "job", job, project_id, **meta)
        if stopped():
            return
    except Exception:
        LOG.exception("Job %s failed", job["id"])
        stage = {
            "document_extraction": "extraction",
            "enrichment": "fetch",
            "import": "import",
        }.get(job["type"], job["type"])
        job["report"].append(
            {
                "stage": stage,
                "status": "error",
                "error": {
                    "code": "job_error",
                    "message": "Wystąpił nieoczekiwany błąd zadania.",
                },
            }
        )
    errors = any(item["status"] == "error" for item in job["report"])
    useful = (
        bool(job["results"])
        if job["type"] != "enrichment"
        else any(
            item["status"] in {"found", "matched", "needs_review"}
            for item in job["report"]
        )
    )
    if job["type"] == "document_extraction" and any(
        item.get("error", {}).get("code") == "extraction_failed"
        for item in job["report"]
    ):
        useful = False
    if errors or (job["type"] == "import" and not useful):
        job["status"] = "partial" if useful else "failed"
    else:
        job["status"] = "succeeded"
    job["finished_at"] = now()
    with connect(path, write=True) as db:
        # Results are materialized before completion, so completed jobs need only the public report.
        put(db, "job", job, project_id, owner=meta["owner"])


def schedule_monitoring(path, seconds):
    if os.getenv("RISK_MINER_OFFLINE") == "1":
        return
    from datetime import UTC, datetime, timedelta

    threshold = (
        (datetime.now(UTC) - timedelta(seconds=seconds))
        .isoformat()
        .replace("+00:00", "Z")
    )
    with connect(path, write=True) as db:
        for value, project_id, meta in entries(db, "monitoring"):
            if (
                value["enabled"]
                and meta.get("last_check", "") < threshold
                and project(db, project_id)["status"] == "in_progress"
            ):
                enqueue(db, "enrichment", {}, meta["owner"], project_id)
                put(
                    db, "monitoring", value, project_id, **{**meta, "last_check": now()}
                )


def worker(path):
    running = Event()
    with connect(path, write=True) as db:
        for job, project_id, meta in entries(db, "job"):
            if job["status"] == "running":
                put(
                    db,
                    "job",
                    {**job, "status": "queued", "report": [], "results": []},
                    project_id,
                    **meta,
                )

    def loop():
        from time import monotonic

        next_check = 0
        cadence = max(60, int(os.getenv("RISK_MINER_MONITOR_SECONDS", "3600")))
        while not running.is_set():
            try:
                current = monotonic()
                if current >= next_check:
                    schedule_monitoring(path, cadence)
                    next_check = current + min(cadence, 60)
                pending = next_job(path)
                if pending:
                    finish_job(path, *pending, running.is_set)
                else:
                    running.wait(0.25)
            except Exception:
                LOG.exception("Risk Miner worker error")
                running.wait(1)

    thread = Thread(target=loop, name="risk-miner-jobs", daemon=True)
    thread.start()
    return running, thread
