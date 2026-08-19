// 화면과 API 사이에서 사용할 데이터 타입을 불러온다.
import type {
    AdminDatabase,
    AdminMessage,
    AdminSession,
    AdminUser,
    ChatDetail,
    ChatMessage,
    ChatSendResult,
    ChatSession,
    LoginInput,
    RegisterInput,
    User,
} from "../types";
// 서버 오류 코드를 안전한 사용자 문장으로 바꾸는 함수를 불러온다.
import { getErrorMessage } from "../lib/errorMessages";

// API 응답 객체를 안전하게 검사할 때 사용할 공통 타입이다.
type JsonRecord = Record<string, unknown>;

// 화면에서 구분할 수 있는 API 오류 클래스를 만든다.
export class ApiRequestError extends Error {
    // 서버 또는 프론트가 정한 오류 코드를 보관한다.
    readonly code: string;
    // 응답 상태 코드를 알 수 있을 때 함께 보관한다.
    readonly status: number | null;

    // 오류 코드와 상태 코드로 안전한 오류 객체를 만든다.
    constructor(code: string, status: number | null = null) {
        // 원시 서버 문장 대신 검증된 한국어 문장을 부모 Error에 전달한다.
        super(getErrorMessage(code));
        // 개발 도구에서 클래스 이름을 구분할 수 있게 한다.
        this.name = "ApiRequestError";
        // 화면 분기에서 사용할 오류 코드를 저장한다.
        this.code = code;
        // 인증 오류 같은 HTTP 상태를 판단할 수 있게 저장한다.
        this.status = status;
    }
}

