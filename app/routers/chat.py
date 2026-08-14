from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_auth
from app.models.user import User
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatSessionDetailResponse,
    ChatSessionListResponse,
    ChatSessionOut,
    MessageOut,
)
from app.services.chat import delete_session, get_owned_session, handle_chat, list_sessions

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def post_chat(
    payload: ChatRequest,
    request: Request,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    result = await handle_chat(
        db,
        user,
        payload.session_id,
        payload.message,
        request_id=request.state.request_id,
    )
    return ChatResponse(
        session_id=result["session_id"], message=MessageOut.model_validate(result["message"])
    )


@router.get("/chats", response_model=ChatSessionListResponse)
def list_chats(user: User = Depends(require_auth), db: Session = Depends(get_db)):
    sessions = list_sessions(db, user)
    return ChatSessionListResponse(
        sessions=[ChatSessionOut.model_validate(s) for s in sessions]
    )


@router.get("/chats/{session_id}", response_model=ChatSessionDetailResponse)
def get_chat(session_id: int, user: User = Depends(require_auth), db: Session = Depends(get_db)):
    session = get_owned_session(db, session_id, user)
    return ChatSessionDetailResponse(
        session=ChatSessionOut.model_validate(session),
        messages=[MessageOut.model_validate(m) for m in session.messages],
    )


@router.delete("/chats/{session_id}")
def delete_chat(session_id: int, user: User = Depends(require_auth), db: Session = Depends(get_db)):
    delete_session(db, session_id, user)
    return {"success": True}
