"""Rejestracja, logowanie e-mailem lub nazwą, sesje w bazie, reset hasła i konto bieżącego użytkownika."""

import re
import sqlite3

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Response,
)
from pydantic import BaseModel, ConfigDict, Field, field_validator

from wodo.auth import security
from wodo.auth.deps import User, guard, is_dev
from wodo.db import connect
from wodo.notify import mailer, templates

router = APIRouter(prefix="/api", dependencies=[Depends(guard)], tags=["konta"])

EMAIL = re.compile(r"[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}")
USERNAME = re.compile(r"[A-Za-z0-9_.-]{3,32}")
VERIFY_TTL = 48 * 3600
RESET_TTL = 3600
BAD_LOGIN = "Nieprawidłowy login lub hasło."


def clean_password(value):
    if not 10 <= len(value) <= 200:
        raise ValueError("Hasło musi mieć od 10 do 200 znaków.")
    return value


class Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Register(Body):
    email: str = Field(max_length=254)
    username: str
    password: str

    @field_validator("email")
    @classmethod
    def email_ok(cls, value):
        value = value.strip().lower()
        if not EMAIL.fullmatch(value):
            raise ValueError("Podaj prawidłowy adres e-mail.")
        return value

    @field_validator("username")
    @classmethod
    def username_ok(cls, value):
        value = value.strip()
        if not USERNAME.fullmatch(value):
            raise ValueError(
                "Nazwa użytkownika: 3-32 znaków, litery, cyfry oraz _ . -"
            )
        return value

    @field_validator("password")
    @classmethod
    def password_ok(cls, value):
        return clean_password(value)


class Login(Body):
    identifier: str = Field(max_length=254)
    password: str = Field(max_length=200)


class Token(Body):
    token: str = Field(max_length=200)


class Forgot(Body):
    email: str = Field(max_length=254)


class Reset(Body):
    token: str = Field(max_length=200)
    password: str

    @field_validator("password")
    @classmethod
    def password_ok(cls, value):
        return clean_password(value)


class ChangePassword(Body):
    current: str = Field(max_length=200)
    new: str

    @field_validator("new")
    @classmethod
    def new_ok(cls, value):
        return clean_password(value)


def public(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "email_verified": bool(user["email_verified"]),
        "role": user["role"],
    }


def client_ip(request):
    return request.client.host if request.client else "local"


def issue_token(db, user_id, purpose, ttl):
    token = security.new_token()
    db.execute("DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?", (user_id, purpose))
    db.execute(
        "INSERT INTO email_tokens VALUES (?, ?, ?, ?)",
        (security.token_hash(token), user_id, purpose, security.now() + ttl),
    )
    return token


def consume_token(db, token, purpose):
    hashed = security.token_hash(token)
    row = db.execute(
        "SELECT user_id, expires_at FROM email_tokens WHERE token_hash = ? AND purpose = ?",
        (hashed, purpose),
    ).fetchone()
    if row is None or row["expires_at"] < security.now():
        raise HTTPException(400, "Link jest nieprawidłowy lub wygasł.")
    db.execute("DELETE FROM email_tokens WHERE token_hash = ?", (hashed,))
    return row["user_id"]


def open_session(db, response, user_id):
    token = security.new_token()
    moment = security.now()
    db.execute(
        "INSERT INTO sessions VALUES (?, ?, ?, ?, ?)",
        (security.token_hash(token), user_id, moment, moment, moment + security.SESSION_IDLE),
    )
    response.set_cookie(
        security.COOKIE,
        token,
        max_age=security.SESSION_IDLE,
        httponly=True,
        samesite="lax",
        secure=not is_dev(),
        path="/",
    )


def mail_verification(user_id, email, username, token):
    mailer.send(email, *templates.verification(username, token))


def mail_reset(email, username, token):
    mailer.send(email, *templates.reset(username, token))


def mail_welcome(email, username):
    mailer.send(email, *templates.welcome(username))


def mail_password_changed(email, username):
    mailer.send(email, *templates.password_changed(username))


def check_throttle(keys):
    wait = max(security.throttle.wait(key, free) for key, free in keys)
    if wait > 0:
        raise HTTPException(
            429,
            "Za dużo prób. Spróbuj ponownie za chwilę.",
            headers={"Retry-After": str(int(wait) + 1)},
        )


