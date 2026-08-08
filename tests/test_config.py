"""app.config raises at import time under an insecure production config.

Import-time behavior can't be tested by importing app.config directly (it's
already cached in sys.modules by the time this test file loads), so each
case runs in a subprocess with a controlled environment.
"""
import subprocess
import sys

_BASE_ENV = {
    "OPENROUTER_API_KEY": "test-key",
    "OPENROUTER_MODEL": "openrouter/free",
    "DATABASE_URL": "sqlite://",
}


def _run_import(env_overrides: dict) -> subprocess.CompletedProcess:
    import os

    env = {**os.environ, **_BASE_ENV, **env_overrides}
    return subprocess.run(
        [sys.executable, "-c", "import app.config"],
        cwd=__file__.rsplit("tests", 1)[0],
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )


def test_production_with_default_secret_key_refuses_to_start():
    result = _run_import({"APP_ENV": "production", "SECRET_KEY": "dev-insecure-secret-change-me"})
    assert result.returncode != 0
    assert "SECRET_KEY" in result.stderr


def test_production_with_empty_secret_key_refuses_to_start():
    result = _run_import({"APP_ENV": "production", "SECRET_KEY": ""})
    assert result.returncode != 0
    assert "SECRET_KEY" in result.stderr


def test_production_with_real_secret_key_starts():
    result = _run_import({"APP_ENV": "production", "SECRET_KEY": "a-real-random-value"})
    assert result.returncode == 0


def test_development_with_default_secret_key_starts():
    result = _run_import({"APP_ENV": "development", "SECRET_KEY": "dev-insecure-secret-change-me"})
    assert result.returncode == 0
