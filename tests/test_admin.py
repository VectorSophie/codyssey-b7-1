from dataclasses import replace
from unittest.mock import AsyncMock

from app.config import settings
from app.routers import auth as auth_router_module
from app.models.chat import ChatSession
from app.models.message import Message
from app.models.user import User
from app.services import chat as chat_module


def register(client, username="alice", email="alice@example.com"):
    response = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "password123"},
    )
    assert response.status_code == 201


def test_admin_logs_requires_authentication(client):
    response = client.get("/api/admin/logs")

    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTH_REQUIRED"


def test_admin_logs_rejects_non_admin_user(client, monkeypatch):
    register(client)
    monkeypatch.setattr(
        "app.dependencies.settings", replace(settings, admin_usernames=("someone_else",))
    )

    response = client.get("/api/admin/logs")

    assert response.status_code == 403
    assert response.json()["error_code"] == "ADMIN_REQUIRED"


def test_admin_logs_returns_all_messages_for_admin_user(client, monkeypatch):
    register(client)
    monkeypatch.setattr(
        "app.dependencies.settings", replace(settings, admin_usernames=("alice",))
    )
    monkeypatch.setattr(chat_module, "call_openrouter", AsyncMock(return_value="answer"))
    client.post("/api/chat", json={"session_id": None, "message": "질문"})

    response = client.get("/api/admin/logs")

    assert response.status_code == 200
    logs = response.json()["logs"]
    assert [entry["role"] for entry in logs] == ["assistant", "user"]
    assert all(entry["username"] == "alice" for entry in logs)
    assert all(entry["email"] == "alice@example.com" for entry in logs)
    assert all(isinstance(entry["user_id"], int) for entry in logs)
    assert all(isinstance(entry["message_id"], int) for entry in logs)
    assert all("password" not in entry for entry in logs)
    assert response.headers["Cache-Control"] == "no-store, private"


# 비로그인 사용자가 전체 DB API를 호출하지 못하는지 확인한다.
def test_admin_database_requires_authentication(client):
    # 로그인 쿠키 없이 관리자 DB API를 호출한다.
    response = client.get("/api/admin/database")

    # 인증되지 않은 요청은 401이어야 한다.
    assert response.status_code == 401
    # 프론트가 로그인 이동에 사용할 오류 코드를 확인한다.
    assert response.json()["error_code"] == "AUTH_REQUIRED"


# 일반 로그인 사용자가 전체 DB API를 호출하지 못하는지 확인한다.
def test_admin_database_rejects_non_admin_user(client, monkeypatch):
    # 일반 테스트 계정으로 로그인 쿠키를 만든다.
    register(client)
    # 현재 사용자가 아닌 이름만 관리자 목록에 둔다.
    monkeypatch.setattr(
        "app.dependencies.settings", replace(settings, admin_usernames=("someone_else",))
    )

    # 관리자 DB API를 호출한다.
    response = client.get("/api/admin/database")

    # 로그인했어도 관리자가 아니므로 403이어야 한다.
    assert response.status_code == 403
    # 권한 부족을 인증 실패와 구분하는 코드를 확인한다.
    assert response.json()["error_code"] == "ADMIN_REQUIRED"


