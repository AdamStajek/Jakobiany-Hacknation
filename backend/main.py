import csv
import json
import logging
import os
import secrets
from contextlib import asynccontextmanager
from io import StringIO
from pathlib import Path
from typing import Annotated
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException

import analysis
import expert
import extensions
from contract import SPEC, resolve, schema_fields, validate
from domain import evidence_records, export_row, project_detail, project_export
from intake import (
    input_rows,
    media_type,
    mock_seed,
    register_description,
    save_document,
)
from jobs import enqueue, worker
from store import (
    ACCEPTED,
    API,
    Problem,
    asset,
    connect,
    entries,
    find,
    fingerprint,
    identifier,
    missing,
    now,
    open_backend,
    project,
    projects,
    put,
    put_project,
    record,
    revision,
    values,
)

ROLES = {"analyst", "expert", "operator"}
DEFAULT_FILE_LIMIT = 10 * 1024 * 1024


def credentials(mock):
    encoded = os.getenv("RISK_MINER_TOKENS")
    if not encoded:
        if not mock:
            raise RuntimeError("Ustaw RISK_MINER_TOKENS dla rzeczywistej bazy.")
        return {
            "demo-analyst": {"id": "demo-analyst", "roles": ["analyst"]},
            "demo-expert": {"id": "demo-analyst", "roles": ["expert"]},
            "demo-operator": {"id": "demo-operator", "roles": ["operator"]},
            "demo": {"id": "demo", "roles": sorted(ROLES)},
        }
    try:
        users = json.loads(encoded)
        if not isinstance(users, dict) or not users:
            raise ValueError
        for token, user in users.items():
            if not token or any(character.isspace() for character in token):
                raise ValueError
            validate(user["id"], "Id")
            if (
                not isinstance(user["roles"], list)
                or not user["roles"]
                or set(user["roles"]) - ROLES
            ):
                raise ValueError
        return users
    except (TypeError, KeyError, ValueError, Problem) as exc:
        raise RuntimeError(
            "RISK_MINER_TOKENS musi mapować tokeny na identyfikatory i role."
        ) from exc


@asynccontextmanager
async def lifespan(app):
    import fcntl

    path, mock = open_backend(mock_seed)
    app.state.path = path
    app.state.credentials = credentials(mock)
    app.state.max_file_bytes = int(
        os.getenv("RISK_MINER_MAX_FILE_BYTES", str(DEFAULT_FILE_LIMIT))
    )
    if app.state.max_file_bytes <= 0:
        raise RuntimeError("RISK_MINER_MAX_FILE_BYTES musi być dodatnie.")
    with Path(path).open("rb") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise RuntimeError(f"{path}: baza ma już aktywny proces backendu.") from exc
        stopped, thread = worker(path)
        try:
            yield
        finally:
            stopped.set()
            thread.join()


app = FastAPI(
    title=SPEC["info"]["title"], version=SPEC["info"]["version"], lifespan=lifespan
)
app.openapi = lambda: SPEC


def error_response(request, exc):
    request_id = getattr(request.state, "request_id", None) or identifier("req")
    return JSONResponse(
        {**exc.data, "request_id": request_id},
        status_code=exc.status,
        headers={"WWW-Authenticate": "Bearer"} if exc.status == 401 else None,
    )


@app.exception_handler(Problem)
async def problem_handler(request, exc):
    return error_response(request, exc)


@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc):
    return error_response(
        request,
        Problem(
            422,
            "validation_error",
            "Niepoprawne dane żądania.",
            [
                {
                    "field": ".".join(str(part) for part in item["loc"]),
                    "message": item["msg"],
                }
                for item in exc.errors()
            ],
        ),
    )


@app.exception_handler(HTTPException)
async def http_handler(request, exc):
    return error_response(
        request, Problem(exc.status_code, "http_error", str(exc.detail))
    )


@app.exception_handler(Exception)
async def unexpected_handler(request, exc):
    logging.getLogger("uvicorn.error").error(
        "Request failed (%s)", request.url.path, exc_info=exc
    )
    return error_response(
        request, Problem(500, "internal_error", "Wystąpił błąd serwera.")
    )


class BodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT"}:
            await self.app(scope, receive, send)
            return
        request = Request(scope, receive)
        multipart = (
            request.headers.get("content-type", "")
            .lower()
            .startswith("multipart/form-data")
        )
        limit = (
            request.app.state.max_file_bytes + 128 * 1024 if multipart else 1024 * 1024
        )
        size = 0
        too_large = False

        async def bounded_receive():
            nonlocal size, too_large
            message = await receive()
            size += len(message.get("body", b""))
            if size > limit:
                too_large = True
                raise HTTPException(413, "Żądanie przekracza limit rozmiaru.")
            return message

        async def bounded_send(message):
            if too_large:
                if message["type"] == "http.response.start":
                    response = error_response(
                        request,
                        Problem(
                            413, "file_too_large", "Żądanie przekracza limit rozmiaru."
                        ),
                    )
                    await response(scope, receive, send)
            else:
                await send(message)

        length = request.headers.get("content-length", "")
        if length.isascii() and length.isdecimal() and int(length) > limit:
            response = error_response(
                request,
                Problem(413, "file_too_large", "Żądanie przekracza limit rozmiaru."),
            )
            await response(scope, receive, send)
            return
        await self.app(scope, bounded_receive, bounded_send)


app.add_middleware(BodyLimit)


def auth(request: Request):
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() == "bearer" and token:
        supplied = token.encode()
        for expected, principal in request.app.state.credentials.items():
            if secrets.compare_digest(expected.encode(), supplied):
                return principal
    raise Problem(
        401, "authentication_required", "Wymagany jest poprawny token Bearer."
    )


def require(principal, role):
    if role not in principal["roles"]:
        raise Problem(403, "forbidden", "Tożsamość nie ma wymaganej roli.")


def operation(request):
    path = request.scope["route"].path.removeprefix(API)
    entry = SPEC["paths"][path]
    return entry, entry[request.method.lower()]


def parameters(request, path, method):
    result = {}
    for item in path.get("parameters", []) + method.get("parameters", []):
        parameter = resolve(item)
        key, location = parameter["name"], parameter["in"]
        available = {
            "header": request.headers,
            "query": request.query_params,
            "path": request.path_params,
        }[location]
        schema = parameter["schema"]
        value = available.get(key)
        if value is None:
            if parameter.get("required"):
                raise Problem(422, "validation_error", f"Brak parametru {key}.")
            if "default" in schema:
                result[key] = schema["default"]
            continue
        if schema.get("type") == "integer":
            try:
                value = int(value)
            except ValueError:
                pass
        if schema.get("type") == "boolean":
            if value.lower() in {"true", "false"}:
                value = value.lower() == "true"
        result[key] = validate(value, schema)
    return result


async def read_request(request: Request, principal: Annotated[dict, Depends(auth)]):
    path, method = operation(request)
    params = parameters(request, path, method)
    spec = method.get("requestBody", {})
    schema = spec.get("content", {}).get("application/json", {}).get("schema")
    body = {}
    if schema:
        raw = await request.body()
        if raw or spec.get("required"):
            try:
                body = json.loads(raw) if raw else None
                fingerprint(body)
            except (ValueError, UnicodeError, RecursionError) as exc:
                raise Problem(
                    400, "invalid_json", "Oczekiwano poprawnego dokumentu JSON."
                ) from exc
            validate(body, schema)
    return principal, params, body


class Context:
    def __init__(self, db, request, principal, params, body):
        self.db, self.request = db, request
        self.principal, self.actor, self.params, self.body = (
            principal,
            principal["id"],
            params,
            body,
        )

    def require(self, role):
        require(self.principal, role)

    def project(self, project_id):
        return project(self.db, project_id, self.actor)

    def record(self, kind, key):
        return record(self.db, kind, key, self.actor)

    def page(self, items):
        limit, offset = self.params["limit"], self.params["offset"]
        return {
            "items": items[offset : offset + limit],
            "limit": limit,
            "offset": offset,
            "total": len(items),
        }

    def idempotent(self, status, payload, action):
        key = self.params.get("Idempotency-Key")
        method, path = self.request.method, self.request.url.path
        args = (self.actor, method, path, key)
        fp = fingerprint(payload)
        saved = (
            self.db.execute(
                "SELECT fingerprint, response FROM idempotency WHERE actor=? AND method=? AND path=? AND key=?",
                args,
            ).fetchone()
            if key is not None
            else None
        )
        if saved:
            if saved["fingerprint"] != fp:
                raise Problem(
                    409, "idempotency_conflict", "Klucz został użyty z innymi danymi."
                )
            value = json.loads(saved["response"])
        else:
            value = action()
            if key is not None:
                self.db.execute(
                    "INSERT INTO idempotency VALUES (?, ?, ?, ?, ?, ?)",
                    (*args, fp, json.dumps(value)),
                )
        headers = {"Location": f"{API}/jobs/{value['id']}"} if status == 202 else None
        return JSONResponse(value, status_code=status, headers=headers)

    def job(self, kind, payload, project_id=None):
        return enqueue(self.db, kind, payload, self.actor, project_id)


