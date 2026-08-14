from unittest.mock import AsyncMock

from app.models.message import Message
from app.services import chat as chat_module


def register(client, username="alice", email="alice@example.com"):
    response = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "password123"},
    )
    assert response.status_code == 201


def test_blank_and_over_2000_character_questions_are_rejected_without_ai_call(
    client, monkeypatch
):
    register(client)
    mocked_ai = AsyncMock(return_value="must not be used")
    monkeypatch.setattr(chat_module, "call_openrouter", mocked_ai)

    blank = client.post("/api/chat", json={"session_id": None, "message": " \n\t "})
    oversized_responses = [
        client.post("/api/chat", json={"session_id": None, "message": "가" * size})
        for size in (2001, 10_001)
    ]

    assert blank.status_code == 400
    assert blank.json()["error_code"] == "EMPTY_INPUT"
    assert all(response.status_code == 400 for response in oversized_responses)
    assert all(
        response.json()["error_code"] == "INPUT_TOO_LONG"
        for response in oversized_responses
    )
    mocked_ai.assert_not_awaited()


def test_normal_question_calls_ai_once_and_persists_both_messages(
    client, db_session, monkeypatch
):
    register(client)
    mocked_ai = AsyncMock(return_value="판은 지구 표면을 이루는 큰 조각입니다.")
    monkeypatch.setattr(chat_module, "call_openrouter", mocked_ai)

    response = client.post(
        "/api/chat", json={"session_id": None, "message": "판 구조론이 뭐야?"}
    )

    assert response.status_code == 200
    session_id = response.json()["session_id"]
    request_id = response.headers["X-Request-ID"]
    mocked_ai.assert_awaited_once()

    detail = client.get(f"/api/chats/{session_id}").json()
    assert detail["session"]["title"] == "판 구조론이 뭐야?"
    assert [message["role"] for message in detail["messages"]] == ["user", "assistant"]
    assert detail["messages"][1]["content"] == "판은 지구 표면을 이루는 큰 조각입니다."

    with db_session() as db:
        saved = db.query(Message).order_by(Message.id).all()
        assert len(saved) == 2
        assert saved[0].request_id == saved[1].request_id == request_id
        assert saved[1].latency_ms is not None


def test_followup_sends_prior_context_and_respects_single_call_per_question(
    client, monkeypatch
):
    register(client)
    first_ai = AsyncMock(return_value="판은 천천히 움직입니다.")
    monkeypatch.setattr(chat_module, "call_openrouter", first_ai)
    first = client.post(
        "/api/chat", json={"session_id": None, "message": "판 구조론이 뭐야?"}
    )
    session_id = first.json()["session_id"]

    followup_ai = AsyncMock(return_value="판의 경계에서 지진이 자주 발생합니다.")
    monkeypatch.setattr(chat_module, "call_openrouter", followup_ai)
    followup = client.post(
        "/api/chat",
        json={"session_id": session_id, "message": "그럼 지진이랑 무슨 관계야?"},
    )

    assert followup.status_code == 200
    first_ai.assert_awaited_once()
    followup_ai.assert_awaited_once()
    sent = followup_ai.await_args.args[0]
    assert sent[0]["role"] == "system"
    assert {"role": "user", "content": "판 구조론이 뭐야?"} in sent
    assert {"role": "assistant", "content": "판은 천천히 움직입니다."} in sent
    assert sent[-1] == {"role": "user", "content": "그럼 지진이랑 무슨 관계야?"}


def test_conversation_list_is_user_specific_and_delete_enforces_ownership(
    client, monkeypatch
):
    mocked_ai = AsyncMock(return_value="answer")
    monkeypatch.setattr(chat_module, "call_openrouter", mocked_ai)

    register(client)
    alice_chat = client.post(
        "/api/chat", json={"session_id": None, "message": "alice question"}
    ).json()["session_id"]
    client.post("/api/auth/logout")

    register(client, "bob", "bob@example.com")
    bob_chat = client.post(
        "/api/chat", json={"session_id": None, "message": "bob question"}
    ).json()["session_id"]

    bob_list = client.get("/api/chats").json()["sessions"]
    assert [session["id"] for session in bob_list] == [bob_chat]
    assert client.get(f"/api/chats/{alice_chat}").status_code == 404
    assert client.delete(f"/api/chats/{alice_chat}").status_code == 404

    deleted = client.delete(f"/api/chats/{bob_chat}")
    assert deleted.status_code == 200
    assert client.get("/api/chats").json()["sessions"] == []


def test_rapid_fire_questions_beyond_the_window_are_throttled(client, monkeypatch):
    register(client)
    monkeypatch.setattr(chat_module, "call_openrouter", AsyncMock(return_value="answer"))

    responses = [
        client.post("/api/chat", json={"session_id": None, "message": f"question {i}"})
        for i in range(chat_module._RATE_LIMIT_MAX_REQUESTS + 1)
    ]

    assert [r.status_code for r in responses[:-1]] == [200] * chat_module._RATE_LIMIT_MAX_REQUESTS
    assert responses[-1].status_code == 429
    assert responses[-1].json()["error_code"] == "TOO_MANY_REQUESTS"


def test_followup_moves_existing_conversation_to_top_of_recent_list(client, monkeypatch):
    register(client)
    monkeypatch.setattr(chat_module, "call_openrouter", AsyncMock(return_value="answer"))
    older_id = client.post(
        "/api/chat", json={"session_id": None, "message": "older"}
    ).json()["session_id"]
    newer_id = client.post(
        "/api/chat", json={"session_id": None, "message": "newer"}
    ).json()["session_id"]
    assert [item["id"] for item in client.get("/api/chats").json()["sessions"]] == [
        newer_id,
        older_id,
    ]

    followup = client.post(
        "/api/chat", json={"session_id": older_id, "message": "follow up"}
    )

    assert followup.status_code == 200
    assert [item["id"] for item in client.get("/api/chats").json()["sessions"]] == [
        older_id,
        newer_id,
    ]
