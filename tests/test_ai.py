import json
from dataclasses import replace
from unittest.mock import AsyncMock

import httpx
import pytest

from app.config import settings
from app.services import ai as ai_module
from app.services import chat as chat_module


def install_transport(monkeypatch, handler):
    real_async_client = httpx.AsyncClient
    transport = httpx.MockTransport(handler)

    def client_factory(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(ai_module.httpx, "AsyncClient", client_factory)


@pytest.mark.asyncio
async def test_openrouter_200_uses_free_model_fallback_list_and_returns_content(monkeypatch):
    def handler(request):
        body = json.loads(request.content)
        assert request.url == ai_module.OPENROUTER_URL
        assert request.headers["Authorization"] == "Bearer test-key"
        # openrouter/free is a meta-router whose pool includes a non-chat
        # moderation model (nvidia/nemotron-3.5-content-safety:free, verified
        # against the real API returning "User Safety: safe" instead of an
        # answer) -- send an explicit curated fallback list instead.
        assert body["models"] == ai_module.FREE_MODEL_FALLBACKS
        assert "model" not in body
        assert body["messages"][-1]["content"] == "질문"
        return httpx.Response(
            200, json={"choices": [{"message": {"content": "응답"}}]}
        )

    install_transport(monkeypatch, handler)

    answer = await ai_module.call_openrouter([{"role": "user", "content": "질문"}])

    assert answer == "응답"


def test_free_model_fallback_list_excludes_known_non_chat_models():
    # Verified empirically against the real OpenRouter API (not asserted
    # here, since tests must never make real network calls): these three
    # produced no usable answer -- a moderation classifier, an empty
    # response, and a model that code-switched into Hindi/Russian.
    excluded = {
        "nvidia/nemotron-3.5-content-safety:free",
        "inclusionai/ling-3.0-tiny:free",
        "nvidia/nemotron-3-nano-30b-a3b:free",
        "nvidia/nemotron-nano-12b-v2-vl:free",
        "nvidia/nemotron-nano-9b-v2:free",
    }
    assert not excluded & set(ai_module.FREE_MODEL_FALLBACKS)
    assert all(m.endswith(":free") for m in ai_module.FREE_MODEL_FALLBACKS)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("response", "expected_error"),
    [
        (httpx.Response(429, json={"error": "limited"}), ai_module.AIRateLimitError),
        (httpx.Response(500, json={"error": "upstream"}), ai_module.AIAPIError),
        (httpx.Response(200, json={"unexpected": True}), ai_module.AIAPIError),
        (
            httpx.Response(200, json={"choices": [{"message": {"content": None}}]}),
            ai_module.AIAPIError,
        ),
    ],
)
async def test_openrouter_translates_rate_limit_upstream_and_malformed_responses(
    monkeypatch, response, expected_error
):
    install_transport(monkeypatch, lambda _request: response)

    with pytest.raises(expected_error):
        await ai_module.call_openrouter([{"role": "user", "content": "질문"}])


@pytest.mark.asyncio
async def test_openrouter_translates_transport_timeout(monkeypatch):
    def handler(request):
        raise httpx.ReadTimeout("slow", request=request)

    install_transport(monkeypatch, handler)

    with pytest.raises(ai_module.AITimeoutError):
        await ai_module.call_openrouter([{"role": "user", "content": "질문"}])


def register(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice@example.com", "password": "password123"},
    )
    assert response.status_code == 201


@pytest.mark.parametrize(
    ("error", "status_code", "error_code"),
    [
        (ai_module.AITimeoutError("secret traceback"), 504, "AI_TIMEOUT"),
        (ai_module.AIRateLimitError("secret traceback"), 429, "AI_RATE_LIMIT"),
        (ai_module.AIAPIError("secret traceback"), 502, "AI_API_ERROR"),
    ],
)
def test_ai_failures_return_controlled_errors_without_raw_exception(
    client, monkeypatch, error, status_code, error_code
):
    register(client)
    monkeypatch.setattr(chat_module, "call_openrouter", AsyncMock(side_effect=error))

    response = client.post(
        "/api/chat", json={"session_id": None, "message": "질문"}
    )

    assert response.status_code == status_code
    assert response.json()["error_code"] == error_code
    assert "secret traceback" not in response.text
    assert client.get("/api/chats").json()["sessions"] == []


@pytest.mark.asyncio
async def test_paid_model_configuration_is_rejected_before_network(monkeypatch):
    monkeypatch.setattr(
        ai_module,
        "settings",
        replace(settings, openrouter_model="some-provider/paid-model"),
    )

    with pytest.raises(ai_module.AIAPIError):
        await ai_module.call_openrouter([{"role": "user", "content": "질문"}])


@pytest.mark.asyncio
async def test_missing_api_key_is_rejected_before_network(monkeypatch):
    monkeypatch.setattr(
        ai_module,
        "settings",
        replace(settings, openrouter_api_key=""),
    )

    with pytest.raises(ai_module.AIAPIError):
        await ai_module.call_openrouter([{"role": "user", "content": "질문"}])