def transaction(request: Request, data: Annotated[tuple, Depends(read_request)]):
    principal, params, body = data
    with connect(
        request.app.state.path,
        write=request.method in {"POST", "PUT"}
        or request.url.path == f"{API}/epidemic-radar",
    ) as db:
        yield Context(db, request, principal, params, body)


Ctx = Annotated[Context, Depends(transaction, scope="function")]


def upload(ctx, file):
    name = (file.filename or "upload").replace("\\", "/").rsplit("/", 1)[-1][:250]
    cap = ctx.request.app.state.max_file_bytes
    blob = file.file.read(cap + 1)
    if len(blob) > cap:
        raise Problem(413, "file_too_large", "Plik przekracza limit rozmiaru.")
    return name, blob


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI!"}


@app.post(API + "/imports", status_code=202)
def create_import(ctx: Ctx, file: Annotated[UploadFile, File()]):
    from hashlib import sha256

    ctx.require("operator")
    filename, content = upload(ctx, file)

    def create():
        columns, rows = input_rows(filename, content)
        return ctx.job(
            "import", {"filename": filename, "columns": columns, "rows": rows}
        )

    return ctx.idempotent(202, [filename, sha256(content).hexdigest()], create)


@app.get(API + "/jobs/{job_id}")
def get_job(job_id: str, ctx: Ctx):
    value, pid, meta = record(ctx.db, "job", job_id)
    if meta["owner"] != ctx.actor:
        if "operator" not in ctx.principal["roles"] or value["type"] not in {
            "import",
            "enrichment",
        }:
            raise missing()
        if pid:
            ctx.project(pid)
    return value


@app.get(API + "/projects")
def list_projects(ctx: Ctx):
    params = ctx.params
    matches = []
    for item in projects(ctx.db, ctx.actor):
        needle = params.get("q", "").casefold()
        if needle and not any(
            needle in str(value).casefold()
            for value in [
                item["title"],
                item["id"],
                *(key["value"] for key in item["external_ids"]),
            ]
        ):
            continue
        if any(
            key in params and item.get(key) != params[key]
            for key in ("kind", "status", "enrichment_status")
        ):
            continue
        if "subsector" in params and params["subsector"] not in item.get(
            "primary_subsector_codes", []
        ) + item.get("secondary_subsector_codes", []):
            continue
        matches.append(item)
    result = ctx.page(matches)
    for item in result["items"]:
        item["counts"] = project_detail(ctx.db, item["id"], ctx.actor)["counts"]
    return result


def save_project(ctx, data, old=None):
    fields = schema_fields("ProjectInput")
    core = (
        {
            "id": identifier("project"),
            "kind": "planned",
            "status": "planned",
            "external_ids": [],
            "counts": {"procedures": 0, "risks": 0, "links": 0},
        }
        if old is None
        else {key: value for key, value in old.items() if key not in fields}
    )
    value = {
        **core,
        **{key: data[key] for key in fields if key in data},
        "revision": (old or {}).get("revision", 0) + 1,
        "evidence_ids": [],
    }
    value.setdefault("sector_code", "water_and_sewerage")
    if not value["title"].strip():
        raise Problem(422, "validation_error", "Tytuł inwestycji nie może być pusty.")
    put_project(ctx.db, value, ctx.actor)
    register_description(ctx.db, value)
    put_project(ctx.db, value, ctx.actor)
    revision(ctx.db, "project", value, value["id"])
    value["counts"] = project_detail(ctx.db, value["id"], ctx.actor)["counts"]
    return value


@app.post(API + "/projects", status_code=201)
def create_project(ctx: Ctx):
    ctx.require("analyst")
    return ctx.idempotent(201, ctx.body, lambda: save_project(ctx, ctx.body))


@app.get(API + "/projects/{project_id}")
def get_project(project_id: str, ctx: Ctx):
    return project_detail(ctx.db, project_id, ctx.actor)


