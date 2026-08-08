# 🟩 EVERYTHING 프론트엔드

## 🟢 1. 역할

`frontend/`는 EVERYTHING의 React(TypeScript) + Vite 프론트엔드다.

- 랜딩 페이지
- 로그인과 회원가입
- 로그인 사용자만 접근하는 채팅
- 질문 입력과 AI 답변 표시
- 대화 기록 조회와 삭제
- 로딩, 오류, 빈 상태
- 375px, 768px, 1440px 반응형 구조
- 키보드와 보조기술을 고려한 접근성

OpenRouter API는 브라우저에서 직접 호출하지 않는다. 모든 AI 요청은 FastAPI의 `POST /api/chat`을 통해서만 실행한다.

<br><br>

## 🟢 2. 화면 경로

| 경로 | 화면 | 접근 조건 |
| --- | --- | --- |
| `/` | 질문 중심 랜딩 | 모두 |
| `/login` | 로그인 | 비로그인 |
| `/register` | 회원가입 | 비로그인 |
| `/chat` | 채팅과 기록 | 로그인 |

앱 시작 시 `GET /api/auth/me`로 서버의 HttpOnly 세션 쿠키를 확인한다. React 상태만으로 실제 인증 권한을 결정하지 않는다.

<br><br>

## 🟢 3. 개발 실행

### 🟡 3.1. 실행 도구 확인

- Node.js 24 이상
- npm 11 이상
- 현재 검증 환경: Node.js `v24.16.0`, npm `11.13.0`

```bash
node --version
npm --version
```

- `node --version`
    - 설치된 Node.js 버전을 확인한다.
- `npm --version`
    - 패키지 설치와 실행에 사용할 npm 버전을 확인한다.

### 🟡 3.2. 프론트엔드 패키지 설치

```bash
cd frontend
npm install
```

- `cd frontend`
    - 프론트엔드 전용 폴더로 이동한다.
- `npm install`
    - `package-lock.json`에 고정된 버전으로 React, Vite, 테스트 도구를 설치한다.
    - 실제 `.env`나 API Key를 만들지 않는다.

### 🟡 3.3. FastAPI 실행

저장소 루트에서 백엔드 팀이 정한 명령으로 FastAPI를 `127.0.0.1:8000`에 실행한다.

Vite 개발 서버는 아래 요청을 FastAPI로 전달한다.

- `/api/*`
- `/health`

이 프록시는 브라우저가 `5173`과 `8000`의 서로 다른 출처를 직접 호출하지 않게 한다. 세션 쿠키를 사용하는 개발 환경에서 별도 CORS 우회를 만들지 않는다.

### 🟡 3.4. Vite 실행

```bash
cd frontend
npm run dev
```

- `npm run dev`
    - React 개발 서버를 실행한다.
    - 기본 접속 주소는 Vite가 터미널에 표시한다.
    - 코드 변경을 브라우저에 빠르게 반영한다.

<br><br>

## 🟢 4. 검사 명령

```bash
cd frontend
npm run typecheck
npm test
npm run build
```

- `npm run typecheck`
    - TypeScript가 데이터 타입과 함수 사용을 검사한다.
    - Vite는 변환만 수행하므로 별도의 타입 검사가 필요하다.
- `npm test`
    - Vitest와 jsdom으로 입력, 오류, API 요청, 텍스트 렌더링을 검사한다.
    - OpenRouter를 호출하지 않는다.
- `npm run build`
    - TypeScript 검사를 먼저 실행한다.
    - 통과하면 운영용 정적 파일을 `frontend/dist/`에 만든다.

최종 검증에서는 테스트 파일 9개와 테스트 35개가 모두 통과했다. 인증·채팅 API 계약, 세션 경쟁 조건, Router 전환, 화면 이탈 뒤 늦은 응답, 인증 만료 시 질문 보존, XSS 기본 escape, 날짜 해석을 포함한다.

<br><br>

## 🟢 5. 실제 백엔드 API 계약

프론트 구현은 `origin/feature/core-backend-ai`의 실제 스키마와 라우터를 확인해 아래 형식에 맞췄다.

### 🟡 5.1. 인증

