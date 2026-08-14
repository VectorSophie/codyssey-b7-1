from dataclasses import replace
from unittest.mock import AsyncMock

from app.config import settings
from app.services import chat as chat_module


def register(client, username="alice", email="alice@example.com"):
    response = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "password123"},
    )
    assert response.status_code == 201


def test_admin_logs_requires_authentication(client):
    response = client.get("/api/admin/logs")

    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTH_REQUIRED"


def test_admin_logs_rejects_non_admin_user(client, monkeypatch):
    register(client)
    monkeypatch.setattr(
        "app.dependencies.settings", replace(settings, admin_usernames=("someone_else",))
    )

    response = client.get("/api/admin/logs")

    assert response.status_code == 403
    assert response.json()["error_code"] == "ADMIN_REQUIRED"


def test_admin_logs_returns_recent_messages_for_admin_user(client, monkeypatch):
    register(client)
    monkeypatch.setattr(
        "app.dependencies.settings", replace(settings, admin_usernames=("alice",))
    )
    monkeypatch.setattr(chat_module, "call_openrouter", AsyncMock(return_value="answer"))
    client.post("/api/chat", json={"session_id": None, "message": "질문"})

    response = client.get("/api/admin/logs")

    assert response.status_code == 200
    logs = response.json()["logs"]
    assert [entry["role"] for entry in logs] == ["assistant", "user"]
    assert all(entry["username"] == "alice" for entry in logs)
    assert all("password" not in entry for entry in logs)
