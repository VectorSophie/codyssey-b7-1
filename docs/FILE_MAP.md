# 파일 지도 — 무엇이 어디 있는가

퍼실 질문 중 "비동기는 왜?", "의존성 주입이 뭔데?", "이 검증은 어디서
하나?" 같은 것에 답할 때, 코드를 처음부터 찾아 헤매지 않도록 파일마다
역할과 거기 담긴 핵심 개념을 한 번에 정리한 지도다. 각 개념을 더 깊이
설명한 문서로 바로 연결한다.

- 요청 흐름을 그림으로 보고 싶으면 → `docs/ARCHITECTURE.md` (mermaid
  플로우차트, ERD, 시퀀스 다이어그램)
- API 요청/응답 모양, 에러 코드 전체 목록 → `docs/API_CONTRACT.md`
- "왜 이렇게 짰는지" 코드 레벨 설명 → `docs/BACKEND_DEEPDIVE.md`
- 테스트가 각각 뭘 검증하는지 → `docs/TESTING.md`

## 백엔드 계층 구조

```
routers/   HTTP 경계 — 파싱, Depends() 선언, 서비스 호출, 응답 변환
  ↓
services/  검증·인증·AI 호출·DB 접근 (테이블당 서비스 모듈 하나)
  ↓
models/    SQLAlchemy 테이블 정의
  ↓
기반       config.py · database.py · errors.py · logging_utils.py · dependencies.py
```

### `app/` — 기반

| 파일 | 역할 | 핵심 개념 |
|---|---|---|
| `main.py` | 앱 조립, 예외 핸들러 2개, `/health`, SPA 폴백 | 미들웨어가 필요한 유일한 경우(`/api/chat`의 `X-Request-ID`)는 왜 `Depends`가 아닌지 |
| `config.py` | `Settings` — 환경변수를 모듈 로드 시 한 번만 읽는 `frozen dataclass` | 운영 환경에서 기본 `SECRET_KEY`면 기동 자체를 거부하는 import-time 가드 |
| `database.py` | SQLAlchemy 엔진·세션·`get_db()` | **의존성 주입**의 표준 형태 — `yield`가 있는 함수를 `Depends(get_db)`로 쓰면 요청마다 세션이 열리고 항상 닫힘 |
| `dependencies.py` | `get_current_user` → `require_auth` → `require_admin` 3단 체인 | `Depends()` 체인 조립, 실패해도 예외 아닌 `None`을 반환하는 조회 함수와 그걸 401/403으로 바꾸는 함수의 분리 |
| `errors.py` | `AppError` 하나로 통일된 예외, 에러 코드 상수 | **왜 `return`이 아니라 `raise`인가** — 처리를 빼먹을 수 없게 만드는 설계 |
| `logging_utils.py` | `log_event()` — 필드명 블랙리스트 기반 로그 필터 | 화이트리스트가 아니라 블랙리스트를 쓴 이유(오탐은 감수, 누락은 절대 불가) |

### `app/models/` — 테이블 정의

| 파일 | 역할 | 핵심 개념 |
|---|---|---|
| `user.py` | `users` — username/email `unique=True` | 동시 가입 레이스의 최후 방어선 |
| `chat.py` | `chat_sessions` — `user_id` FK, `cascade="all, delete-orphan"` | 대화 삭제 시 메시지가 같은 트랜잭션에서 함께 삭제됨 |
| `message.py` | `messages` — `role`, `content`, `request_id`, `status`, `latency_ms` | `latency_ms`가 `nullable`인 이유(사용자 메시지엔 응답 생성 시간이 없음) |

### `app/services/` — 비즈니스 로직 + DB 접근

| 파일 | 역할 | 핵심 개념 |
|---|---|---|
| `auth.py` | 비밀번호 해시(PBKDF2), stateless 세션 토큰 서명/검증 | DB에 세션을 저장하지 않고도 로그아웃이 되는 이유; `hmac.compare_digest`로 타이밍 공격 방지 |
| `users.py` | `users` 테이블에 쿼리를 날리는 **유일한** 모듈 | 가입 레이스 컨디션 처리: 사전 체크 + `IntegrityError` 캐치 + 재조회 |
| `context.py` | 최근 대화 문맥 조립(`build_messages`) | 2단계 필터 — 개수(최근 10개) 자르고, 그다음 최신순으로 6,000자 예산 채움 |
| `ai.py` | OpenRouter HTTP 클라이언트, 유일한 `await` 지점 | **비동기가 실제로 쓰이는 곳** — `httpx.AsyncClient`; fail-closed 가드 2개(모델 고정, API 키 필수); `"models"` 폴백 배열로 auto-router 오사고 방지 |
| `chat.py` | `handle_chat` — 검증 → rate limit → 문맥 조립 → AI 호출 → 저장 | "AI 호출 성공 후에만 DB에 쓴다" 순서; 사용자별 슬라이딩 윈도우 rate limiter(`_recent_requests`, in-process dict) |
| `admin.py` | 관리자용 결합 로그, `users`/`chat_sessions`/`messages` 전체 스냅샷 | `password_hash`를 응답 스키마에서 아예 제외(블랙리스트가 아니라 화이트리스트) |

