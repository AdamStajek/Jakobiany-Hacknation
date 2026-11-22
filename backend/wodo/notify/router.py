import logging
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict, model_validator
from starlette.concurrency import run_in_threadpool

from wodo.auth import security
from wodo.auth.deps import User, current_user, guard
from wodo.db import connect
from wodo.notify import mailer, templates

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/me", dependencies=[Depends(guard)], tags=["powiadomienia"])
progress_router = APIRouter(prefix="/api/ws", tags=["powiadomienia"])
TEST_EMAIL_INTERVAL = 60


class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email_enabled: bool | None = None
    recommendation_email_enabled: bool | None = None

    @model_validator(mode="after")
    def validate_update(self):
        changes = self.model_dump(exclude_unset=True)
        if not changes or any(value is None for value in changes.values()):
            raise ValueError("Podaj co najmniej jedno ustawienie jako prawda albo fałsz.")
        return self


def present(db, user_id):
    user = db.execute(
        "SELECT email, email_verified, notify_email, EXISTS ("
        "SELECT 1 FROM recommendation_email_preferences WHERE user_id = users.id"
        ") AS recommendation_email_enabled FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    return {
        "email_enabled": bool(user["notify_email"]),
        "recommendation_email_enabled": bool(user["recommendation_email_enabled"]),
        "email": user["email"],
        "email_verified": bool(user["email_verified"]),
    }


@router.get("/notifications")
def get_preferences(user=User):
    with connect() as db:
        return present(db, user["id"])


@router.patch("/notifications")
def patch_preferences(body: Preferences, user=User):
    with connect() as db:
        if body.email_enabled is not None:
            db.execute(
                "UPDATE users SET notify_email = ? WHERE id = ?",
                (int(body.email_enabled), user["id"]),
            )
            if not body.email_enabled:
                db.execute("DELETE FROM notification_log WHERE user_id = ?", (user["id"],))
        if body.recommendation_email_enabled is True:
            db.execute(
                "INSERT INTO recommendation_email_preferences VALUES (?, ?) "
                "ON CONFLICT(user_id) DO NOTHING",
                (user["id"], uuid4().hex),
            )
        if body.recommendation_email_enabled is False:
            db.execute(
                "DELETE FROM recommendation_email_preferences WHERE user_id = ?", (user["id"],)
            )
        return present(db, user["id"])


def reserve_test_email(user):
    if not user["email_verified"]:
        raise HTTPException(403, "Najpierw potwierdź adres e-mail w swoim profilu.")
    now = security.now()
    with connect() as db:
        attempt = db.execute(
            "INSERT INTO recommendation_email_tests (user_id, attempted_at) VALUES (?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET attempted_at = excluded.attempted_at "
            "WHERE recommendation_email_tests.attempted_at <= ?",
            (user["id"], now, now - TEST_EMAIL_INTERVAL),
        )
        if not attempt.rowcount:
            raise HTTPException(
                429,
                "Wiadomość testową można wysłać raz na minutę. Spróbuj ponownie za chwilę.",
                headers={"Retry-After": str(TEST_EMAIL_INTERVAL)},
            )


def deliver_test_email(user):
    if not mailer.send(user["email"], *templates.test_recommendation(user["username"])):
        raise HTTPException(503, "Nie udało się wysłać wiadomości testowej. Spróbuj ponownie później.")


@router.post("/notifications/test-email", status_code=204)
def send_test_email(user=User):
    reserve_test_email(user)
    deliver_test_email(user)


@progress_router.websocket("/recommendation-email-test")
async def test_email_progress(ws: WebSocket):
    # Przeglądarka dołącza ciasteczko sesji do WS, więc sprawdzamy pochodzenie żądania.
    scheme = "https" if ws.url.scheme == "wss" else "http"
    origin = ws.headers.get("origin")
    public_url = os.environ.get("WODO_PUBLIC_URL", "").rstrip("/")
    if not origin or origin not in {f"{scheme}://{ws.url.netloc}", public_url}:
        await ws.close(code=1008)
        return
    await ws.accept()
    try:
        user = await run_in_threadpool(current_user, ws)
        await run_in_threadpool(reserve_test_email, user)
        await ws.send_json({
            "type": "progress", "done": 1, "total": 2,
            "label": "Adres potwierdzony. Trwa wysyłanie wiadomości testowej.",
        })
        await run_in_threadpool(deliver_test_email, user)
        event = {"type": "result"}
    except HTTPException as error:
        event = {"type": "error", "status": error.status_code, "detail": error.detail}
    except WebSocketDisconnect:
        return
    except Exception:
        log.exception("Wysyłka testowej wiadomości przez WebSocket nie powiodła się")
        event = {"type": "error", "status": 500, "detail": "Nie udało się wysłać wiadomości testowej."}
    try:
        await ws.send_json(event)
        await ws.close()
    except WebSocketDisconnect:
        pass
