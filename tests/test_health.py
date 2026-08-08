from unittest.mock import AsyncMock

from app.services import chat as chat_module


def test_health_is_public_exact_and_performs_zero_ai_calls(client, monkeypatch):
    mocked_ai = AsyncMock(return_value="must not be called")
    monkeypatch.setattr(chat_module, "call_openrouter", mocked_ai)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    mocked_ai.assert_not_awaited()