### `app/routers/` — HTTP 경계

| 파일 | 역할 | 핵심 개념 |
|---|---|---|
| `auth.py` | 회원가입·로그인·로그아웃·`/me` | 타이밍 안전 로그인 — 존재하지 않는 계정도 더미 해시로 동일한 PBKDF2 연산을 거쳐 응답 시간 차이를 없앰 |
| `chat.py` | 질문·목록·상세·삭제 (4 라우트) | 라우터는 서비스 함수 호출과 응답 변환만 함 — DB 쿼리를 직접 하지 않는 계층 규칙 |
| `admin.py` | `/api/admin/logs`, `/api/admin/database` | `require_admin` 의존성 하나로 인증+권한 재사용; `Cache-Control: no-store, private`로 민감 응답 캐시 금지 |

### `app/schemas/` — Pydantic 요청/응답 모델

| 파일 | 역할 |
|---|---|
| `auth.py` | 회원가입/로그인 요청, `UserOut`(`is_admin`은 UI 표시용, 서버 신뢰 아님) |
| `chat.py` | 채팅 요청/응답, 대화 목록/상세 |
| `admin.py` | 관리자 로그·DB 스냅샷 응답 (`password_hash` 필드 자체가 없음) |

## 프론트엔드 (`frontend/src/`)

