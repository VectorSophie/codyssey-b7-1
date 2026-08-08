"""Minimal async OpenRouter client, pinned to the free tier. No retries, no paid fallback."""
import httpx

from app.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
FREE_MODEL = "openrouter/free"

# openrouter/free is an auto-router, not a single model -- its pool includes
# non-chat models. Verified directly against the OpenRouter API:
# nvidia/nemotron-3.5-content-safety:free is a moderation classifier and
# returns "User Safety: safe" instead of answering the question. Send an
# explicit ordered fallback list of models empirically confirmed to produce
# correct, coherent Korean answers instead of relying on the auto-router.
# Every entry is :free -- cost stays zero, no paid fallback introduced.
# Capped at 3: OpenRouter rejects a "models" array with more than 3 items
# (400 "'models' array must have 3 items or fewer", confirmed against the
# real API).
FREE_MODEL_FALLBACKS = [
    "openai/gpt-oss-20b:free",
    "google/gemma-4-26b-a4b-it:free",
    "poolside/laguna-s-2.1:free",
]

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
    # Fail closed: an accidental environment override must never turn this
    # free-tier-only project into a paid-model caller.
    if settings.openrouter_model != FREE_MODEL:
        raise AIAPIError(f"Only {FREE_MODEL} is permitted")
    if not settings.openrouter_api_key:
        raise AIAPIError("OPENROUTER_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }
    body = {"models": FREE_MODEL_FALLBACKS, "messages": messages}

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
        content = data["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            raise ValueError("assistant content must be a non-empty string")
        return content
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise AIAPIError("OpenRouter returned an unexpected response shape") from exc
