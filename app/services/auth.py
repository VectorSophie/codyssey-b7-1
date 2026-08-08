"""Password hashing and signed session tokens (stdlib hashlib/hmac only)."""
import base64
import hashlib
import hmac
import json
import os
import time

from app.config import settings

_PBKDF2_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_hex, digest_hex = password_hash.split("$", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(digest_hex)
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return hmac.compare_digest(actual, expected)


def _sign(payload: bytes) -> str:
    mac = hmac.new(settings.secret_key.encode(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode().rstrip("=")


def create_session_token(user_id: int) -> str:
    payload = json.dumps(
        {"user_id": user_id, "exp": int(time.time()) + settings.session_max_age_seconds}
    ).encode()
    body = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    return f"{body}.{_sign(payload)}"


def verify_session_token(token: str) -> int | None:
    """Return the user_id encoded in a valid, unexpired token, else None."""
    try:
        body, signature = token.split(".", 1)
        padded = body + "=" * (-len(body) % 4)
        payload = base64.urlsafe_b64decode(padded)
        if not hmac.compare_digest(_sign(payload), signature):
            return None
        data = json.loads(payload)
        if data["exp"] < time.time():
            return None
        return int(data["user_id"])
    except (ValueError, KeyError, TypeError):
        return None
