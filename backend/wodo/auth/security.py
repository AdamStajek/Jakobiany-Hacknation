"""Hasła (scrypt), tokeny, ograniczanie prób i zegar (podmienialny w testach)."""

import base64
import hashlib
import hmac
import os
import secrets
import time
from threading import Lock

N, R, P = 2**14, 8, 1
SESSION_IDLE = 30 * 86400
COOKIE = "wodo_session"


def now():
    return time.time()


def encode(raw):
    return base64.b64encode(raw).decode()


def derive(password, salt, n=N, r=R, p=P):
    return hashlib.scrypt(
        password.encode(), salt=salt, n=n, r=r, p=p, maxmem=128 * n * r * 2 + 2**20
    )


def hash_password(password):
    salt = os.urandom(16)
    return f"scrypt${N}${R}${P}${encode(salt)}${encode(derive(password, salt))}"


def verify_password(password, stored):
    try:
        _, n, r, p, salt, digest = stored.split("$")
        expected = base64.b64decode(digest)
        actual = derive(password, base64.b64decode(salt), int(n), int(r), int(p))
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


DUMMY = hash_password(secrets.token_hex(8))


def new_token():
    return secrets.token_urlsafe(32)


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


class Throttle:
    """Rosnące opóźnienie po kolejnych nieudanych próbach (w pamięci procesu)."""

    def __init__(self):
        self.state = {}
        self.lock = Lock()

    def reset(self):
        with self.lock:
            self.state.clear()

    def wait(self, key, free):
        """Ile sekund trzeba jeszcze poczekać; 0 gdy można próbować."""
        with self.lock:
            count, last = self.state.get(key, (0, 0))
        if count <= free:
            return 0
        return max(0, last + min(2 ** (count - free), 900) - now())

    def fail(self, key):
        with self.lock:
            count, last = self.state.get(key, (0, 0))
            if now() - last > 3600:
                count = 0
            self.state[key] = (count + 1, now())
            if len(self.state) > 20000:
                self.state.pop(next(iter(self.state)))

    def clear(self, key):
        with self.lock:
            self.state.pop(key, None)


throttle = Throttle()