// 알 수 없는 값이 배열이 아닌 일반 객체인지 확인한다.
function isRecord(value: unknown): value is JsonRecord {
    // null과 배열을 제외한 객체만 JSON 객체로 인정한다.
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 필요한 값이 문자열인지 확인하고 아니면 안전하게 실패시킨다.
function requireString(value: unknown): string {
    // 실제 문자열이면 원문을 반환한다.
    if (typeof value === "string") {
        // 검증된 문자열만 다음 처리로 전달한다.
        return value;
    }

    // 잘못된 API 응답을 내부 오류로 통일한다.
    throw new ApiRequestError("INTERNAL_ERROR");
}

// 필요한 값이 유효한 숫자인지 확인하고 아니면 안전하게 실패시킨다.
function requireNumber(value: unknown): number {
    // NaN이나 무한대가 아닌 숫자만 허용한다.
    if (typeof value === "number" && Number.isFinite(value)) {
        // 검증된 숫자만 다음 처리로 전달한다.
        return value;
    }

    // 잘못된 API 응답을 내부 오류로 통일한다.
    throw new ApiRequestError("INTERNAL_ERROR");
}

// 필요한 값이 불리언인지 확인하고 아니면 안전하게 실패시킨다.
function requireBoolean(value: unknown): boolean {
    // 실제 true 또는 false만 허용한다.
    if (typeof value === "boolean") {
        // 검증된 불리언을 반환한다.
        return value;
    }

    // 잘못된 API 응답을 내부 오류로 통일한다.
    throw new ApiRequestError("INTERNAL_ERROR");
}

// 지연 시간처럼 숫자 또는 null인 값을 안전하게 확인한다.
function requireNullableNumber(value: unknown): number | null {
    // null은 값이 저장되지 않았다는 정상 상태로 허용한다.
    if (value === null) {
        // 화면이 빈 지연 시간으로 표시할 null을 반환한다.
        return null;
    }

    // null이 아니면 일반 숫자 검사 함수를 재사용한다.
    return requireNumber(value);
}

// 필요한 값이 JSON 객체인지 확인하고 아니면 안전하게 실패시킨다.
function requireRecord(value: unknown): JsonRecord {
    // 배열이 아닌 객체면 그대로 반환한다.
    if (isRecord(value)) {
        // 검증된 객체만 다음 처리로 전달한다.
        return value;
    }

    // HTML 오류 페이지나 예상 밖 형식을 내부 오류로 처리한다.
    throw new ApiRequestError("INTERNAL_ERROR");
}

// HTTP 상태와 응답 본문에서 가장 신뢰할 수 있는 오류 코드를 찾는다.
function readErrorCode(body: unknown, status: number): string {
    // JSON 객체 응답인지 먼저 확인한다.
    if (isRecord(body)) {
        // 백엔드가 확정한 error_code 문자열을 가장 먼저 사용한다.
        if (typeof body.error_code === "string") {
            // 원시 메시지는 버리고 코드만 반환한다.
            return body.error_code;
        }

        // 향후 호환을 위해 중첩 error 객체도 안전하게 확인한다.
        if (isRecord(body.error) && typeof body.error.code === "string") {
            // 중첩 객체에서도 코드만 꺼내 반환한다.
            return body.error.code;
        }
    }

    // 로그인 세션이 없거나 만료된 응답을 인증 오류로 바꾼다.
    if (status === 401) {
        // 화면이 로그인 페이지로 이동할 수 있는 코드를 반환한다.
        return "AUTH_REQUIRED";
    }

    // FastAPI가 기본 형식으로 반환하는 입력 검증 오류를 구분한다.
    if (status === 422) {
        // 상세 스키마 내용을 노출하지 않는 검증 오류 코드를 반환한다.
        return "VALIDATION_ERROR";
    }

    // 존재하지 않는 대화나 경로는 동일한 안전 문장으로 처리한다.
    if (status === 404) {
        // 리소스 존재 여부를 더 자세히 노출하지 않는다.
        return "NOT_FOUND";
    }

    // 나머지 형식 불일치 오류는 일반 내부 오류로 처리한다.
    return "INTERNAL_ERROR";
}

// fetch를 한 곳에서 실행해 쿠키와 오류 처리를 항상 동일하게 적용한다.
async function requestJson(path: string, options: RequestInit = {}): Promise<unknown> {
    // 요청 본문 유무에 따라 필요한 기본 헤더를 준비한다.
    const headers = new Headers(options.headers);
    // 서버에서 JSON 응답을 받고 싶다는 뜻을 명시한다.
    headers.set("Accept", "application/json");

    // JSON 본문이 있을 때만 Content-Type을 지정한다.
    if (options.body !== undefined) {
        // FastAPI가 요청 본문을 JSON으로 해석하게 한다.
        headers.set("Content-Type", "application/json");
    }

    // 네트워크 실패도 사용자가 이해할 수 있는 오류로 바꾸기 위해 감싼다.
    try {
        // 같은 출처의 FastAPI API로 한 번만 요청을 보낸다.
        const response = await fetch(path, {
            // 호출하는 기능이 지정한 method와 body를 유지한다.
            ...options,
            // 인증과 대화 응답이 브라우저의 일반 cache에 남지 않게 한다.
            cache: "no-store",
            // 서버의 HttpOnly 세션 쿠키가 요청에 포함되게 한다.
            credentials: "include",
            // 위에서 안전하게 만든 헤더를 적용한다.
            headers,
        });

        // 204 응답처럼 본문이 없어도 실패하지 않게 JSON 변환을 시도한다.
        const body: unknown = await response.json().catch(() => null);

        // 200번대가 아니면 오류 코드를 읽어 안전한 오류를 던진다.
        if (!response.ok) {
            // 서버 형식과 HTTP 상태를 함께 사용해 코드를 정한다.
            throw new ApiRequestError(readErrorCode(body, response.status), response.status);
        }

        // 성공 응답의 JSON 값을 호출한 기능으로 전달한다.
        return body;
    } catch (error: unknown) {
        // 이미 정리한 API 오류는 그대로 위로 전달한다.
        if (error instanceof ApiRequestError) {
            // 오류 코드를 잃지 않도록 같은 객체를 다시 던진다.
            throw error;
        }

        // fetch 자체 실패나 JSON 처리 실패는 네트워크 오류로 숨긴다.
        throw new ApiRequestError("NETWORK_ERROR");
    }
}

// 서버 사용자 응답을 화면 타입으로 바꾼다.
function normalizeUser(value: unknown): User {
    // 사용자 객체의 필드를 읽을 수 있도록 먼저 검증한다.
    const user = requireRecord(value);
    // snake_case 서버 필드를 읽기 쉬운 camelCase 타입으로 변환한다.
    return {
        // 사용자 번호를 숫자로 검증한다.
        id: requireNumber(user.id),
        // 사용자 이름을 문자열로 검증한다.
        username: requireString(user.username),
        // 이메일 주소를 문자열로 검증한다.
        email: requireString(user.email),
        // 서버 생성 시각을 문자열로 검증한다.
        createdAt: requireString(user.created_at),
        // 서버가 판정한 관리자 메뉴 표시값을 검증한다.
        isAdmin: requireBoolean(user.is_admin),
    };
}

// 관리자 users 응답 한 행을 화면 타입으로 바꾼다.
function normalizeAdminUser(value: unknown): AdminUser {
    // 사용자 행의 필드를 읽을 수 있도록 객체인지 확인한다.
    const user = requireRecord(value);
    // snake_case 서버 필드를 화면의 camelCase 타입으로 변환한다.
    return {
        // 사용자 기본키를 숫자로 검증한다.
        id: requireNumber(user.id),
        // 사용자 이름을 문자열로 검증한다.
        username: requireString(user.username),
        // 이메일을 문자열로 검증한다.
        email: requireString(user.email),
        // 계정 생성 시각을 문자열로 검증한다.
        createdAt: requireString(user.created_at),
    };
}

// 관리자 chat_sessions 응답 한 행을 화면 타입으로 바꾼다.
function normalizeAdminSession(value: unknown): AdminSession {
    // 대화방 행의 필드를 읽을 수 있도록 객체인지 확인한다.
    const session = requireRecord(value);
    // 서버 필드를 화면의 camelCase 타입으로 변환한다.
    return {
        // 대화방 기본키를 숫자로 검증한다.
        id: requireNumber(session.id),
        // 소유 사용자 기본키를 숫자로 검증한다.
        userId: requireNumber(session.user_id),
        // 대화 제목을 문자열로 검증한다.
        title: requireString(session.title),
        // 대화 생성 시각을 문자열로 검증한다.
        createdAt: requireString(session.created_at),
        // 대화 갱신 시각을 문자열로 검증한다.
        updatedAt: requireString(session.updated_at),
    };
}

// 관리자 messages 응답 한 행을 화면 타입으로 바꾼다.
function normalizeAdminMessage(value: unknown): AdminMessage {
    // 메시지 행의 필드를 읽을 수 있도록 객체인지 확인한다.
    const message = requireRecord(value);
    // role 원문을 문자열로 확인한다.
    const role = requireString(message.role);

    // 현재 DB 계약의 사용자와 AI 역할만 화면에 허용한다.
    if (role !== "user" && role !== "assistant") {
        // 알 수 없는 역할은 내부 응답 오류로 막는다.
        throw new ApiRequestError("INTERNAL_ERROR");
    }

    // 검증된 필드를 관리자 메시지 타입으로 변환한다.
    return {
        // 메시지 기본키를 숫자로 검증한다.
        id: requireNumber(message.id),
        // 소속 대화방 기본키를 숫자로 검증한다.
        sessionId: requireNumber(message.session_id),
        // 허용된 역할만 저장한다.
        role,
        // 질문 또는 답변 원문을 문자열로 검증한다.
        content: requireString(message.content),
        // 요청 추적 번호를 문자열로 검증한다.
        requestId: requireString(message.request_id),
        // 저장 상태를 문자열로 검증한다.
        status: requireString(message.status),
        // 지연 시간을 숫자 또는 null로 검증한다.
        latencyMs: requireNullableNumber(message.latency_ms),
        // 메시지 생성 시각을 문자열로 검증한다.
        createdAt: requireString(message.created_at),
    };
}

// 서버 대화 요약을 화면 타입으로 바꾼다.
function normalizeSession(value: unknown): ChatSession {
    // 대화 객체의 필드를 읽을 수 있도록 먼저 검증한다.
    const session = requireRecord(value);
    // snake_case 서버 필드를 읽기 쉬운 camelCase 타입으로 변환한다.
    return {
        // 대화 번호를 숫자로 검증한다.
        id: requireNumber(session.id),
        // 서버가 만든 대화 제목을 문자열로 검증한다.
        title: requireString(session.title),
        // 대화 생성 시각을 문자열로 검증한다.
        createdAt: requireString(session.created_at),
        // 대화 갱신 시각을 문자열로 검증한다.
        updatedAt: requireString(session.updated_at),
    };
}

// 서버 메시지를 화면 타입으로 바꾼다.
function normalizeMessage(value: unknown): ChatMessage {
    // 메시지 객체의 필드를 읽을 수 있도록 먼저 검증한다.
    const message = requireRecord(value);
    // 서버가 보낸 role 값을 문자열로 확인한다.
    const role = requireString(message.role);

    // 사용자와 AI 이외의 역할은 화면에 표시하지 않는다.
    if (role !== "user" && role !== "assistant") {
        // 예상 밖 역할을 내부 오류로 처리한다.
        throw new ApiRequestError("INTERNAL_ERROR");
    }

    // 검증이 끝난 메시지 필드를 화면 타입으로 변환한다.
    return {
        // 메시지 번호를 숫자로 검증한다.
        id: requireNumber(message.id),
        // 허용된 작성자 역할만 저장한다.
        role,
        // 질문 또는 답변 원문을 문자열로 검증한다.
        content: requireString(message.content),
        // 메시지 생성 시각을 문자열로 검증한다.
        createdAt: requireString(message.created_at),
    };
}

// 회원가입 요청을 보내고 서버가 만든 사용자 정보를 반환한다.
export async function register(input: RegisterInput): Promise<User> {
    // 백엔드 계약에 맞는 세 필드만 JSON으로 보낸다.
    const body = await requestJson("/api/auth/register", {
        // 데이터를 새로 만드는 POST 요청을 사용한다.
        method: "POST",
        // 비밀번호를 저장하지 않고 현재 요청 본문에만 넣는다.
        body: JSON.stringify(input),
    });
    // 응답 최상위 객체를 검증한다.
    const response = requireRecord(body);
    // 서버가 반환한 사용자 정보를 화면 타입으로 바꾼다.
    return normalizeUser(response.user);
}

// 로그인 요청을 보내고 현재 사용자 정보를 반환한다.
export async function login(input: LoginInput): Promise<User> {
    // 백엔드가 실제 지원하는 username과 password만 보낸다.
    const body = await requestJson("/api/auth/login", {
        // 세션 쿠키를 새로 받는 POST 요청을 사용한다.
        method: "POST",
        // 비밀번호를 브라우저 저장소에 남기지 않고 요청에만 넣는다.
        body: JSON.stringify(input),
    });
    // 응답 최상위 객체를 검증한다.
    const response = requireRecord(body);
    // 로그인한 사용자 정보를 화면 타입으로 바꾼다.
    return normalizeUser(response.user);
}

// 서버 쿠키를 기준으로 현재 로그인 사용자를 조회한다.
export async function getCurrentUser(): Promise<User> {
    // 인증 상태를 바꾸지 않는 GET 요청을 보낸다.
    const body = await requestJson("/api/auth/me");
    // 응답 최상위 객체를 검증한다.
    const response = requireRecord(body);
    // 현재 사용자 정보를 화면 타입으로 바꾼다.
    return normalizeUser(response.user);
}

// 서버 세션 쿠키를 삭제하는 로그아웃 요청을 보낸다.
export async function logout(): Promise<void> {
    // 브라우저에 저장된 인증 쿠키를 서버가 삭제하게 요청한다.
    await requestJson("/api/auth/logout", {
        // 상태를 변경하는 POST 요청을 사용한다.
        method: "POST",
    });
}

// 로그인 사용자의 전체 대화 목록을 조회한다.
export async function getChatSessions(): Promise<ChatSession[]> {
    // 기록을 만들거나 AI를 호출하지 않는 GET 요청을 보낸다.
    const body = await requestJson("/api/chats");
    // 응답 최상위 객체를 검증한다.
    const response = requireRecord(body);

    // sessions 필드가 배열인지 확인한다.
    if (!Array.isArray(response.sessions)) {
        // 예상 밖 응답을 내부 오류로 처리한다.
        throw new ApiRequestError("INTERNAL_ERROR");
    }

    // 각 서버 대화를 화면에서 사용할 타입으로 변환한다.
    return response.sessions.map(normalizeSession);
}

// 선택한 대화의 저장된 질문과 답변을 조회한다.
export async function getChatSession(sessionId: number): Promise<ChatDetail> {
    // 숫자로 검증된 대화 번호만 URL에 넣어 조회한다.
    const body = await requestJson(`/api/chats/${encodeURIComponent(String(sessionId))}`);
    // 응답 최상위 객체를 검증한다.
    const response = requireRecord(body);

    // messages 필드가 배열인지 확인한다.
    if (!Array.isArray(response.messages)) {
        // 예상 밖 응답을 내부 오류로 처리한다.
        throw new ApiRequestError("INTERNAL_ERROR");
    }

    // 대화 정보와 메시지 목록을 함께 화면 타입으로 바꾼다.
    return {
        // 서버 대화 요약을 화면 타입으로 변환한다.
        session: normalizeSession(response.session),
        // 질문과 답변을 순서대로 화면 타입으로 변환한다.
        messages: response.messages.map(normalizeMessage),
    };
}

// 새 질문 또는 후속 질문을 서버에 한 번만 전송한다.
export async function sendChatMessage(
    sessionId: number | null,
    message: string,
): Promise<ChatSendResult> {
    // 정확히 한 번의 채팅 POST 요청을 보내며 자동 재시도하지 않는다.
    const body = await requestJson("/api/chat", {
        // AI 답변을 새로 만드는 POST 요청을 사용한다.
        method: "POST",
        // 기존 대화 번호와 사용자가 확인한 질문만 JSON으로 보낸다.
        body: JSON.stringify({ session_id: sessionId, message }),
    });
    // 응답 최상위 객체를 검증한다.
    const response = requireRecord(body);
    // 새 대화 번호와 AI 답변을 화면 타입으로 변환한다.
    return {
        // 서버가 반환한 대화 번호를 숫자로 검증한다.
        sessionId: requireNumber(response.session_id),
        // 서버가 저장한 AI 답변을 화면 타입으로 바꾼다.
        message: normalizeMessage(response.message),
    };
}

// 사용자가 확인한 대화 한 건을 서버에서 삭제한다.
export async function deleteChatSession(sessionId: number): Promise<void> {
    // 숫자로 검증된 대화 번호만 URL에 넣는다.
    const path = `/api/chats/${encodeURIComponent(String(sessionId))}`;
    // AI 호출 없이 삭제 API를 한 번 요청한다.
    await requestJson(path, {
        // 서버 기록을 지우는 DELETE 요청을 사용한다.
        method: "DELETE",
    });
}

// 관리자가 SQLite의 안전한 전체 업무 데이터를 조회한다.
export async function getAdminDatabase(): Promise<AdminDatabase> {
    // AI 호출이나 데이터 변경이 없는 관리자 GET 요청을 보낸다.
    const body = await requestJson("/api/admin/database");
    // 응답 최상위 값이 객체인지 확인한다.
    const response = requireRecord(body);

    // 세 테이블이 모두 배열로 제공됐는지 확인한다.
    if (
        // users가 배열이 아니면 잘못된 응답이다.
        !Array.isArray(response.users)
        // chat_sessions가 배열이 아니면 잘못된 응답이다.
        || !Array.isArray(response.sessions)
        // messages가 배열이 아니면 잘못된 응답이다.
        || !Array.isArray(response.messages)
    ) {
        // 일부 테이블이 누락된 응답을 화면에 표시하지 않는다.
        throw new ApiRequestError("INTERNAL_ERROR");
    }

    // 각 테이블 행을 검증된 화면 타입으로 변환한다.
    return {
        // users 전체 행을 안전한 사용자 타입으로 변환한다.
        users: response.users.map(normalizeAdminUser),
        // chat_sessions 전체 행을 안전한 대화방 타입으로 변환한다.
        sessions: response.sessions.map(normalizeAdminSession),
        // messages 전체 행을 안전한 메시지 타입으로 변환한다.
        messages: response.messages.map(normalizeAdminMessage),
    };
}
