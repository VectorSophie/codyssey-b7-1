from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    session_id: int | None = None
    message: str = Field(min_length=0, max_length=10_000)  # length rule enforced in service


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