@app.put(API + "/projects/{project_id}")
def update_project(project_id: str, ctx: Ctx):
    ctx.require("analyst")
    value = ctx.project(project_id)
    if value["kind"] != "planned":
        raise Problem(
            409,
            "planned_project_required",
            "Korekta projektu historycznego wymaga decyzji eksperta.",
        )
    if value["revision"] != ctx.body["expected_revision"]:
        raise Problem(409, "stale_revision", "Projekt ma nowszą rewizję.")
    return save_project(ctx, ctx.body["project"], value)


@app.post(API + "/projects/{project_id}/enrich", status_code=202)
def enrich_project(project_id: str, ctx: Ctx):
    ctx.require("operator")
    ctx.project(project_id)
    return ctx.idempotent(
        202, ctx.body, lambda: ctx.job("enrichment", ctx.body, project_id)
    )


@app.post(API + "/projects/{project_id}/documents", status_code=202)
def upload_document(
    project_id: str,
    ctx: Ctx,
    file: Annotated[UploadFile, File()],
    document_id: Annotated[str | None, Form()] = None,
    document_type: Annotated[str | None, Form()] = None,
):
    from hashlib import sha256

    value = ctx.project(project_id)
    ctx.require(
        "analyst"
        if value["kind"] == "planned" and "expert" not in ctx.principal["roles"]
        else "expert"
    )
    if document_id is not None:
        validate(document_id, "Id")
        if ctx.record("document", document_id)[1] != project_id:
            raise missing()
    filename, blob = upload(ctx, file)

    def create():
        media = media_type(filename, blob)
        key = save_document(
            ctx.db,
            project_id,
            filename,
            blob,
            media,
            document_id,
            document_type or "other",
        )
        return ctx.job("document_extraction", {"version_id": key}, project_id)

    return ctx.idempotent(
        202, [filename, sha256(blob).hexdigest(), document_id, document_type], create
    )


def version_for(ctx, document_id, version_id):
    doc = ctx.record("document", document_id)[0]
    value = ctx.record("document_version", version_id)[0]
    if value["document_id"] != doc["id"]:
        raise missing()
    return value


@app.get(API + "/documents/{document_id}/versions/{version_id}")
def get_version(document_id: str, version_id: str, ctx: Ctx):
    value = version_for(ctx, document_id, version_id)
    if value.get("content_url") and asset(ctx.db, version_id) is None:
        value.pop("content_url")
    return value


