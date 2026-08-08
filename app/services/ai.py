"""Minimal async OpenRouter client, pinned to the free tier. No retries, no paid fallback."""
import httpx

from app.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are EVERYTHING, a conversational encyclopedia.\n"
    "Answer clearly, accurately, and at the level implied by the user's question.\n"
    "Use previous conversation context when relevant.\n"
    "Do not pretend uncertain information is certain.\n"
    "If you do not know something reliably, say so.\n"
    "Prefer understandable explanations and useful examples over unnecessary verbosity."
)


class AITimeoutError(Exception):
    pass


class AIRateLimitError(Exception):
    pass


class AIAPIError(Exception):
    pass


async def call_openrouter(messages: list[dict]) -> str:
    """Send one chat-completion request. Raises AITimeoutError/AIRateLimitError/AIAPIError."""
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }
    body = {"model": settings.openrouter_model, "messages": messages}

    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.post(OPENROUTER_URL, headers=headers, json=body)
    except httpx.TimeoutException as exc:
        raise AITimeoutError("OpenRouter request timed out") from exc
    except httpx.HTTPError as exc:
        raise AIAPIError(f"OpenRouter request failed: {exc}") from exc

    if response.status_code == 429:
        raise AIRateLimitError("OpenRouter rate limit exceeded")
    if response.status_code >= 400:
        raise AIAPIError(f"OpenRouter returned status {response.status_code}")

    try:
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        raise AIAPIError("OpenRouter returned an unexpected response shape") from exc
