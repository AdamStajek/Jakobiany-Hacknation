import asyncio
import json
import logging
import os
import re
import time
from collections import OrderedDict, deque
from datetime import date
from threading import BoundedSemaphore, Lock
from typing import Annotated, Literal
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import (
    Body,
    FastAPI,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from wodo import parcels_data
from wodo.analysis import SOURCE_LABELS, run
from wodo.auth.router import router as auth_router
from wodo.declarations import FarmerAnswers
from wodo.describe_field import router as describe_router
from wodo.experiments import experiment_checks, experiment_diagnosis
from wodo.farm_pdf import FarmReportIn, farm_pdf
from wodo.farmer_report import report_message
from wodo.field_analysis import analyze_field
from wodo.fields.router import router as fields_router
from wodo.geo import PARCEL_ID, by_point, imported, lookup
from wodo.notify.demo import router as demo_router
from wodo.notify.router import progress_router as notify_progress_router
from wodo.notify.router import router as notify_router
from wodo.passport import collect, farmer_questions
from wodo.passport_summary import passport_summary
from wodo.recommendation_catalog import catalog, observation_options
from wodo.recommendations import action_details, locate_action
from wodo.report import pdf
from wodo.report_evidence import report_evidence
from wodo.science import CROPS, years_ago
from wodo.store import SourceError, read, timestamp, write

app = FastAPI(title="Pole Widzenia", version="1.0.0")
analysis_slots = BoundedSemaphore(2)
buckets = OrderedDict()
PASSPORT_CACHE_TTL = 3600
PASSPORT_CACHE_SIZE = 64
passport_cache = OrderedDict()
passport_cache_lock = Lock()
for router in (auth_router, fields_router, notify_router, notify_progress_router, describe_router, demo_router):
    app.include_router(router)


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
    farmer_answers: FarmerAnswers = Field(default_factory=FarmerAnswers)

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
        self.farmer_answers.validate_dates(self.day)
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


@app.exception_handler(Exception)
async def unexpected_error(_request, error):
    logging.getLogger(__name__).exception("Unhandled error", exc_info=error)
    return JSONResponse(
        status_code=500,
        content={"detail": "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę."},
    )


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
def parcel_point(lon: float, lat: float):
    if not (13.98 <= lon <= 24.3 and 48.98 <= lat <= 55.1):
        raise HTTPException(
            422,
            "Wybrany punkt leży poza granicami Polski. Wskaż działkę na terytorium Polski.",
        )
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


@app.post("/api/farm-report")
def farm_report(body: FarmReportIn):
    return Response(
        farm_pdf(body),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="raport-moje-pola-{date.today()}.pdf"'},
    )


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


@app.get("/api/recommendations/catalog")
def recommendation_catalog():
    return {"actions": catalog(), "field_observations": observation_options(), "point_observations": observation_options(local=True)}


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
    view: Literal["full", "summary"] = "full",
):
    return passport_view(build_passport(parcel_id, None, as_of, crop, sowing, stage, irrigation_mm), view)


def passport_view(result, view="full"):
    """`summary`: lekka odpowiedź bez ciężkiej tablicy `fields` (do kart w UI)."""
    if view == "full":
        return result
    report = result.get("farmer_report") or {}
    return {
        "parcel_id": result["parcel_id"],
        "analysis_as_of": result["analysis_as_of"],
        "summary": result["summary"],
        "farmer_report": {"situation": report.get("situation"), "next_check": report.get("next_check")},
    }


def passport_cache_get(key):
    with passport_cache_lock:
        entry = passport_cache.get(key)
        if entry and time.monotonic() - entry[0] < PASSPORT_CACHE_TTL:
            passport_cache.move_to_end(key)
            return entry[1]
        passport_cache.pop(key, None)
    return None


def passport_cache_put(key, value):
    with passport_cache_lock:
        passport_cache[key] = (time.monotonic(), value)
        passport_cache.move_to_end(key)
        while len(passport_cache) > PASSPORT_CACHE_SIZE:
            passport_cache.popitem(last=False)


class PassportSelection(BaseModel):
    field_request: AnalysisRequest


@app.post("/api/passport")
def passport_from_geojson(
    geojson: Annotated[PassportSelection | dict, Field(union_mode="left_to_right")],
    as_of: date | None = None,
    crop: str | None = None,
    sowing: date | None = None,
    stage: int | None = None,
    irrigation_mm: float = 0,
):
    if isinstance(geojson, PassportSelection):
        selection = geojson.field_request
        return build_passport(
            selection.parcel_id, selection.geojson, selection.day, selection.crop, selection.sowing,
            selection.stage, selection.irrigation_mm, selection.farmer_answers, selection.irrigation, selection.soil_observation,
        )
    if "field_request" in geojson:
        raise HTTPException(422, "Sprawdź datę, dane pola i zaznaczone obserwacje.")
    return build_passport(None, geojson, as_of, crop, sowing, stage, irrigation_mm)