@app.get(API + "/documents/{document_id}/versions/{version_id}/content")
def get_version_content(document_id: str, version_id: str, ctx: Ctx):
    value = version_for(ctx, document_id, version_id)
    content = asset(ctx.db, version_id)
    if content is None:
        raise missing()
    name = quote(value["source"].get("name", "document"), safe="")
    return Response(
        content,
        media_type=value["media_type"],
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{name}",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get(API + "/evidence/{evidence_id}")
def get_evidence(evidence_id: str, ctx: Ctx):
    return ctx.record("evidence", evidence_id)[0]


def project_records(ctx, project_id, kind, filters):
    ctx.project(project_id)
    return ctx.page(
        [
            item
            for item in values(ctx.db, kind, project_id)
            if all(
                item.get(key) == ctx.params[key] for key in filters if key in ctx.params
            )
        ]
    )


@app.get(API + "/projects/{project_id}/evidence")
def list_facts(project_id: str, ctx: Ctx):
    return project_records(ctx, project_id, "fact", ["review_status"])


@app.get(API + "/projects/{project_id}/risks")
def list_risks(project_id: str, ctx: Ctx):
    return project_records(
        ctx, project_id, "risk", ["review_status", "risk_code", "kind"]
    )


@app.get(API + "/expert/reviews")
def list_reviews(ctx: Ctx):
    ctx.require("expert")
    pid = ctx.params.get("project_id")
    if pid:
        ctx.project(pid)
    states = (
        {ctx.params["review_status"]}
        if "review_status" in ctx.params
        else {"proposed", "needs_evidence"}
    )
    visible_projects = projects(ctx.db, ctx.actor)
    visible = {item["id"] for item in visible_projects}
    output = []
    for kind in expert.SCHEMAS:
        if ctx.params.get("target_type", kind) != kind:
            continue
        records = (
            [(item, item["id"], {}) for item in visible_projects]
            if kind == "project"
            else entries(ctx.db, kind, pid)
        )
        for value, scope, _ in records:
            if (
                (scope is None or scope in visible)
                and (pid is None or scope == pid)
                and (
                    ctx.params.get("include_all")
                    or value.get("review_status") in states
                )
            ):
                output.append(expert.review_item(kind, value, scope))
    return ctx.page(sorted(output, key=lambda item: item["target_id"]))


@app.post(API + "/expert/records", status_code=201)
def create_expert_record(ctx: Ctx):
    ctx.require("expert")
    return expert.create_record(ctx.db, ctx.actor, ctx.body)


@app.post(API + "/expert/decisions", status_code=201)
def create_decision(ctx: Ctx):
    ctx.require("expert")
    return ctx.idempotent(
        201, ctx.body, lambda: expert.decide(ctx.db, ctx.actor, ctx.body)
    )


@app.get(API + "/expert/decisions")
def list_decisions(ctx: Ctx):
    kind, key = ctx.params["target_type"], ctx.params["target_id"]
    _, pid, _ = expert.target(ctx.db, kind, key, ctx.actor)
    decisions = [
        item
        for item in values(ctx.db, "decision", pid)
        if item["target_type"] == kind and item["target_id"] == key
    ]
    return ctx.page(
        sorted(decisions, key=lambda item: item["after"]["revision"], reverse=True)
    )


@app.get(API + "/sector-rules")
def list_sector_rules(ctx: Ctx):
    proposals = ctx.params["include_proposals"]
    if proposals:
        ctx.require("expert")
    return [
        value
        for value in values(ctx.db, "sector_rules")
        if value["sector_code"] == ctx.params["sector_code"]
        and (proposals or value["review_status"] in ACCEPTED)
    ]


@app.post(API + "/sector-rules", status_code=201)
def propose_sector_rules(ctx: Ctx):
    ctx.require("expert")
    return expert.create_rules(ctx.db, ctx.body)


@app.get(API + "/assessments")
def list_assessments(ctx: Ctx):
    pid = ctx.params["project_id"]
    ctx.project(pid)
    items = sorted(values(ctx.db, "assessment", pid), key=lambda item: item["id"])
    return ctx.page(sorted(items, key=lambda item: item["created_at"], reverse=True))


@app.post(API + "/assessments", status_code=202)
def create_assessment(ctx: Ctx):
    ctx.require("analyst")
    pid = ctx.body["project_id"]
    ctx.project(pid)

    def create():
        snapshot = analysis.prepare(
            ctx.db, ctx.actor, pid, ctx.body.get("document_version_ids")
        )
        return ctx.job("assessment", snapshot, pid)

    return ctx.idempotent(202, ctx.body, create)


@app.get(API + "/assessments/{assessment_id}")
def get_assessment(assessment_id: str, ctx: Ctx):
    return ctx.record("assessment", assessment_id)[0]


@app.get(API + "/assessments/{assessment_id}/twins")
def list_twins(assessment_id: str, ctx: Ctx):
    return ctx.record("assessment", assessment_id)[2]["twins"]


@app.get(API + "/assessments/{assessment_id}/gaps")
def list_gaps(assessment_id: str, ctx: Ctx):
    return [
        item
        for item in ctx.record("assessment", assessment_id)[2]["gaps"]
        if "state" not in ctx.params or item["state"] == ctx.params["state"]
    ]


def export(ctx, scope, key, rows):
    fmt = ctx.params["format"]
    headers = {
        "Content-Disposition": f'attachment; filename="risk-miner-{scope}.{fmt}"'
    }
    details = {
        "schema_version": "1",
        "scope": scope,
        "resource_id": key,
        "generated_at": now(),
    }
    if fmt == "json":
        return JSONResponse({**details, "records": rows}, headers=headers)
    content = StringIO(newline="")
    writer = csv.writer(content)
    writer.writerow(["record_type", "record_id", "data_json"])
    writer.writerow(["export_metadata", key, json.dumps(details, ensure_ascii=False)])
    writer.writerows(
        (
            item["record_type"],
            item["record_id"],
            json.dumps(item["data"], ensure_ascii=False),
        )
        for item in rows
    )
    return Response(content.getvalue(), media_type="text/csv", headers=headers)


@app.get(API + "/projects/{project_id}/export")
def export_project(project_id: str, ctx: Ctx):
    item = project_detail(ctx.db, project_id, ctx.actor)
    return export(ctx, "project", project_id, project_export(ctx.db, item, ctx.actor))


def chaos_entries(ctx, assessment_id, project_id):
    return [
        (item, meta)
        for item, _, meta in entries(ctx.db, "chaos_run", project_id)
        if item["assessment_id"] == assessment_id
    ]


@app.get(API + "/assessments/{assessment_id}/export")
def export_assessment(assessment_id: str, ctx: Ctx):
    _, pid, meta = ctx.record("assessment", assessment_id)
    rows = meta["export"][:]
    chaos_rows = []
    known = {(item["record_type"], item["record_id"]) for item in rows}
    for value, run_meta in chaos_entries(ctx, assessment_id, pid):
        chaos_rows.append(export_row("chaos_run", value))
        pattern = run_meta["pattern"]
        if ("risk_dna", pattern["id"]) not in known:
            chaos_rows.append(export_row("risk_dna", pattern))
            known.add(("risk_dna", pattern["id"]))
    return export(
        ctx,
        "assessment",
        assessment_id,
        rows
        + chaos_rows
        + [
            item
            for item in evidence_records(ctx.db, chaos_rows, ctx.actor)
            if (item["record_type"], item["record_id"]) not in known
        ],
    )


@app.get(API + "/risk-dna")
def list_risk_dna(ctx: Ctx):
    statuses = (
        {ctx.params["review_status"]} if "review_status" in ctx.params else ACCEPTED
    )
    return ctx.page(
        [
            item
            for item in values(ctx.db, "risk_dna")
            if item["review_status"] in statuses
            and (
                "risk_code" not in ctx.params
                or item["risk_code"] == ctx.params["risk_code"]
            )
        ]
    )


@app.post(API + "/risk-dna", status_code=201)
def propose_risk_dna(ctx: Ctx):
    ctx.require("expert")
    return expert.create_dna(ctx.db, ctx.actor, ctx.body)


@app.post(API + "/assessments/{assessment_id}/chaos", status_code=202)
def run_chaos_test(assessment_id: str, ctx: Ctx):
    ctx.require("analyst")
    value, pid, meta = ctx.record("assessment", assessment_id)

    def create():
        payload = extensions.prepare_chaos(ctx.db, ctx.actor, value, meta, ctx.body)
        return ctx.job("chaos", payload, pid)

    return ctx.idempotent(202, ctx.body, create)


@app.get(API + "/assessments/{assessment_id}/chaos")
def list_chaos(assessment_id: str, ctx: Ctx):
    _, pid, _ = ctx.record("assessment", assessment_id)
    return ctx.page([value for value, _ in chaos_entries(ctx, assessment_id, pid)])


@app.get(API + "/assessments/{assessment_id}/chaos/{run_id}")
def get_chaos(assessment_id: str, run_id: str, ctx: Ctx):
    ctx.record("assessment", assessment_id)
    value = ctx.record("chaos_run", run_id)[0]
    if value["assessment_id"] != assessment_id:
        raise missing()
    return value


@app.get(API + "/assessments/{assessment_id}/graph")
def get_graph(assessment_id: str, ctx: Ctx):
    value, pid, meta = ctx.record("assessment", assessment_id)
    return extensions.risk_graph(
        value, meta, [item for item, _ in chaos_entries(ctx, assessment_id, pid)]
    )


@app.get(API + "/assessments/{assessment_id}/diff")
def get_diff(assessment_id: str, ctx: Ctx):
    value, pid, meta = ctx.record("assessment", assessment_id)
    baseline, baseline_pid, previous = ctx.record(
        "assessment", ctx.params["baseline_id"]
    )
    if pid != baseline_pid or value["created_at"] < baseline["created_at"]:
        raise Problem(
            422, "invalid_baseline", "Wskaż wcześniejszą analizę tego samego projektu."
        )
    return extensions.assessment_diff(value, meta, baseline, previous)


@app.get(API + "/epidemic-radar")
def get_patterns(ctx: Ctx):
    return extensions.patterns(
        ctx.db, ctx.actor, ctx.params.get("risk_code"), ctx.params.get("subsector")
    )


@app.put(API + "/projects/{project_id}/monitoring")
def configure_monitoring(project_id: str, ctx: Ctx):
    ctx.require("operator")
    value = ctx.project(project_id)
    enabled = ctx.body["enabled"]
    if enabled and value["status"] != "in_progress":
        raise Problem(
            409, "project_not_in_progress", "Monitoring wymaga projektu w realizacji."
        )
    previous = find(ctx.db, "monitoring", project_id)
    meta = previous[2] if previous and previous[0]["enabled"] and enabled else {}
    put(
        ctx.db,
        "monitoring",
        {"id": project_id, "enabled": enabled},
        project_id,
        **{**meta, "owner": ctx.actor},
    )
    return {"enabled": enabled}
