"""Application configuration, loaded from environment variables (.env in dev)."""
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    secret_key: str = os.getenv("SECRET_KEY", "dev-insecure-secret-change-me")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")

    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    openrouter_model: str = os.getenv("OPENROUTER_MODEL", "openrouter/free")
    ai_timeout_seconds: float = float(os.getenv("AI_TIMEOUT_SECONDS", "20"))

    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "everything_session")
    session_https_only: bool = os.getenv("SESSION_HTTPS_ONLY", "false").lower() == "true"
    session_max_age_seconds: int = 60 * 60 * 24 * 7  # 7 days

    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    # Comma-separated usernames allowed to call /api/admin/*. A config
    # allowlist rather than an is_admin DB column: this project has no
    # migration tooling (Base.metadata.create_all only creates missing
    # tables, it doesn't alter existing ones), so a new column wouldn't
    # apply to an already-deployed database. Empty by default -- no admin
    # routes are reachable until this is explicitly set.
    admin_usernames: tuple[str, ...] = tuple(
        name.strip() for name in os.getenv("ADMIN_USERNAMES", "").split(",") if name.strip()
    )

    max_message_length: int = 2000
    context_message_limit: int = 10
    context_char_cap: int = 6000


settings = Settings()

_INSECURE_DEFAULT_SECRET = "dev-insecure-secret-change-me"

if settings.app_env == "production" and settings.secret_key in ("", _INSECURE_DEFAULT_SECRET):
    raise RuntimeError(
        "SECRET_KEY must be set to a real random value when APP_ENV=production "
        "(session cookies would otherwise be forgeable by anyone)."
    )
