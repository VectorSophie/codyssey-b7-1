from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_admin
from app.models.user import User
from app.schemas.admin import (
    AdminDatabaseResponse,
    AdminMessageOut,
    AdminSessionOut,
    AdminUserOut,
    LogEntryOut,
    LogListResponse,
)
from app.services.admin import get_database_snapshot, list_message_logs

router = APIRouter(prefix="/api/admin", tags=["admin"])


# 개인정보 응답이 브라우저나 중간 cache에 저장되지 않게 header를 설정한다.
def _disable_private_data_cache(response: Response) -> None:
    # 표준 HTTP cache 정책으로 저장을 금지하고 사용자별 응답임을 표시한다.
    response.headers["Cache-Control"] = "no-store, private"
    # 오래된 HTTP/1.0 cache도 응답을 보관하지 않게 한다.
    response.headers["Pragma"] = "no-cache"


@router.get("/logs", response_model=LogListResponse)
def get_logs(
    response: Response,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """ADMIN_USERNAMES에 등록된 관리자에게 전체 결합 로그를 제공한다."""
    # 민감한 관리자 로그가 cache에 남지 않게 한다.
    _disable_private_data_cache(response)
    # 최근 50개 제한 없이 저장된 전체 메시지 로그를 조회한다.
    logs = list_message_logs(db)
    # schema로 허용한 안전한 필드만 JSON 응답으로 만든다.
    return LogListResponse(logs=[LogEntryOut.model_validate(log) for log in logs])


# 관리자가 SQLite의 세 업무 테이블 전체를 확인할 API를 제공한다.
@router.get("/database", response_model=AdminDatabaseResponse)
def get_database(
    # 응답 header에 cache 금지 정책을 넣기 위한 객체다.
    response: Response,
    # 로그인 사용자 이름이 ADMIN_USERNAMES에 있어야 이 함수가 실행된다.
    _admin: User = Depends(require_admin),
    # 요청 한 번 동안 사용할 SQLAlchemy 연결이다.
    db: Session = Depends(get_db),
):
    # 개인정보와 대화 원문이 cache에 저장되지 않게 한다.
    _disable_private_data_cache(response)
    # users, chat_sessions, messages 전체 행을 각각 조회한다.
    snapshot = get_database_snapshot(db)
    # password_hash가 없는 명시적 schema로만 응답을 직렬화한다.
    return AdminDatabaseResponse(
        # users의 공개 가능한 네 필드만 변환한다.
        users=[AdminUserOut.model_validate(user) for user in snapshot["users"]],
        # chat_sessions의 전체 저장 필드를 변환한다.
        sessions=[AdminSessionOut.model_validate(session) for session in snapshot["sessions"]],
        # messages의 전체 저장 필드를 변환한다.
        messages=[AdminMessageOut.model_validate(message) for message in snapshot["messages"]],
    )
