from datetime import datetime

from pydantic import BaseModel


class ChatRequest(BaseModel):
    session_id: int | None = None
    # The service owns the 2,000-character rule so every oversized string,
    # including very large ones, receives the contracted INPUT_TOO_LONG code.
    message: str


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    success: bool = True
    session_id: int
    message: MessageOut


class ChatSessionOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionListResponse(BaseModel):
    success: bool = True
    sessions: list[ChatSessionOut]


class ChatSessionDetailResponse(BaseModel):
    success: bool = True
    session: ChatSessionOut
    messages: list[MessageOut]