| Method | 경로 | 요청 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | `{ username, email, password }` |
| `POST` | `/api/auth/login` | `{ username, password }` |
| `POST` | `/api/auth/logout` | 본문 없음 |
| `GET` | `/api/auth/me` | 본문 없음 |

- 로그인은 현재 백엔드 구현상 이메일이 아니라 `username`을 사용한다.
- 회원가입의 사용자 이름은 3자 이상 50자 이하다.
- 회원가입의 비밀번호는 8자 이상 200자 이하다.
- 회원가입과 로그인 성공 시 서버가 HttpOnly 세션 쿠키를 설정한다.
- 브라우저 JavaScript는 세션 쿠키를 직접 읽지 않는다.

### 🟡 5.2. 채팅과 기록

| Method | 경로 | 역할 |
| --- | --- | --- |
| `POST` | `/api/chat` | 새 질문 또는 후속 질문 1회 전송 |
| `GET` | `/api/chats` | 내 대화 목록 조회 |
| `GET` | `/api/chats/{session_id}` | 선택 대화 조회 |
| `DELETE` | `/api/chats/{session_id}` | 확인한 대화 삭제 |

질문 요청 형식은 아래와 같다.

```json
{
    "session_id": null,
    "message": "블랙홀이 뭐야?"
}
```

- `session_id: null`
    - 새 대화를 만든다.
- `session_id: number`
    - 기존 대화에 후속 질문을 보낸다.
- `message`
    - 공백 질문을 허용하지 않는다.
    - 최대 2,000자다.

<br><br>

## 🟢 6. 보안 설계

### 🟡 6.1. 민감정보

- `OPENROUTER_API_KEY`를 React 코드에 넣지 않는다.
- `VITE_OPENROUTER_API_KEY` 같은 환경 변수를 만들지 않는다.
- `VITE_` 변수는 운영 빌드에 공개될 수 있으므로 비밀값에 사용하지 않는다.
- 비밀번호를 `localStorage`, `sessionStorage`, URL, 로그에 저장하지 않는다.
- 세션 쿠키는 서버가 HttpOnly로 관리한다.
- 모든 API 요청은 `credentials: "include"`를 사용한다.
- 모든 인증·대화 fetch 요청은 `cache: "no-store"`를 사용한다.

### 🟡 6.2. 화면 출력

- 질문과 AI 답변은 React의 일반 텍스트 렌더링으로 표시한다.
- `dangerouslySetInnerHTML`을 사용하지 않는다.
- 안전한 Markdown 도구가 기존 프로젝트에 없으므로 MVP에서 Markdown HTML 변환을 추가하지 않았다.
- 서버의 원시 오류 메시지, stack trace, FastAPI `detail` 내용을 화면에 그대로 표시하지 않는다.

### 🟡 6.3. AI 호출 비용

- 질문 버튼 또는 Enter를 사용자가 직접 실행할 때만 `POST /api/chat`을 호출한다.
- 로그인 이동, 랜딩 예시 선택, 새 질문, 기록 열기, 기록 삭제는 AI를 호출하지 않는다.
- 자동 전송, prefetch, 자동 재시도, AI 제목 생성 요청을 사용하지 않는다.
- 전송 중 textarea와 버튼을 잠가 더블클릭과 Enter 반복을 차단한다.

<br><br>

## 🟢 7. 오류 처리

| 코드 | 화면 문장 |
| --- | --- |
| `EMPTY_INPUT` | 질문을 입력해주세요. |
| `INPUT_TOO_LONG` | 질문은 2,000자 이하로 입력해주세요. |
| `AUTH_REQUIRED` | 로그인 화면으로 이동 |
| `AI_TIMEOUT` | 답변을 가져오는 데 시간이 오래 걸리고 있습니다. 잠시 후 다시 시도해주세요. |
| `AI_RATE_LIMIT` | 오늘 사용할 수 있는 AI 요청이 일시적으로 제한되었습니다. |
| `AI_API_ERROR` | 현재 답변을 생성할 수 없습니다. 잠시 후 다시 시도해주세요. |
| `DB_SAVE_ERROR` | 대화를 저장하지 못했습니다. 질문을 확인한 뒤 다시 시도해주세요. |
| `INTERNAL_ERROR` | 예상하지 못한 문제가 발생했습니다. 잠시 후 다시 시도해주세요. |

