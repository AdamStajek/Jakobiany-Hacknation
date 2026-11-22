"""Pola zapisane na serwerze; każdy użytkownik widzi wyłącznie własne."""

import json
import os
import re
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from wodo.auth import security
from wodo.auth.deps import User, guard
from wodo.db import connect
from wodo.science import CROPS

router = APIRouter(prefix="/api/fields", dependencies=[Depends(guard)], tags=["pola"])

COLOR = re.compile(r"#[0-9a-fA-F]{6}")
DEFAULT_COLOR = "#2f7d4f"
MAX_PARCELS = 50
GEOMETRIES = {"Polygon", "MultiPolygon"}


def max_fields():
    return int(os.environ.get("WODO_MAX_FIELDS", "50"))


class Parcel(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(min_length=1, max_length=90)
    geometry: dict

    @field_validator("geometry")
    @classmethod
    def geometry_ok(cls, value):
        if value.get("type") not in GEOMETRIES or not isinstance(
            value.get("coordinates"), list
        ):
            raise ValueError("Geometria działki musi być Polygon lub MultiPolygon.")
        return value


def clean_color(value):
    if value is not None and not COLOR.fullmatch(value):
        raise ValueError("Kolor w formacie #rrggbb.")
    return value


def clean_name(value):
    if value is not None:
        value = value.strip()
        if not value:
            raise ValueError("Nazwa pola nie może być pusta.")
    return value


def clean_crop(value):
    if value is not None and value not in CROPS:
        raise ValueError("Nieznana uprawa.")
    return value


class FieldIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    color: str = DEFAULT_COLOR
    crop: str | None = None
    parcels: list[Parcel] = Field(default_factory=list, max_length=MAX_PARCELS)

    @field_validator("name")
    @classmethod
    def name_ok(cls, value):
        return clean_name(value)

    @field_validator("color")
    @classmethod
    def color_ok(cls, value):
        return clean_color(value)

    @field_validator("crop")
    @classmethod
    def crop_ok(cls, value):
        return clean_crop(value)


class FieldPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = None
    crop: str | None = None
    parcels: list[Parcel] | None = Field(default=None, max_length=MAX_PARCELS)

    @field_validator("name")
    @classmethod
    def name_ok(cls, value):
        return clean_name(value)

    @field_validator("color")
    @classmethod
    def color_ok(cls, value):
        return clean_color(value)

    @field_validator("crop")
    @classmethod
    def crop_ok(cls, value):
        return clean_crop(value)


class LastReport(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    risk: str = Field(max_length=80)
    dry_spell_days: int = Field(ge=0, le=3660)
    crop_balance_mm: float = Field(ge=-5000, le=5000)


def iso(moment):
    return datetime.fromtimestamp(moment, UTC).isoformat(timespec="seconds")


def present(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "color": row["color"],
        "crop": row["crop"],
        "parcels": json.loads(row["parcels"]),
        "last_report": json.loads(row["last_report"]) if row["last_report"] else None,
    }


def owned(db, field_id, user):
    row = db.execute(
        "SELECT * FROM fields WHERE id = ? AND user_id = ?", (field_id, user["id"])
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Nie znaleziono pola.")
    return row


@router.get("")
def list_fields(user=User):
    with connect() as db:
        rows = db.execute(
            "SELECT * FROM fields WHERE user_id = ? ORDER BY created_at, id", (user["id"],)
        ).fetchall()
    return [present(row) for row in rows]


@router.post("", status_code=201)
def create_field(body: FieldIn, user=User):
    moment = security.now()
    field_id = uuid4().hex
    with connect() as db:
        count = db.execute(
            "SELECT COUNT(*) FROM fields WHERE user_id = ?", (user["id"],)
        ).fetchone()[0]
        if count >= max_fields():
            raise HTTPException(409, f"Limit pól na konto: {max_fields()}.")
        db.execute(
            "INSERT INTO fields (id, user_id, name, color, crop, parcels, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                field_id,
                user["id"],
                body.name.strip(),
                body.color,
                body.crop,
                json.dumps([p.model_dump() for p in body.parcels]),
                moment,
                moment,
            ),
        )
        return present(owned(db, field_id, user))


@router.get("/{field_id}")
def get_field(field_id: str, user=User):
    with connect() as db:
        return present(owned(db, field_id, user))


@router.patch("/{field_id}")
def patch_field(field_id: str, body: FieldPatch, user=User):
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is None:
        raise HTTPException(422, "Nazwa pola nie może być pusta.")
    if "color" in changes and changes["color"] is None:
        raise HTTPException(422, "Kolor pola nie może być pusty.")
    if "parcels" in changes:
        if changes["parcels"] is None:
            raise HTTPException(422, "Lista działek nie może być pusta.")
        changes["parcels"] = json.dumps(changes["parcels"])
    if "name" in changes:
        changes["name"] = changes["name"].strip()
    with connect() as db:
        owned(db, field_id, user)
        if changes:
            assignments = ", ".join(f"{column} = ?" for column in changes)
            db.execute(
                f"UPDATE fields SET {assignments}, updated_at = ? WHERE id = ?",
                (*changes.values(), security.now(), field_id),
            )
        return present(owned(db, field_id, user))


@router.put("/{field_id}/last-report")
def put_last_report(field_id: str, body: LastReport, user=User):
    report = {**body.model_dump(), "saved_at": iso(security.now())}
    with connect() as db:
        owned(db, field_id, user)
        db.execute(
            "UPDATE fields SET last_report = ?, updated_at = ? WHERE id = ?",
            (json.dumps(report), security.now(), field_id),
        )
        return present(owned(db, field_id, user))


@router.delete("/{field_id}", status_code=204)
def delete_field(field_id: str, user=User):
    with connect() as db:
        owned(db, field_id, user)
        db.execute("DELETE FROM fields WHERE id = ?", (field_id,))
