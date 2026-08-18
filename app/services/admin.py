"""관리자가 SQLite의 안전한 전체 데이터를 조회할 때 사용하는 서비스다."""

# SQLAlchemy 데이터베이스 연결 타입을 불러온다.
from sqlalchemy.orm import Session

# 대화방 테이블 모델을 불러온다.
from app.models.chat import ChatSession
# 메시지 테이블 모델을 불러온다.
from app.models.message import Message
# 사용자 테이블 모델을 불러온다.
from app.models.user import User


# 관리자 화면에 보여줄 세 테이블의 전체 행을 읽는다.
def get_database_snapshot(db: Session) -> dict[str, list]:
    # 사용자는 DB 기본키 순서로 모두 조회한다.
    users = db.query(User).order_by(User.id.asc()).all()
    # 대화방은 DB 기본키 순서로 모두 조회한다.
    sessions = db.query(ChatSession).order_by(ChatSession.id.asc()).all()
    # 메시지는 DB 기본키 순서로 모두 조회한다.
    messages = db.query(Message).order_by(Message.id.asc()).all()

    # 화면이 테이블별로 사용할 전체 데이터를 한 객체로 반환한다.
    return {
        # password_hash는 응답 schema가 제외하고 공개 사용자 필드만 직렬화한다.
        "users": users,
        # 대화방의 실제 저장 필드를 모두 전달한다.
        "sessions": sessions,
        # 메시지의 실제 저장 필드를 모두 전달한다.
        "messages": messages,
    }


# 사용자와 대화방 정보를 결합한 전체 메시지 로그를 최신순으로 읽는다.
def list_message_logs(db: Session) -> list[dict]:
    # 메시지, 대화방, 사용자를 한 SQL JOIN으로 조회한다.
    rows = (
        # 세 모델을 함께 선택해 화면에 필요한 추적 정보를 만든다.
        db.query(Message, ChatSession, User)
        # 메시지의 session_id로 대화방을 연결한다.
        .join(ChatSession, Message.session_id == ChatSession.id)
        # 대화방의 user_id로 사용자를 연결한다.
        .join(User, ChatSession.user_id == User.id)
        # 최신 메시지가 화면 위에 오도록 생성 시각과 id를 내림차순 정렬한다.
        .order_by(Message.created_at.desc(), Message.id.desc())
        # 일부만 자르지 않고 관리자에게 저장된 전체 로그를 제공한다.
        .all()
    )

    # ORM 세 객체를 공개 가능한 평면 응답 객체 목록으로 변환한다.
    return [
        {
            # 대화를 만든 사용자의 DB 기본키다.
            "user_id": user.id,
            # 관리자가 사용자를 식별할 로그인 이름이다.
            "username": user.username,
            # 관리 업무에 필요한 사용자 이메일이다.
            "email": user.email,
            # 사용자 계정이 만들어진 시각이다.
            "user_created_at": user.created_at,
            # 대화방의 DB 기본키다.
            "session_id": chat_session.id,
            # 대화방의 제목이다.
            "title": chat_session.title,
            # 대화방이 처음 만들어진 시각이다.
            "session_created_at": chat_session.created_at,
            # 대화방이 마지막으로 갱신된 시각이다.
            "session_updated_at": chat_session.updated_at,
            # 메시지의 DB 기본키다.
            "message_id": message.id,
            # 질문 또는 AI 답변 역할이다.
            "role": message.role,
            # 질문 또는 AI 답변 원문이다.
            "content": message.content,
            # 서버 운영 로그와 연결할 요청 번호다.
            "request_id": message.request_id,
            # 메시지 저장 처리 상태다.
            "status": message.status,
            # AI 답변 생성에 걸린 시간이며 사용자 질문은 null일 수 있다.
            "latency_ms": message.latency_ms,
            # 메시지가 만들어진 시각이다.
            "created_at": message.created_at,
        }
        # 조회한 각 JOIN 행을 같은 공개 형식으로 변환한다.
        for message, chat_session, user in rows
    ]