| 파일 | 역할 | 핵심 개념 |
|---|---|---|
| `main.tsx` | React 진입점, `StrictMode` + `BrowserRouter` | `StrictMode`가 effect를 두 번 실행하는 것이 `ChatPage`의 중복 전송 버그(#13)와 왜 관련 있었는지 |
| `App.tsx` | 라우트 정의 (`/`, `/login`, `/register`, `/chat`, `/admin`) | `ProtectedRoute`로 감싸는 경로와 아닌 경로 |
| `auth/AuthContext.tsx` | 서버 세션 기준 전역 인증 상태 (`useAuth`) | 클라이언트 상태가 아니라 매번 `/api/auth/me`로 서버에 확인하는 "서버가 진실의 원천" 패턴 |
| `components/ProtectedRoute.tsx` | 미인증 접근을 `/login?next=...`로 리다이렉트 | `next` 파라미터는 고정 허용목록(`/chat`, `/admin`)만 통과 — open redirect 방지 |
| `components/QuestionComposer.tsx` | 질문 입력 textarea | — |
| `components/ConversationView.tsx` | 메시지 목록 렌더링, 새 답변 스크롤 | — |
| `components/HistoryRail.tsx` | 날짜별로 묶은 대화 목록 사이드바 | — |
| `components/ConfirmDialog.tsx` | 삭제 확인창 (focus trap, Escape) | — |
| `pages/LandingPage.tsx` | 비로그인 첫 화면, 질문 초안 입력 | 질문을 URL이 아닌 Router `state`로 넘겨 로그인 후 이어받음(#13) |
| `pages/LoginPage.tsx` / `RegisterPage.tsx` | 로그인/가입 폼 | — |
| `pages/ChatPage.tsx` | 채팅 화면 — 질문 전송, 문맥 표시, 기록 목록/삭제 | 로그인 전 대기 질문 자동 전송(ref로 StrictMode 재실행 방어); `submitQuestion`의 성공/실패 분기별 화면 상태 |
| `pages/AdminPage.tsx` | `/admin` — users/sessions/messages 탭, 검색, 새로고침 | 실제 권한은 서버가 매 요청 재검사(`require_admin`) — 프론트의 `is_admin`은 메뉴 표시용일 뿐 |
| `api/client.ts` | fetch 래퍼, 서버 응답을 검증하며 타입으로 변환 | 응답의 각 필드를 `requireString`/`requireNumber` 등으로 런타임 검증 — 서버가 계약을 어겨도 화면이 깨지지 않게 함 |
| `lib/navigationState.ts` | 로그인 후 이동 경로 검증(`readSafeNextPath`) | 허용목록 방식 리다이렉트 검증 |
| `lib/errorMessages.ts` | 서버 `error_code` → 한국어 문구 매핑 | — |
| `lib/dateTime.ts` | 시간대 없는 서버 UTC 문자열 파싱 | — |
| `lib/useDocumentTitle.ts` | 화면별 브라우저 탭 제목 설정 | — |
| `types.ts` | 화면 전역 타입(camelCase) — 서버 응답(snake_case)과 분리 | — |

## 테스트

| 위치 | 무엇을 검증하나 |
|---|---|
| `tests/test_auth.py` | 가입/로그인/로그아웃, 가입 레이스, 타이밍 안전 로그인 |
| `tests/test_chat.py` | 검증, AI 1회 호출 규칙, 문맥 전달, 소유권, rate limit |
| `tests/test_ai.py` | OpenRouter 타임아웃/429/오류 분기, AI 실패 시 DB에 아무것도 안 남는지 |
| `tests/test_admin.py` | 401/403/200 권한 3단계, `password_hash` 미노출, 캐시 금지 헤더 |
| `tests/test_operations.py` | 로그 필드 블랙리스트 필터 동작 |
| `tests/test_config.py` | 운영 환경 + 기본 `SECRET_KEY` 조합이 기동을 거부하는지 (subprocess로 import) |
| `tests/test_health.py`, `test_spa.py` | `/health`, SPA 폴백 |
| `frontend/src/**/*.test.tsx` | 컴포넌트별 — 전체 목록과 각 파일이 다루는 시나리오는 `docs/TESTING.md` 참고 |

## 의존성 — 왜 이것만 썼는가

### 백엔드 (`requirements.txt`)

| 패키지 | 역할 |
|---|---|
| `fastapi` | 라우터, `Depends()` 의존성 주입, Pydantic 통합 |
| `uvicorn` | ASGI 서버 |
| `sqlalchemy` | ORM, 동기(sync) 세션 |
| `httpx` | OpenRouter 호출용 **비동기** HTTP 클라이언트 — 이 프로젝트에서 `async def`가 필요한 유일한 실제 이유 |
| `python-dotenv` | `.env` 로컬 로드 |
| `email-validator` | 가입 시 이메일 형식 검증 (Pydantic `EmailStr`) |

`requirements-dev.txt`는 여기에 `pytest`, `pytest-asyncio`만 더한다.
비밀번호 해시(PBKDF2), 세션 서명(HMAC)은 전용 라이브러리 없이 stdlib
(`hashlib`, `hmac`)만 쓴다 — 새 의존성을 추가하기 전에 stdlib으로 되는지
먼저 확인하는 원칙 때문. Alembic 같은 마이그레이션 도구, Redis, Postgres는
이 프로젝트 규모(단일 SQLite 파일, 단일 프로세스)에서 아직 필요하지 않다.

### 프론트엔드 (`frontend/package.json`)

| 패키지 | 역할 |
|---|---|
| `react`, `react-dom` | UI 렌더링 |
| `react-router-dom` | 클라이언트 라우팅, `useLocation`/`Navigate` |
| `vite` | 개발 서버·빌드 |
| `vitest`, `@testing-library/react`, `jsdom` | 컴포넌트 테스트 |
| `typescript` | 타입 검사 |

상태 관리 라이브러리(Redux, Zustand 등)는 쓰지 않는다 — 인증은
`AuthContext` 하나, 화면별 상태는 각 페이지의 `useState`로 충분한
규모라서.

## 배포/설정 파일

| 파일 | 역할 |
|---|---|
| `Dockerfile` | Node로 React 빌드 → Python 이미지에 복사, `uvicorn`으로 API+정적 파일 함께 서빙 (Render가 Python+Node 혼합 빌드를 기본 지원하지 않아서 필요) |
| `render.yaml` | Render 서비스 정의, 환경변수 목록 (`ADMIN_USERNAMES` 포함) |
| `.env.example` | 로컬/배포에 필요한 환경변수 이름과 안전한 기본값만 (`docs/RENDER_DEPLOY.md`에 배포 설정 절차) |
| `frontend/vite.config.ts` | 빌드 설정, 개발 서버 프록시 |
