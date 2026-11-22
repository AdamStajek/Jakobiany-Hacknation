"""Podgląd maili demo (bez konta, bez wysyłki)."""

from typing import Literal

from fastapi import APIRouter, Query

from wodo.notify import templates

router = APIRouter(prefix="/api/notifications", tags=["powiadomienia demo"])


@router.get("/demo/{kind}")
def demo_preview(
    kind: Literal["rain", "residue"],
    field_name: str | None = Query(default=None, max_length=80),
    soil: Literal["sandy", "clay", "silty", "organic"] = "sandy",
    terrain: Literal["sloped", "flat", "depression"] = "sloped",
):
    mail = templates.demo(kind, field_name, soil, terrain)
    return {"demo": True, "kind": kind, "sent": False, **mail}
