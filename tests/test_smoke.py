"""Self-verification smoke tests for Agent 1's backend. Mocks OpenRouter — no network calls.

Agent 3 owns the full QA suite (tests/**); this file exists to satisfy the
Definition of Done for the backend/AI/architecture work itself.
"""
from unittest.mock import AsyncMock, patch

from app.services import ai as ai_module
from app.services import chat as chat_module


def _mock_ai(answer="mocked answer", side_effect=None):
    if side_effect is not None:
        return patch.object(chat_module, "call_openrouter", AsyncMock(side_effect=side_effect))
    return patch.object(chat_module, "call_openrouter", AsyncMock(return_value=answer))


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_register_login_me_logout(client):
    r = client.post(
        "/api/auth/register",
        json={"username": "bob", "email": "bob@example.com", "password": "password123"},
    )
    assert r.status_code == 201
    assert r.json()["user"]["username"] == "bob"

    r = client.get("/api/auth/me")
    assert r.status_code == 200  # register already set the session cookie

    client.post("/api/auth/logout")
    r = client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json()["error_code"] == "AUTH_REQUIRED"

    r = client.post("/api/auth/login", json={"username": "bob", "password": "password123"})
    assert r.status_code == 200
    r = client.get("/api/auth/me")
    assert r.status_code == 200


def test_duplicate_registration_rejected(client, registered_user):
    r = client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "someone-else@example.com", "password": "password123"},
    )
    assert r.status_code == 400
    assert r.json()["error_code"] == "USERNAME_TAKEN"


def test_chat_requires_auth(client):
    r = client.post("/api/chat", json={"session_id": None, "message": "hi"})
    assert r.status_code == 401
    assert r.json()["error_code"] == "AUTH_REQUIRED"


def test_chat_rejects_empty_and_too_long_input(client, registered_user):
    client.post("/api/auth/login", json=registered_user)

    r = client.post("/api/chat", json={"session_id": None, "message": "   "})
    assert r.status_code == 400
    assert r.json()["error_code"] == "EMPTY_INPUT"

    r = client.post("/api/chat", json={"session_id": None, "message": "a" * 2001})
    assert r.status_code == 400
    assert r.json()["error_code"] == "INPUT_TOO_LONG"


def test_chat_success_creates_session_and_followup_uses_context(client, registered_user):
    client.post("/api/auth/login", json=registered_user)

    with _mock_ai("블랙홀은 중력이 매우 강한 천체입니다.") as mocked:
        r = client.post("/api/chat", json={"session_id": None, "message": "블랙홀이 뭐야?"})
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        session_id = body["session_id"]
        assert body["message"]["role"] == "assistant"

        sent_messages = mocked.call_args.args[0]
        assert sent_messages[0]["role"] == "system"
        assert sent_messages[-1] == {"role": "user", "content": "블랙홀이 뭐야?"}

    with _mock_ai("시간은 느리게 흐릅니다.") as mocked:
        r = client.post(
            "/api/chat", json={"session_id": session_id, "message": "그 안에서는 시간이 어떻게 돼?"}
        )
        assert r.status_code == 200
        assert r.json()["session_id"] == session_id

        sent_messages = mocked.call_args.args[0]
        contents = [m["content"] for m in sent_messages]
        assert "블랙홀이 뭐야?" in contents  # prior turn carried as context
        assert "블랙홀은 중력이 매우 강한 천체입니다." in contents

    r = client.get(f"/api/chats/{session_id}")
    assert r.status_code == 200
    assert len(r.json()["messages"]) == 4  # 2 user + 2 assistant

    r = client.get("/api/chats")
    assert len(r.json()["sessions"]) == 1


def test_user_cannot_access_or_delete_another_users_session(client, registered_user):
    client.post("/api/auth/login", json=registered_user)
    with _mock_ai("answer"):
        r = client.post("/api/chat", json={"session_id": None, "message": "hello"})
    session_id = r.json()["session_id"]
    client.post("/api/auth/logout")

    client.post(
        "/api/auth/register",
        json={"username": "mallory", "email": "mallory@example.com", "password": "password123"},
    )

    r = client.get(f"/api/chats/{session_id}")
    assert r.status_code == 404
    assert r.json()["error_code"] == "NOT_FOUND"

    r = client.delete(f"/api/chats/{session_id}")
    assert r.status_code == 404


def test_ai_timeout_is_translated_and_does_not_crash(client, registered_user):
    client.post("/api/auth/login", json=registered_user)
    with _mock_ai(side_effect=ai_module.AITimeoutError("boom")):
        r = client.post("/api/chat", json={"session_id": None, "message": "hi"})
    assert r.status_code == 504
    assert r.json()["error_code"] == "AI_TIMEOUT"

    # nothing was persisted for the failed attempt
    r = client.get("/api/chats")
    assert r.json()["sessions"] == []


def test_ai_rate_limit_is_translated(client, registered_user):
    client.post("/api/auth/login", json=registered_user)
    with _mock_ai(side_effect=ai_module.AIRateLimitError("boom")):
        r = client.post("/api/chat", json={"session_id": None, "message": "hi"})
    assert r.status_code == 429
    assert r.json()["error_code"] == "AI_RATE_LIMIT"


def test_ai_generic_error_is_translated(client, registered_user):
    client.post("/api/auth/login", json=registered_user)
    with _mock_ai(side_effect=ai_module.AIAPIError("boom")):
        r = client.post("/api/chat", json={"session_id": None, "message": "hi"})
    assert r.status_code == 502
    assert r.json()["error_code"] == "AI_API_ERROR"
