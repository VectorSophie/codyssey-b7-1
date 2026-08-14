from datetime import datetime

from pydantic import BaseModel


class LogEntryOut(BaseModel):
    username: str
    session_id: int
    title: str
    role: str
    content: str
    request_id: str
    status: str
    latency_ms: int | None
    created_at: datetime


class LogListResponse(BaseModel):
    success: bool = True
    logs: list[LogEntryOut]
