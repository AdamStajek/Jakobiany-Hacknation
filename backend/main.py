import json
import os
import re
import time
from collections import OrderedDict, deque
from datetime import date
from threading import BoundedSemaphore
from typing import Literal
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from wodo import parcels_data
from wodo.analysis import SOURCE_LABELS, run
from wodo.farmer_report import report_message
from wodo.field_analysis import analyze_field
from wodo.geo import PARCEL_ID, by_point, imported, lookup
from wodo.passport import collect, farmer_questions
from wodo.report import pdf
from wodo.science import CROPS, years_ago
from wodo.store import SourceError, read, timestamp, write

app = FastAPI(title="WodoStrażnik", version="1.0.0")
analysis_slots = BoundedSemaphore(2)
buckets = OrderedDict()


def today():
    from datetime import datetime

    return datetime.now(ZoneInfo("Europe/Warsaw")).date()


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid", allow_inf_nan=False, populate_by_name=True
    )
    parcel_id: str | None = Field(default=None, max_length=90)
    geojson: dict | None = None
    crop: str = "wheat"
    day: date = Field(alias="date")
    sowing: date | None = None
    stage: int | None = Field(default=None, ge=0, le=4)
    irrigation: bool = False
    irrigation_mm: float = Field(default=0, ge=0, le=150)
    scenario_mm: float = Field(default=0, ge=0, le=50)
    confirm_land: bool = False
    soil_observation: Literal["dry", "moist", "wet"] | None = None

    @field_validator("crop")
    @classmethod
    def crop_exists(cls, value):
        if value not in CROPS:
            raise ValueError("Nieznana uprawa.")
        return value

    @model_validator(mode="after")
    def validate_inputs(self):
        if (self.parcel_id is None) == (self.geojson is None):
            raise ValueError("Podaj działkę ewidencyjną albo geometrię GeoJSON.")
        if not years_ago(today(), 10) <= self.day <= today():
            raise ValueError(
                "Wybierz dzień z ostatnich dziesięciu lat, bez dat przyszłych."
            )
        if self.sowing and (
            self.sowing > self.day or (self.day - self.sowing).days > 370
        ):
            raise ValueError(
                "Data siewu powinna poprzedzać analizę o co najwyżej 370 dni."
            )
        return self


@app.middleware("http")
async def request_limits(request: Request, call_next):
    if request.method == "POST" and request.url.path.startswith("/api/"):
        size = request.headers.get("content-length", "")
        if (
            not size.isascii()
            or not size.isdigit()
            or len(size) > 7
            or int(size) > 650_000
        ):
            return JSONResponse(
                {"detail": "Dopuszczalny rozmiar danych to 650 kB."}, status_code=413
            )
    if request.url.path.startswith("/api/"):
        now = time.monotonic()
        ip = request.client.host if request.client else "local"
        history = buckets.setdefault(ip, deque())
        buckets.move_to_end(ip)
        if len(buckets) > 2048:
            buckets.popitem(last=False)
        while history and now - history[0] > 60:
            history.popleft()
        if len(history) >= 65:
            return JSONResponse(
                {"detail": "Za dużo zapytań. Spróbuj za chwilę."},
                status_code=429,
                headers={"Retry-After": "60"},
            )
        history.append(now)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    if (
        request.url.path.startswith("/api/analysis")
        or request.url.path == "/api/passport"
    ):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(SourceError)
async def provider_error(_request, error):
    return JSONResponse(status_code=503, content={"detail": str(error)})


@app.exception_handler(ValueError)
async def input_error(_request, error):
    return JSONResponse(status_code=422, content={"detail": str(error)})


@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "analysis_date_max": today(),
        "analysis_date_min": years_ago(today(), 10),
        "parcels": parcels_data.health_info(),
    }


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI!"}


@app.get("/api/crops")
def crops():
    return [{"id": key, "label": value.label} for key, value in CROPS.items()]


@app.get("/api/data-sources/status")
def source_status():
    latest = read("last-sources", 86400 * 7)
    return {
        "checked_at": latest.get("checked_at") if latest else None,
        "sources": latest.get("sources")
        if latest
        else [
            {"name": s, "status": "oczekuje na analizę"} for s in SOURCE_LABELS.values()
        ],
    }


@app.get("/api/parcels/by-point")
def parcel_point(
    lon: float = Query(ge=13.98, le=24.3), lat: float = Query(ge=48.98, le=55.1)
):
    return matches(by_point(lon, lat))


@app.get("/api/parcels/search")
def parcel_search(query: str = Query(min_length=1, max_length=90)):
    return matches(lookup(query))


@app.get("/api/parcels/{parcel_id:path}")
def parcel_id_route(parcel_id: str):
    return matches(lookup(parcel_id))


@app.post("/api/parcels/import")
def parcel_import(geojson: dict):
    return imported(geojson)


def matches(parcels):
    if not parcels:
        raise HTTPException(
            404, "Nie znaleziono działki. Sprawdź identyfikator lub wybierz inny punkt."
        )
    return {"parcels": parcels}


@app.post("/api/analysis/passport")
def analyze_passport(
    passport: dict, as_of: date, format: Literal["json", "pdf"] = "json"
):
    try:
        result = analyze_field(passport, as_of)
        if format == "pdf":
            return Response(
                pdf(result),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="raport-pola-{as_of}.pdf"'
                },
            )
        return result
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@app.get("/api/passport/questions")
def passport_questions():
    return farmer_questions()


