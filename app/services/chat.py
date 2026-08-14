"""Chat orchestration: validate -> load context -> call AI -> persist -> respond.

Persistence happens only after a successful AI call, so a failed AI call never
leaves a half-answered session or orphaned message behind.
"""
from collections import defaultdict, deque
from datetime import datetime, timezone
import time
import uuid

from sqlalchemy.orm import Session

from app.config import settings
from app.errors import (
    AI_API_ERROR,
    AI_RATE_LIMIT,
    AI_TIMEOUT,
    DB_SAVE_ERROR,
    EMPTY_INPUT,
    INPUT_TOO_LONG,
    NOT_FOUND,
    TOO_MANY_REQUESTS,
    AppError,
)
from app.logging_utils import log_event
from app.models.chat import ChatSession
from app.models.message import Message
from app.models.user import User
from app.services.ai import AIAPIError, AIRateLimitError, AITimeoutError, call_openrouter
from app.services.context import build_messages


def _make_title(question: str) -> str:
    title = question.strip().splitlines()[0]
    return title[:60]


# Per-user chat cost guard: OpenRouter's own 429 (AI_RATE_LIMIT) only fires
# once the whole app has already exhausted the shared free-tier quota -- it
# protects OpenRouter, not the other users of this app. This catches a single
# user hammering the endpoint before that happens. A window (not a flat
# per-request cooldown) is deliberate: a real follow-up question seconds
# after the last one is normal and must not be throttled.
# ponytail: in-process dict, not shared across instances -- fine for this
# project's single-process deployment (see docs/ARCHITECTURE.md); move to a
# shared store only if the app is ever run with more than one worker.
_RATE_LIMIT_WINDOW_SECONDS = 60.0
_RATE_LIMIT_MAX_REQUESTS = 20
_recent_requests: dict[int, deque[float]] = defaultdict(deque)


def reset_rate_limit_state() -> None:
    """Test-only hook: each test gets a fresh user id 1 in a fresh DB, so the
    module-level window must not leak request counts across tests."""
    _recent_requests.clear()


def _enforce_rate_limit(user_id: int) -> None:
    now = time.monotonic()
    window = _recent_requests[user_id]
    while window and now - window[0] > _RATE_LIMIT_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= _RATE_LIMIT_MAX_REQUESTS:
        raise AppError(
            TOO_MANY_REQUESTS,
            "too many questions in a short time, please wait a moment",
            status_code=429,
        )
    window.append(now)


def get_owned_session(db: Session, session_id: int, user: User) -> ChatSession:
    session = db.get(ChatSession, session_id)
    if session is None or session.user_id != user.id:
        raise AppError(NOT_FOUND, "conversation not found", status_code=404)
    return session


def list_sessions(db: Session, user: User) -> list[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )


def delete_session(db: Session, session_id: int, user: User) -> None:
    session = get_owned_session(db, session_id, user)
    db.delete(session)
    db.commit()


async def handle_chat(
    db: Session,
    user: User,
    session_id: int | None,
    message: str,
    request_id: str | None = None,
) -> dict:
    request_id = request_id or uuid.uuid4().hex
    log_event("request_received", request_id=request_id, user_id=user.id, session_id=session_id)

    question = message.strip()
    if not question:
        raise AppError(EMPTY_INPUT, "message must not be blank")
    if len(question) > settings.max_message_length:
        raise AppError(INPUT_TOO_LONG, f"message exceeds {settings.max_message_length} characters")
    _enforce_rate_limit(user.id)

    session: ChatSession | None = None
    history: list[Message] = []
    if session_id is not None:
        session = get_owned_session(db, session_id, user)
        history = session.messages

    context_messages = build_messages(history, question)

    log_event("ai_call_start", request_id=request_id, user_id=user.id, session_id=session_id)
    started = time.monotonic()
    try:
        answer = await call_openrouter(context_messages)
    except AITimeoutError as exc:
        latency_ms = int((time.monotonic() - started) * 1000)
        log_event(
            "ai_call_failed",
            request_id=request_id,
            user_id=user.id,
            session_id=session_id,
            latency_ms=latency_ms,
            error_code=AI_TIMEOUT,
        )
        raise AppError(AI_TIMEOUT, "the AI service timed out", status_code=504) from exc
    except AIRateLimitError as exc:
        latency_ms = int((time.monotonic() - started) * 1000)
        log_event(
            "ai_call_failed",
            request_id=request_id,
            user_id=user.id,
            session_id=session_id,
            latency_ms=latency_ms,
            error_code=AI_RATE_LIMIT,
        )
        raise AppError(AI_RATE_LIMIT, "the AI service is rate limited, try again shortly", status_code=429) from exc
    except AIAPIError as exc:
        latency_ms = int((time.monotonic() - started) * 1000)
        log_event(
            "ai_call_failed",
            request_id=request_id,
            user_id=user.id,
            session_id=session_id,
            latency_ms=latency_ms,
            error_code=AI_API_ERROR,
        )
        raise AppError(AI_API_ERROR, "the AI service returned an error", status_code=502) from exc
    latency_ms = int((time.monotonic() - started) * 1000)
    log_event(
        "ai_call_success",
        request_id=request_id,
        user_id=user.id,
        session_id=session_id,
        latency_ms=latency_ms,
    )

    try:
        if session is None:
            session = ChatSession(user_id=user.id, title=_make_title(question))
            db.add(session)
            db.flush()  # assign session.id
        else:
            # A follow-up makes an existing conversation recent again.
            session.updated_at = datetime.now(timezone.utc)

        user_message = Message(
            session_id=session.id,
            role="user",
            content=question,
            request_id=request_id,
            status="ok",
        )
        assistant_message = Message(
            session_id=session.id,
            role="assistant",
            content=answer,
            request_id=request_id,
            status="ok",
            latency_ms=latency_ms,
        )
        db.add_all([user_message, assistant_message])
        db.commit()
        db.refresh(assistant_message)
    except Exception as exc:
        db.rollback()
        log_event(
            "db_save_failed",
            request_id=request_id,
            user_id=user.id,
            session_id=session.id if session is not None else session_id,
        )
        raise AppError(DB_SAVE_ERROR, "failed to save the conversation", status_code=500) from exc

    log_event("db_save_success", request_id=request_id, user_id=user.id, session_id=session.id)

    return {
        "success": True,
        "session_id": session.id,
        "message": assistant_message,
    }