FastAPI 기본 `422 { detail: [...] }` 응답은 원문을 노출하지 않고 `입력값을 다시 확인해주세요.`로 바꾼다.

<br><br>

## 🟢 8. 접근성

- 모든 입력에 실제 `label`을 연결했다.
- 오류는 색상만이 아니라 문장과 `role="alert"`로 표시한다.
- 로딩과 새 답변은 `role="status"` 또는 `aria-live`로 알린다.
- 모든 버튼은 키보드로 실행할 수 있다.
- focus 위치는 3px 외곽선으로 표시한다.
- 모바일 기록 drawer는 열림 상태, 닫기 버튼, 바깥 배경 닫기, Escape 닫기를 제공한다.
- 삭제 확인창은 `role="alertdialog"`, `aria-modal`, 안전한 취소 버튼 우선 focus를 사용한다.
- 움직임 축소 설정을 사용하면 transition과 부드러운 스크롤을 최소화한다.

<br><br>

## 🟢 9. 운영 배포 통합 조건

현재 백엔드 브랜치의 `/`, `/login`, `/register`, `/chat`는 Jinja 페이지가 점유하고 있다. React 운영 빌드 제공 방식은 아직 팀 공통 계약에 확정되지 않았다.

백엔드 또는 배포 담당과 아래 중 하나를 합의해야 한다.

- FastAPI가 `frontend/dist/`의 React 파일과 SPA fallback을 같은 origin에서 제공한다.
- reverse proxy가 React 정적 파일과 FastAPI `/api`를 같은 origin으로 연결한다.

필수 결과는 같다.

- `/`, `/login`, `/register`, `/chat` 직접 접근과 새로고침이 React 화면을 반환해야 한다.
- `/api/*`와 React 화면이 같은 origin의 세션 쿠키를 사용해야 한다.
- 운영 환경은 HTTPS를 사용해야 한다.
- 백엔드는 강한 `SECRET_KEY`와 `SESSION_HTTPS_ONLY=true`를 사용해야 한다.
- 백엔드는 상태 변경 API에 허용 origin 검증 또는 CSRF 방어를 추가해야 한다.
- 제공 계층은 CSP, `frame-ancestors`, `X-Content-Type-Options`, 민감 응답의 `Cache-Control: no-store`를 설정해야 한다.

프론트 브랜치에서는 팀 소유권을 지키기 위해 `app/main.py`, `app/routers/pages.py`, Jinja 템플릿을 수정하지 않았다.

<br><br>

## 🟢 10. 현재 확인된 백엔드 연동 주의점

- 현재 `feature/frontend-experience`에는 실행 가능한 백엔드가 아직 병합되지 않았다.
- AI 실패 시 실제 백엔드는 질문을 DB에 저장하지 않는다.
    - 프론트는 실패 질문을 입력칸에 복구해 사용자가 직접 다시 시도할 수 있게 했다.
- 후속 질문 저장 뒤 서버의 `chat_sessions.updated_at`이 갱신되지 않을 가능성이 있다.
    - 프론트는 답변 직후 현재 대화를 기록 맨 위에 놓지만, 새로고침 뒤 순서는 서버 결과를 따른다.
- 채팅과 기록 API에는 페이지네이션이 없다.
- FastAPI 기본 검증 오류는 문서의 공통 오류 객체가 아니라 `422 { detail: [...] }`로 반환될 수 있다.
    - 프론트는 원시 detail을 숨기고 안전한 검증 문장으로 바꾼다.
- SQLite 재조회 뒤 ISO 시각에서 UTC offset이나 `Z`가 사라질 수 있다.
    - 프론트는 시간대 없는 날짜·시각을 UTC로 보완해 오늘·어제 그룹과 표시 시각의 오차를 막는다.
    - 백엔드 API도 최종적으로 모든 시각에 UTC offset 또는 `Z`를 보장해야 한다.
- 이 항목들은 백엔드 소유 영역이므로 프론트 브랜치에서 임의로 수정하지 않았다.
