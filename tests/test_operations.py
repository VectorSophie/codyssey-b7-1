import logging
from unittest.mock import AsyncMock

from sqlalchemy.orm import Session

from app.logging_utils import log_event
from app.services import chat as chat_module


def register(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice@example.com", "password": "password123"},
    )
    assert response.status_code == 201


def test_success_logs_complete_chat_lifecycle_without_message_content(
    client, monkeypatch, caplog
):
    register(client)
    monkeypatch.setattr(chat_module, "call_openrouter", AsyncMock(return_value="private answer"))
    caplog.set_level(logging.INFO, logger="everything")

    response = client.post(
        "/api/chat", json={"session_id": None, "message": "private question"}
    )

    assert response.status_code == 200
    output = "\n".join(record.getMessage() for record in caplog.records)
    for event in ("request_received", "ai_call_start", "ai_call_success", "db_save_success"):
        assert f"event={event}" in output
    assert "request_id=" in output
    assert "user_id=" in output
    assert "session_id=" in output
    assert "latency_ms=" in output
    assert "private question" not in output
    assert "private answer" not in output


def test_failed_ai_log_has_tracking_metadata(client, monkeypatch, caplog):
    register(client)
    monkeypatch.setattr(
        chat_module,
        "call_openrouter",
        AsyncMock(side_effect=chat_module.AITimeoutError("do not expose")),
    )
    caplog.set_level(logging.INFO, logger="everything")

    response = client.post(
        "/api/chat", json={"session_id": None, "message": "private question"}
    )

    assert response.status_code == 504
    failed = [
        record.getMessage()
        for record in caplog.records
        if "event=ai_call_failed" in record.getMessage()
    ]
    assert len(failed) == 1
    assert "request_id=" in failed[0]
    assert "user_id=" in failed[0]
    assert "session_id=" in failed[0]
    assert "latency_ms=" in failed[0]
    assert "do not expose" not in failed[0]


def test_log_filter_drops_secret_bearing_fields(caplog):
    caplog.set_level(logging.INFO, logger="everything")

    log_event(
        "security_test",
        request_id="safe-id",
        password="pw-secret",
        openrouter_api_key="key-secret",
        session_cookie="cookie-secret",
        authorization_header="bearer-secret",
    )

    output = "\n".join(record.getMessage() for record in caplog.records)
    assert "safe-id" in output
    for secret in ("pw-secret", "key-secret", "cookie-secret", "bearer-secret"):
        assert secret not in output


def test_database_save_failure_returns_controlled_error_and_logs_failure(
    client, monkeypatch, caplog
):
    register(client)
    monkeypatch.setattr(chat_module, "call_openrouter", AsyncMock(return_value="answer"))
    caplog.set_level(logging.INFO, logger="everything")

    def fail_commit(_session):
        raise RuntimeError("database internals")

    monkeypatch.setattr(Session, "commit", fail_commit)
    response = client.post(
        "/api/chat", json={"session_id": None, "message": "question"}
    )

    assert response.status_code == 500
    assert response.json()["error_code"] == "DB_SAVE_ERROR"
    assert "database internals" not in response.text
    output = "\n".join(record.getMessage() for record in caplog.records)
    assert "event=db_save_failed" in output
