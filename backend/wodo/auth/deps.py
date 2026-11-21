import os

from fastapi import Depends, HTTPException, Request, Response

from wodo.auth import security
from wodo.db import connect

SAFE = {"GET", "HEAD", "OPTIONS"}


def is_dev():
    return os.environ.get("WODO_ENV", "production").lower() in {"dev", "development", "test"}


def guard(request: Request, response: Response):
    """Żądania zmieniające stan wymagają nagłówka X-Requested-With; odpowiedzi nie trafiają do cache."""
    if request.method not in SAFE and not request.headers.get("x-requested-with"):
        raise HTTPException(403, "Brakuje nagłówka X-Requested-With.")
    response.headers["Cache-Control"] = "no-store"


def current_user(request: Request):
    token = request.cookies.get(security.COOKIE)
    if not token:
        raise HTTPException(401, "Zaloguj się, aby kontynuować.")
    hashed = security.token_hash(token)
    moment = security.now()
    with connect() as db:
        row = db.execute(
            "SELECT u.*, s.expires_at, s.last_seen FROM sessions s JOIN users u ON u.id = s.user_id "
            "WHERE s.token_hash = ?",
            (hashed,),
        ).fetchone()
        if row is None or row["expires_at"] < moment:
            if row is not None:
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (hashed,))
            raise HTTPException(401, "Sesja wygasła. Zaloguj się ponownie.")
        if moment - row["last_seen"] > 300:
            db.execute(
                "UPDATE sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?",
                (moment, moment + security.SESSION_IDLE, hashed),
            )
    return dict(row, session_hash=hashed)


User = Depends(current_user)
