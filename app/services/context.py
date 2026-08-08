"""Build a bounded conversation context to send to OpenRouter."""
from app.config import settings
from app.models.message import Message
from app.services.ai import SYSTEM_PROMPT


def build_messages(history: list[Message], user_question: str) -> list[dict]:
    """system prompt + up to the last N history messages (char-capped) + new question."""
    recent = history[-settings.context_message_limit :]

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    budget = settings.context_char_cap
    kept: list[dict] = []
    for msg in reversed(recent):
        cost = len(msg.content)
        if budget - cost < 0:
            break
        budget -= cost
        kept.append({"role": msg.role, "content": msg.content})
    kept.reverse()

    messages.extend(kept)
    messages.append({"role": "user", "content": user_question})
    return messages