# 관리자가 세 SQLite 테이블의 전체 안전 필드를 받는지 확인한다.
def test_admin_database_returns_all_safe_rows(client, db_session, monkeypatch):
    # 관리자 계정을 만들고 로그인 쿠키를 받는다.
    register(client)
    # alice만 관리자 API를 사용할 수 있게 설정한다.
    monkeypatch.setattr(
        "app.dependencies.settings", replace(settings, admin_usernames=("alice",))
    )
    # 테스트 DB에 직접 데이터를 추가할 연결을 연다.
    db = db_session()
    # 회원가입으로 저장된 alice 사용자를 찾는다.
    admin_user = db.query(User).filter(User.username == "alice").one()
    # 대화가 없는 사용자도 users 전체 조회에 포함되는지 확인할 계정을 만든다.
    quiet_user = User(
        # 화면에 표시할 두 번째 사용자 이름이다.
        username="quiet-user",
        # 화면에 표시할 두 번째 사용자 이메일이다.
        email="quiet@example.com",
        # API에 절대 노출되면 안 되는 테스트 해시다.
        password_hash="must-never-leak",
    )
    # 관리자가 만든 대화방 한 건을 준비한다.
    chat_session = ChatSession(user_id=admin_user.id, title="전체 데이터 확인")
    # 사용자와 대화방을 DB 연결에 추가한다.
    db.add_all([quiet_user, chat_session])
    # 메시지가 참조할 대화방 id를 발급한다.
    db.flush()
    # 기존 50개 제한이 남아 있으면 실패하도록 55개 메시지를 만든다.
    messages = [
        Message(
            # 모든 테스트 메시지를 같은 대화방에 연결한다.
            session_id=chat_session.id,
            # 짝수는 사용자, 홀수는 AI 역할로 저장한다.
            role="user" if index % 2 == 0 else "assistant",
            # 각 행을 구분할 메시지 원문이다.
            content=f"전체 메시지 {index}",
            # 운영 로그와 연결할 테스트 요청 번호다.
            request_id=f"request-{index}",
            # 정상 저장 상태를 표시한다.
            status="ok",
            # AI 역할에만 지연 시간을 저장한다.
            latency_ms=index if index % 2 == 1 else None,
        )
        # 0부터 54까지 총 55개 행을 만든다.
        for index in range(55)
    ]
    # 생성한 전체 메시지를 DB에 추가한다.
    db.add_all(messages)
    # 테스트 API가 읽을 수 있게 transaction을 확정한다.
    db.commit()
    # 직접 연 테스트 DB 연결을 닫는다.
    db.close()

    # 관리자 전체 DB API를 호출한다.
    response = client.get("/api/admin/database")

    # 정상 관리자 요청이 성공하는지 확인한다.
    assert response.status_code == 200
    # 세 테이블 응답을 읽는다.
    body = response.json()
    # 대화가 없는 사용자까지 두 명 모두 반환돼야 한다.
    assert [user["username"] for user in body["users"]] == ["alice", "quiet-user"]
    # quiet-user의 개인정보인 이메일도 관리자에게 제공돼야 한다.
    assert body["users"][1]["email"] == "quiet@example.com"
    # DB의 대화방 한 건이 실제 user_id와 함께 반환돼야 한다.
    assert body["sessions"][0]["user_id"] == body["users"][0]["id"]
    # 50개를 넘는 메시지 전체가 잘리지 않고 반환돼야 한다.
    assert len(body["messages"]) == 55
    # 첫 메시지의 추적 필드가 실제 저장값과 같은지 확인한다.
    assert body["messages"][0]["request_id"] == "request-0"
    # 전체 JSON 어디에도 비밀번호 해시나 실제 해시값이 없어야 한다.
    assert "password_hash" not in response.text
    # 비밀값 자체도 응답에 섞이지 않았는지 확인한다.
    assert "must-never-leak" not in response.text
    # 개인정보 응답 저장을 금지하는 header를 확인한다.
    assert response.headers["Cache-Control"] == "no-store, private"
    # 구형 cache 금지 header도 확인한다.
    assert response.headers["Pragma"] == "no-cache"

    # 기존 logs API도 같은 55개 전체 메시지를 제공하는지 확인한다.
    logs_response = client.get("/api/admin/logs")
    # logs API도 정상 응답이어야 한다.
    assert logs_response.status_code == 200
    # 과거의 50개 제한 없이 전체 로그가 제공돼야 한다.
    assert len(logs_response.json()["logs"]) == 55


# 인증 응답이 관리자 목록 원문 대신 현재 사용자의 판정값만 주는지 확인한다.
def test_auth_response_marks_configured_admin(client, monkeypatch):
    # alice가 관리자라고 두 모듈이 같은 테스트 설정을 사용하게 한다.
    admin_settings = replace(settings, admin_usernames=("alice",))
    # 실제 API 권한 검사가 읽는 설정을 바꾼다.
    monkeypatch.setattr("app.dependencies.settings", admin_settings)
    # 인증 응답의 is_admin 계산이 읽는 설정도 바꾼다.
    monkeypatch.setattr(auth_router_module, "settings", admin_settings)

    # 관리자 목록에 포함된 alice 계정을 만든다.
    response = client.post(
        # 회원가입과 동시에 공개 사용자 응답을 받는다.
        "/api/auth/register",
        # 테스트 전용 관리자 계정 정보를 전송한다.
        json={"username": "alice", "email": "alice@example.com", "password": "password123"},
    )

    # 회원가입이 정상 처리됐는지 확인한다.
    assert response.status_code == 201
    # 프론트 메뉴 표시용 관리자 판정이 참이어야 한다.
    assert response.json()["user"]["is_admin"] is True
    # 관리자 이름 전체 목록은 응답 어디에도 없어야 한다.
    assert "admin_usernames" not in response.text
