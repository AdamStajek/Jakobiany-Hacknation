from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from wodo.auth.deps import User, guard
from wodo.db import connect

router = APIRouter(prefix="/api/me", dependencies=[Depends(guard)], tags=["powiadomienia"])


class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email_enabled: bool


def present(user, enabled):
    return {
        "email_enabled": bool(enabled),
        "email": user["email"],
        "email_verified": bool(user["email_verified"]),
    }


@router.get("/notifications")
def get_preferences(user=User):
    return present(user, user["notify_email"])


@router.patch("/notifications")
def patch_preferences(body: Preferences, user=User):
    with connect() as db:
        db.execute(
            "UPDATE users SET notify_email = ? WHERE id = ?",
            (int(body.email_enabled), user["id"]),
        )
        if not body.email_enabled:
            db.execute("DELETE FROM notification_log WHERE user_id = ?", (user["id"],))
    return present(user, body.email_enabled)
