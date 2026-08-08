"""Chat orchestration: validate -> load context -> call AI -> persist -> respond.

Persistence happens only after a successful AI call, so a failed AI call never
leaves a half-answered session or orphaned message behind.
"""
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


def get_owned_session(db: Session, session_id: int, user: User) -> ChatSession:
    session = db.get(ChatSession, session_id)
    if session is None or session.user_id != user.id:
        raise AppError(NOT_FOUND, "conversation not found", status_code=404)
    return session


async def handle_chat(db: Session, user: User, session_id: int | None, message: str) -> dict:
    request_id = uuid.uuid4().hex
    log_event("request_received", request_id=request_id, user_id=user.id, session_id=session_id)

    question = message.strip()
    if not question:
        raise AppError(EMPTY_INPUT, "message must not be blank")
    if len(question) > settings.max_message_length:
        raise AppError(INPUT_TOO_LONG, f"message exceeds {settings.max_message_length} characters")

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
        log_event("ai_call_failed", request_id=request_id, error_code=AI_TIMEOUT)
        raise AppError(AI_TIMEOUT, "the AI service timed out", status_code=504) from exc
    except AIRateLimitError as exc:
        log_event("ai_call_failed", request_id=request_id, error_code=AI_RATE_LIMIT)
        raise AppError(AI_RATE_LIMIT, "the AI service is rate limited, try again shortly", status_code=429) from exc
    except AIAPIError as exc:
        log_event("ai_call_failed", request_id=request_id, error_code=AI_API_ERROR)
        raise AppError(AI_API_ERROR, "the AI service returned an error", status_code=502) from exc
    latency_ms = int((time.monotonic() - started) * 1000)
    log_event(
        "ai_call_success", request_id=request_id, user_id=user.id, latency_ms=latency_ms
    )

    try:
        if session is None:
            session = ChatSession(user_id=user.id, title=_make_title(question))
            db.add(session)
            db.flush()  # assign session.id

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
        log_event("db_save_failed", request_id=request_id, user_id=user.id)
        raise AppError(DB_SAVE_ERROR, "failed to save the conversation", status_code=500) from exc

    log_event("db_save_success", request_id=request_id, user_id=user.id, session_id=session.id)

    return {
        "success": True,
        "session_id": session.id,
        "message": assistant_message,
    }
