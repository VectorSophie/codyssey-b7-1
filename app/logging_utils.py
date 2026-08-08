"""Structured operational event logging. Never pass password/cookie/api-key/full content."""
import logging

from app.config import settings

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("everything")

_FORBIDDEN_KEYS = {"password", "cookie", "authorization", "api_key", "openrouter_api_key"}


def log_event(event: str, **fields) -> None:
    safe_fields = {k: v for k, v in fields.items() if k.lower() not in _FORBIDDEN_KEYS}
    kv = " ".join(f"{k}={v}" for k, v in safe_fields.items())
    logger.info("event=%s %s", event, kv)