@router.post("/auth/register", status_code=201)
def register(body: Register, request: Request, response: Response, tasks: BackgroundTasks):
    ip = ("reg-ip", client_ip(request))
    check_throttle([(ip, 10)])
    security.throttle.fail(ip)
    hashed = security.hash_password(body.password)
    try:
        with connect() as db:
            cursor = db.execute(
                "INSERT INTO users (email, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (body.email, body.username, hashed, security.now()),
            )
            user_id = cursor.lastrowid
            token = issue_token(db, user_id, "verify", VERIFY_TTL)
            open_session(db, response, user_id)
            user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    except sqlite3.IntegrityError as error:
        raise HTTPException(409, "Konto z takim adresem e-mail lub nazwą już istnieje.") from error
    tasks.add_task(mail_verification, user_id, body.email, body.username, token)
    return public(user)


@router.post("/auth/verify")
def verify(body: Token, tasks: BackgroundTasks):
    with connect() as db:
        user_id = consume_token(db, body.token, "verify")
        was_verified = db.execute("SELECT email_verified FROM users WHERE id = ?", (user_id,)).fetchone()[0]
        db.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user_id,))
        user = db.execute("SELECT email, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if not was_verified and user:
        tasks.add_task(mail_welcome, user["email"], user["username"])
    return {"email_verified": True}


@router.post("/auth/resend-verification", status_code=202)
def resend_verification(tasks: BackgroundTasks, user=User):
    if user["email_verified"]:
        return {"sent": False}
    key = ("resend", user["id"])
    check_throttle([(key, 2)])
    security.throttle.fail(key)
    with connect() as db:
        token = issue_token(db, user["id"], "verify", VERIFY_TTL)
    tasks.add_task(mail_verification, user["id"], user["email"], user["username"], token)
    return {"sent": True}


@router.post("/auth/login")
def login(body: Login, request: Request, response: Response):
    identifier = body.identifier.strip().lower()
    keys = [(("login-id", identifier), 4), (("login-ip", client_ip(request)), 20)]
    check_throttle(keys)
    column = "email" if "@" in identifier else "username"
    with connect() as db:
        user = db.execute(f"SELECT * FROM users WHERE {column} = ?", (identifier,)).fetchone()
        valid = security.verify_password(
            body.password, user["password_hash"] if user else security.DUMMY
        )
        if not user or not valid:
            for key, _ in keys:
                security.throttle.fail(key)
            raise HTTPException(401, BAD_LOGIN)
        security.throttle.clear(keys[0][0])
        open_session(db, response, user["id"])
    return public(user)


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response):
    token = request.cookies.get(security.COOKIE)
    if token:
        with connect() as db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (security.token_hash(token),))
    response.delete_cookie(security.COOKIE, path="/")
    response.status_code = 204


@router.post("/auth/forgot", status_code=202)
def forgot(body: Forgot, request: Request, tasks: BackgroundTasks):
    email = body.email.strip().lower()
    keys = [(("forgot-email", email), 3), (("forgot-ip", client_ip(request)), 10)]
    try:
        check_throttle(keys)
    except HTTPException:
        return {"accepted": True}
    for key, _ in keys:
        security.throttle.fail(key)
    with connect() as db:
        user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if user:
            token = issue_token(db, user["id"], "reset", RESET_TTL)
            tasks.add_task(mail_reset, user["email"], user["username"], token)
    return {"accepted": True}


@router.post("/auth/reset")
def reset(body: Reset, tasks: BackgroundTasks):
    with connect() as db:
        user_id = consume_token(db, body.token, "reset")
        user = db.execute("SELECT email, username FROM users WHERE id = ?", (user_id,)).fetchone()
        db.execute(
            "UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?",
            (security.hash_password(body.password), user_id),
        )
        db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    if user:
        tasks.add_task(mail_password_changed, user["email"], user["username"])
    return {"reset": True}


@router.get("/me")
def me(user=User):
    return public(user)


@router.post("/me/password")
def change_password(body: ChangePassword, tasks: BackgroundTasks, user=User):
    key = ("pw", user["id"])
    check_throttle([(key, 4)])
    if not security.verify_password(body.current, user["password_hash"]):
        security.throttle.fail(key)
        raise HTTPException(403, "Obecne hasło jest nieprawidłowe.")
    with connect() as db:
        db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (security.hash_password(body.new), user["id"]),
        )
        db.execute(
            "DELETE FROM sessions WHERE user_id = ? AND token_hash != ?",
            (user["id"], user["session_hash"]),
        )
    tasks.add_task(mail_password_changed, user["email"], user["username"])
    return {"changed": True}


@router.delete("/me", status_code=204)
def delete_account(response: Response, user=User):
    with connect() as db:
        db.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    response.delete_cookie(security.COOKIE, path="/")
    response.status_code = 204
