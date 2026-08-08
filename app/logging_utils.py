"""Structured operational event logging. Never pass password/cookie/api-key/full content."""
import logging

from app.config import settings

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("everything")

_FORBIDDEN_KEY_PARTS = (
    "password",
    "secret",
    "token",
    "cookie",
    "authorization",
    "api_key",
    "apikey",
)


def _is_forbidden(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return any(part in normalized for part in _FORBIDDEN_KEY_PARTS)


def log_event(event: str, **fields) -> None:
    safe_fields = {k: v for k, v in fields.items() if not _is_forbidden(k)}
    kv = " ".join(f"{k}={v}" for k, v in safe_fields.items())
    logger.info("event=%s %s", event, kv)
