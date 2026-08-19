from datetime import datetime

from pydantic import BaseModel


class LogEntryOut(BaseModel):
    user_id: int
    username: str
    email: str
    user_created_at: datetime
    session_id: int
    title: str
    session_created_at: datetime
    session_updated_at: datetime
    message_id: int
    role: str
    content: str
    request_id: str
    status: str
    latency_ms: int | None
    created_at: datetime


class LogListResponse(BaseModel):
    success: bool = True
    logs: list[LogEntryOut]


# users 테이블에서 관리자에게 공개할 안전한 필드를 정의한다.
class AdminUserOut(BaseModel):
    # 사용자 DB 기본키다.
    id: int
    # 로그인에 사용하는 사용자 이름이다.
    username: str
    # 회원가입 때 등록한 이메일이다.
    email: str
    # 계정이 만들어진 시각이다.
    created_at: datetime

    # SQLAlchemy User 객체를 이 schema로 안전하게 변환한다.
    model_config = {"from_attributes": True}


# chat_sessions 테이블의 전체 저장 필드를 정의한다.
class AdminSessionOut(BaseModel):
    # 대화방 DB 기본키다.
    id: int
    # 대화방 소유자의 사용자 기본키다.
    user_id: int
    # 첫 질문에서 만든 대화방 제목이다.
    title: str
    # 대화방이 만들어진 시각이다.
    created_at: datetime
    # 마지막 질문으로 대화방이 갱신된 시각이다.
    updated_at: datetime

    # SQLAlchemy ChatSession 객체를 이 schema로 변환한다.
    model_config = {"from_attributes": True}


# messages 테이블의 전체 저장 필드를 정의한다.
class AdminMessageOut(BaseModel):
    # 메시지 DB 기본키다.
    id: int
    # 메시지가 속한 대화방 기본키다.
    session_id: int
    # 사용자 질문 또는 AI 답변 역할이다.
    role: str
    # 질문 또는 답변 원문이다.
    content: str
    # 운영 로그와 연결하는 요청 번호다.
    request_id: str
    # 메시지 저장 상태다.
    status: str
    # AI 답변 지연 시간이며 사용자 질문은 null일 수 있다.
    latency_ms: int | None
    # 메시지가 만들어진 시각이다.
    created_at: datetime

    # SQLAlchemy Message 객체를 이 schema로 변환한다.
    model_config = {"from_attributes": True}


# 관리자 화면이 세 SQLite 테이블을 한 번에 받을 응답을 정의한다.
class AdminDatabaseResponse(BaseModel):
    # API 요청 성공 여부다.
    success: bool = True
    # password_hash를 제외한 users 전체 행이다.
    users: list[AdminUserOut]
    # chat_sessions 전체 행이다.
    sessions: list[AdminSessionOut]
    # messages 전체 행이다.
    messages: list[AdminMessageOut]