def build_passport(parcel_id, geojson, as_of, crop, sowing, stage, irrigation_mm,
                   farmer_answers=None, irrigation=False, soil_observation=None, on_progress=None):
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
    # Cache tylko dla działek z ewidencji i bez deklaracji rolnika (wynik zależy wtedy od samych parametrów).
    cache_key = (
        (parcel_id, day, crop, sowing, stage, irrigation_mm)
        if geojson is None and not farmer_answers and not irrigation and not soil_observation
        else None
    )
    if cache_key and (cached := passport_cache_get(cache_key)) is not None:
        return cached
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
        ensure_analyzable(parcel)
        if farmer_answers:
            farmer_answers.validate_zones(parcel["geometry"])
        total = 0

        def source_done(done, count, label):
            nonlocal total
            total = count + 1
            if on_progress:
                on_progress(done, total, label)

        passport = collect(parcel, day, crop, sowing, stage, irrigation_mm, source_done)
        if on_progress:
            on_progress(total, total, "Obliczam podsumowanie")
        result = {**passport, "summary": passport_summary(passport["fields"], day, crop, farmer_answers, soil_observation),
                  "farmer_report": analyze_field(
            passport, day, farmer_answers=farmer_answers, irrigation=irrigation, crop_key=crop, sowing=sowing, stage=stage,
            soil_observation=soil_observation,
        )["farmer_report"]}
        if cache_key:
            passport_cache_put(cache_key, result)
        return result
    finally:
        analysis_slots.release()


def ensure_analyzable(parcel):
    if parcel.get("analyzable") is False:
        raise ValueError(parcel["warning"])


def execute_analysis(request: AnalysisRequest, on_progress=None):
    """Wspólna ścieżka dla POST i WebSocket. Zajmuje slot na czas analizy."""
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
        ensure_analyzable(parcel)
        if request.farmer_answers.problem_zones:
            request.farmer_answers.validate_zones(parcel["geometry"])
        result = run(parcel, request, on_progress)
        if answers := request.farmer_answers.model_dump(mode="json", exclude_unset=True):
            result["farmer_answers"] = answers
        result["situation"] = report_message(result)
        result["evidence"] = report_evidence(result)
        result["experiments"] = experiment_checks(result)
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
                    if key not in ("gauge", "forecast") or request.day == today()
                ],
            },
        )
        return report
    finally:
        analysis_slots.release()


@app.post("/api/analysis")
def analyze(request: AnalysisRequest):
    return execute_analysis(request)


@app.websocket("/api/ws/analysis")
async def analysis_socket(ws: WebSocket):
    """Analiza z postępem na żywo.

    Klient wysyła jeden JSON (jak body POST /api/analysis). Serwer odpowiada zdarzeniami:
    {"type":"progress","done":n,"total":m,"label":"…"} i na koniec
    {"type":"result","report":{…}} albo {"type":"error","status":int,"detail":"…"}.
    """
    await ws.accept()
    loop = asyncio.get_running_loop()
    events: asyncio.Queue = asyncio.Queue()

    def emit(event):
        loop.call_soon_threadsafe(events.put_nowait, event)

    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=10)
        if len(raw) > 650_000:
            raise HTTPException(413, "Dopuszczalny rozmiar danych to 650 kB.")
        request = AnalysisRequest.model_validate_json(raw)
    except WebSocketDisconnect:
        return
    except HTTPException as error:
        await ws.send_json({"type": "error", "status": error.status_code, "detail": error.detail})
        await ws.close()
        return
    except Exception as error:
        detail = "Nieprawidłowe dane analizy."
        if hasattr(error, "errors"):
            detail = "; ".join(str(e["msg"]).removeprefix("Value error, ") for e in error.errors())
        await ws.send_json({"type": "error", "status": 422, "detail": detail})
        await ws.close()
        return

    def work():
        try:
            report = execute_analysis(
                request, lambda done, total, label: emit(
                    {"type": "progress", "done": done, "total": total, "label": label})
            )
            emit({"type": "result", "report": json.loads(json.dumps(report, default=str))})
        except HTTPException as error:
            emit({"type": "error", "status": error.status_code, "detail": error.detail})
        except (SourceError, ValueError) as error:
            emit({"type": "error", "status": 503 if isinstance(error, SourceError) else 422, "detail": str(error)})
        except Exception:
            logging.getLogger(__name__).exception("WS analysis failed")
            emit({"type": "error", "status": 500, "detail": "Analiza nie powiodła się. Spróbuj ponownie."})

    await ws.send_json({"type": "progress", "done": 0, "total": 0, "label": "Start analizy"})
    task = loop.run_in_executor(None, work)
    try:
        while True:
            event = await events.get()
            await ws.send_json(event)
            if event["type"] != "progress":
                break
    except WebSocketDisconnect:
        pass
    finally:
        await task
        try:
            await ws.close()
        except RuntimeError:
            pass


class PassportSocketRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    parcel_id: str = Field(max_length=90)
    as_of: date | None = None
    crop: str | None = None


@app.websocket("/api/ws/passport")
async def passport_socket(ws: WebSocket):
    """Dane działki z postępem na żywo.

    Klient wysyła jeden JSON {"parcel_id","as_of","crop"}. Serwer odsyła zdarzenia
    {"type":"progress","done":n,"total":m,"label":"…"} i jedno {"type":"result","passport":{…}}
    (widok `summary`) albo {"type":"error","status":int,"detail":"…"}. Trafienie w cache = od razu wynik.
    """
    await ws.accept()
    loop = asyncio.get_running_loop()
    events: asyncio.Queue = asyncio.Queue()

    def emit(event):
        loop.call_soon_threadsafe(events.put_nowait, event)

    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=10)
        if len(raw) > 2_000:
            raise HTTPException(413, "Dopuszczalny rozmiar danych to 2 kB.")
        request = PassportSocketRequest.model_validate_json(raw)
    except (WebSocketDisconnect, TimeoutError):
        return
    except HTTPException as error:
        await ws.send_json({"type": "error", "status": error.status_code, "detail": error.detail})
        await ws.close()
        return
    except Exception as error:
        detail = "Nieprawidłowe dane."
        if hasattr(error, "errors"):
            detail = "; ".join(str(e["msg"]).removeprefix("Value error, ") for e in error.errors())
        await ws.send_json({"type": "error", "status": 422, "detail": detail})
        await ws.close()
        return

    def work():
        try:
            result = build_passport(
                request.parcel_id, None, request.as_of, request.crop, None, None, 0,
                on_progress=lambda done, total, label: emit(
                    {"type": "progress", "done": done, "total": total, "label": label}),
            )
            emit({"type": "result", "passport": json.loads(json.dumps(passport_view(result, "summary"), default=str))})
        except HTTPException as error:
            emit({"type": "error", "status": error.status_code, "detail": error.detail})
        except (SourceError, ValueError) as error:
            emit({"type": "error", "status": 503 if isinstance(error, SourceError) else 422, "detail": str(error)})
        except Exception:
            logging.getLogger(__name__).exception("WS passport failed")
            emit({"type": "error", "status": 500, "detail": "Nie udało się pobrać danych działki. Spróbuj ponownie."})

    task = loop.run_in_executor(None, work)
    try:
        while True:
            event = await events.get()
            await ws.send_json(event)
            if event["type"] != "progress":
                break
    except WebSocketDisconnect:
        pass
    finally:
        await task
        try:
            await ws.close()
        except RuntimeError:
            pass


def get_report(analysis_id):
    if not re.fullmatch(r"[a-f0-9]{32}", analysis_id):
        raise HTTPException(404, "Raport nie istnieje.")
    report = read(f"report:{analysis_id}", 14 * 86400)
    if report is None:
        raise HTTPException(404, "Raport nie istnieje lub wygasł.")
    if "situation" not in report:
        report["situation"] = report_message(report)
    if "evidence" not in report:
        report["evidence"] = report_evidence(report)
    for recommendation in report.get("recommendations", ()):
        if "location" not in recommendation:
            locate_action(recommendation, report.get("parcel", {}).get("sample_point"), report.get("date"))
        if "cost_estimate" not in recommendation:
            recommendation.update(action_details(recommendation.get("id")))
        if "area_impact" not in recommendation:
            if details := action_details(recommendation.get("id")):
                recommendation["area_impact"] = details["area_impact"]
    report["experiments"] = experiment_checks(report)
    return report


@app.get("/api/analysis/{analysis_id}")
def analysis_result(analysis_id: str):
    return get_report(analysis_id)


@app.post("/api/analysis/{analysis_id}/experiments")
def save_experiments(analysis_id: str, results: dict[str, str] = Body(max_length=5)):
    report = get_report(analysis_id)
    try:
        conclusions = experiment_diagnosis(report, results)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    report.update(analysis_id=uuid4().hex, experiment_results=results, experiment_conclusions=conclusions)
    report["experiments"] = experiment_checks(report)
    write(f"report:{report['analysis_id']}", report)
    return report


@app.get("/api/analysis/{analysis_id}/provenance")
def provenance(analysis_id: str):
    report = get_report(analysis_id)
    return {
        key: report[key]
        for key in ("sources", "date", "missing", "model_version", "created_at")
    }


@app.get("/api/analysis/{analysis_id}/report")
def analysis_document(analysis_id: str, format: Literal["pdf"] = "pdf"):
    report = get_report(analysis_id)
    return Response(
        pdf(report),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="pole-widzenia-{report["date"]}.pdf"'},
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