@app.get("/api/passport")
def passport(
    parcel_id: str = Query(max_length=90),
    as_of: date | None = None,
    crop: str | None = None,
    sowing: date | None = None,
    stage: int | None = None,
    irrigation_mm: float = 0,
):
    return build_passport(parcel_id, None, as_of, crop, sowing, stage, irrigation_mm)


@app.post("/api/passport")
def passport_from_geojson(
    geojson: dict,
    as_of: date | None = None,
    crop: str | None = None,
    sowing: date | None = None,
    stage: int | None = None,
    irrigation_mm: float = 0,
):
    return build_passport(None, geojson, as_of, crop, sowing, stage, irrigation_mm)


def build_passport(parcel_id, geojson, as_of, crop, sowing, stage, irrigation_mm):
    day = as_of or today()
    if (
        (crop is not None and crop not in CROPS)
        or (stage is not None and stage not in range(5))
        or not 0 <= irrigation_mm <= 150
        or (sowing and not 0 <= (day - sowing).days <= 370)
    ):
        raise HTTPException(422, "Nieprawidłowe parametry uprawy.")
    if not years_ago(today(), 10) <= day <= today() or (
        parcel_id is not None and not PARCEL_ID.fullmatch(parcel_id)
    ):
        raise HTTPException(
            422, "Podaj pełny identyfikator EGiB i datę z ostatnich dziesięciu lat."
        )
    if not analysis_slots.acquire(blocking=False):
        raise HTTPException(
            429,
            "Trwają inne analizy. Spróbuj ponownie za chwilę.",
            headers={"Retry-After": "8"},
        )
    try:
        parcel = (
            imported(geojson)
            if geojson is not None
            else matches(
                [item for item in lookup(parcel_id) if item["id"] == parcel_id]
            )["parcels"][0]
        )
        passport = collect(parcel, day, crop, sowing, stage, irrigation_mm)
        return {
            **passport,
            "farmer_report": analyze_field(passport, day)["farmer_report"],
        }
    finally:
        analysis_slots.release()


@app.post("/api/analysis")
def analyze(request: AnalysisRequest):
    if not analysis_slots.acquire(blocking=False):
        raise HTTPException(
            429,
            "Trwają inne analizy. Spróbuj ponownie za chwilę.",
            headers={"Retry-After": "8"},
        )
    start = time.monotonic()
    try:
        parcel = (
            imported(request.geojson)
            if request.geojson is not None
            else matches(lookup(request.parcel_id))["parcels"][0]
        )
        result = run(parcel, request)
        result["situation"] = report_message(result)
        analysis_id = uuid4().hex
        report = {
            **result,
            "analysis_id": analysis_id,
            "created_at": timestamp(),
            "elapsed_ms": round((time.monotonic() - start) * 1000),
        }
        write(f"report:{analysis_id}", report)
        write(
            "last-sources",
            {
                "checked_at": timestamp(),
                "sources": [
                    {
                        "name": label,
                        "status": "dostępne"
                        if any(s["key"] == key for s in result["sources"])
                        else "brak wyniku",
                        "detail": result["missing"].get(label),
                    }
                    for key, label in SOURCE_LABELS.items()
                    if key != "gauge" or request.day == today()
                ],
            },
        )
        return report
    finally:
        analysis_slots.release()


def get_report(analysis_id):
    if not re.fullmatch(r"[a-f0-9]{32}", analysis_id):
        raise HTTPException(404, "Raport nie istnieje.")
    report = read(f"report:{analysis_id}", 14 * 86400)
    if report is None:
        raise HTTPException(404, "Raport nie istnieje lub wygasł.")
    if "situation" not in report:
        report["situation"] = report_message(report)
    return report


@app.get("/api/analysis/{analysis_id}")
def analysis_result(analysis_id: str):
    return get_report(analysis_id)


@app.get("/api/analysis/{analysis_id}/provenance")
def provenance(analysis_id: str):
    report = get_report(analysis_id)
    return {
        key: report[key]
        for key in ("sources", "date", "missing", "model_version", "created_at")
    }


@app.get("/api/analysis/{analysis_id}/report")
def analysis_document(
    analysis_id: str, format: str = Query(default="pdf", pattern="^(pdf|json)$")
):
    report = get_report(analysis_id)
    data = (
        pdf(report)
        if format == "pdf"
        else json.dumps(report, ensure_ascii=False, indent=2).encode()
    )
    return Response(
        data,
        media_type="application/pdf" if format == "pdf" else "application/json",
        headers={
            "Content-Disposition": f'attachment; filename="wodostraznik-{report["date"]}.{format}"'
        },
    )


site = os.environ.get("WODO_SITE_DIR")
if site:
    from starlette.exceptions import HTTPException as StarletteHTTPException
    from starlette.staticfiles import StaticFiles

    class SinglePageSite(StaticFiles):
        """Trasy Angulara (np. /dzialka/ID/analiza/ID) odświeżone w przeglądarce dostają index.html."""

        async def get_response(self, path, scope):
            try:
                return await super().get_response(path, scope)
            except StarletteHTTPException as error:
                if (
                    error.status_code == 404
                    and not path.startswith("api/")
                    and (
                        "." not in path.rsplit("/", 1)[-1]
                        or path.startswith("dzialka/")
                    )
                ):
                    return await super().get_response("index.html", scope)
                raise

    app.mount("/", SinglePageSite(directory=site, html=True), name="frontend")
