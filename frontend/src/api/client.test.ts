// 테스트마다 fetch mock을 정리할 Vitest 기능을 불러온다.
import { afterEach, describe, expect, it, vi } from "vitest";
// 실제 API 계층에서 인증과 채팅 기능을 모두 불러온다.
import {
    // 대화 삭제 요청 함수를 불러온다.
    deleteChatSession,
    // 선택한 대화 조회 함수를 불러온다.
    getChatSession,
    // 관리자 전체 DB 조회 함수를 불러온다.
    getAdminDatabase,
    // 대화 기록 목록 조회 함수를 불러온다.
    getChatSessions,
    // 현재 로그인 사용자 조회 함수를 불러온다.
    getCurrentUser,
    // 로그인 요청 함수를 불러온다.
    login,
    // 로그아웃 요청 함수를 불러온다.
    logout,
    // 회원가입 요청 함수를 불러온다.
    register,
    // 신규 질문과 후속 질문 전송 함수를 불러온다.
    sendChatMessage,
} from "./client";

// 테스트가 끝날 때 브라우저 전역 mock을 원래 상태로 되돌린다.
afterEach(() => {
    // 다른 테스트에 fetch mock이 남지 않게 정리한다.
    vi.unstubAllGlobals();
});

// 로그인 요청의 실제 payload와 안전한 오류 처리를 검사한다.
describe("API client", () => {
    // 서버 세션 쿠키를 포함하고 확정된 로그인 필드만 보내는지 확인한다.
    it("sends username login with cookie credentials", async () => {
        // 백엔드 계약과 같은 성공 응답을 준비한다.
        const responseBody = {
            // API 요청 성공 여부다.
            success: true,
            // 로그인 뒤 반환할 공개 사용자 정보다.
            user: {
                // 테스트 사용자 번호다.
                id: 1,
                // 테스트 사용자 이름이다.
                username: "reader",
                // 테스트 이메일 주소다.
                email: "reader@example.com",
                // 테스트 계정 생성 시각이다.
                created_at: "2026-08-08T10:00:00",
                // 일반 사용자이므로 관리자 메뉴를 표시하지 않는다.
                is_admin: false,
            },
        };
        // 실제 네트워크 대신 준비한 JSON 응답을 반환하는 mock을 만든다.
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(responseBody), {
                // 실제 성공 상태 코드와 같게 만든다.
                status: 200,
                // JSON 응답임을 헤더로 알린다.
                headers: { "Content-Type": "application/json" },
            }),
        );
        // 현재 테스트 동안만 전역 fetch를 mock으로 바꾼다.
        vi.stubGlobal("fetch", fetchMock);

        // 실제 로그인 함수를 테스트 입력으로 실행한다.
        const user = await login({ username: "reader", password: "password123" });

        // 화면 타입으로 바뀐 사용자 이름이 맞는지 확인한다.
        expect(user.username).toBe("reader");
        // fetch가 정확히 한 번만 호출됐는지 확인한다.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        // fetch 호출의 URL과 옵션을 꺼낸다.
        const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        // 확정된 로그인 endpoint를 호출했는지 확인한다.
        expect(path).toBe("/api/auth/login");
        // HttpOnly 세션 쿠키를 포함하도록 설정했는지 확인한다.
        expect(options.credentials).toBe("include");
        // 비밀번호 외의 불필요한 민감 필드를 보내지 않는지 확인한다.
        expect(JSON.parse(String(options.body))).toEqual({
            // 실제 백엔드가 지원하는 username 필드다.
            username: "reader",
            // 사용자가 입력한 비밀번호 필드다.
            password: "password123",
        });
    });

    // FastAPI 기본 422 detail이 원시로 노출되지 않는지 확인한다.
    it("maps an unstructured 422 response to a safe validation error", async () => {
        // 실제 FastAPI 기본 검증 오류와 비슷한 응답을 준비한다.
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ detail: [{ msg: "raw internal validation detail" }] }), {
                // FastAPI 검증 실패 상태 코드를 사용한다.
                status: 422,
                // JSON 응답임을 헤더로 알린다.
                headers: { "Content-Type": "application/json" },
            }),
        );
        // 현재 테스트 동안만 전역 fetch를 mock으로 바꾼다.
        vi.stubGlobal("fetch", fetchMock);

        // 로그인 실패가 안전한 API 오류로 반환되는지 검사한다.
        await expect(login({ username: "x", password: "short" })).rejects.toMatchObject({
            // 원시 detail 대신 검증 오류 코드만 노출해야 한다.
            code: "VALIDATION_ERROR",
            // 사용자에게는 안전한 한국어 문장만 보여야 한다.
            message: "입력값을 다시 확인해주세요.",
        });
    });

    // 회원가입이 확정된 세 필드만 서버에 보내는지 확인한다.
    it("sends the register contract without password confirmation", async () => {
        // 실제 회원가입 성공 응답과 같은 JSON을 준비한다.
        const responseBody = {
            // API 요청 성공 여부다.
            success: true,
            // 서버가 만든 공개 사용자 정보다.
            user: {
                // 테스트 사용자 번호다.
                id: 2,
                // 테스트 사용자 이름이다.
                username: "new-reader",
                // 테스트 사용자 이메일이다.
                email: "new-reader@example.com",
                // 테스트 계정 생성 시각이다.
                created_at: "2026-08-08T11:00:00",
                // 일반 사용자이므로 관리자 메뉴를 표시하지 않는다.
                is_admin: false,
            },
        };
        // 실제 네트워크 대신 회원가입 성공 응답을 반환한다.
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(responseBody), {
                // 실제 회원가입 성공 상태 코드를 사용한다.
                status: 201,
                // JSON 응답임을 헤더로 알린다.
                headers: { "Content-Type": "application/json" },
            }),
        );
        // 현재 테스트 동안만 전역 fetch를 바꾼다.
        vi.stubGlobal("fetch", fetchMock);

        // 프론트 전용 비밀번호 확인을 제외한 가입 값을 전송한다.
        const user = await register({
            // 실제 로그인에 사용할 사용자 이름이다.
            username: "new-reader",
            // 실제 계정 이메일이다.
            email: "new-reader@example.com",
            // 서버에서 해시 처리할 비밀번호다.
            password: "password123",
        });

        // 서버 사용자 응답이 화면 타입으로 바뀌었는지 확인한다.
        expect(user.createdAt).toBe("2026-08-08T11:00:00");
        // fetch 호출의 URL과 옵션을 꺼낸다.
        const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        // 확정된 회원가입 endpoint를 호출했는지 확인한다.
        expect(path).toBe("/api/auth/register");
        // 비밀번호 확인 같은 추가 필드를 보내지 않았는지 확인한다.
        expect(JSON.parse(String(options.body))).toEqual({
            // 서버 계약의 username 필드다.
            username: "new-reader",
            // 서버 계약의 email 필드다.
            email: "new-reader@example.com",
            // 서버 계약의 password 필드다.
            password: "password123",
        });
    });

    // 현재 사용자 조회와 로그아웃이 쿠키 기반 계약을 따르는지 확인한다.
    it("checks the current user and logs out with cookie credentials", async () => {
        // 두 인증 API가 차례대로 반환할 응답을 준비한다.
        const fetchMock = vi
            // 함수 호출 횟수를 확인할 mock을 만든다.
            .fn()
            // 첫 번째 현재 사용자 조회 응답을 준비한다.
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        // API 요청 성공 여부다.
                        success: true,
                        // 현재 로그인한 공개 사용자 정보다.
                        user: {
                            // 테스트 사용자 번호다.
                            id: 3,
                            // 테스트 사용자 이름이다.
                            username: "session-reader",
                            // 테스트 사용자 이메일이다.
                            email: "session-reader@example.com",
                            // 테스트 계정 생성 시각이다.
                            created_at: "2026-08-08T12:00:00",
                            // 관리자 계정 판정값을 함께 제공한다.
                            is_admin: true,
                        },
                    }),
                    {
                        // 정상 조회 상태 코드다.
                        status: 200,
                        // JSON 응답임을 헤더로 알린다.
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            // 두 번째 로그아웃 성공 응답을 준비한다.
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ success: true }), {
                    // 정상 로그아웃 상태 코드다.
                    status: 200,
                    // JSON 응답임을 헤더로 알린다.
                    headers: { "Content-Type": "application/json" },
                }),
            );
        // 현재 테스트 동안만 전역 fetch를 바꾼다.
        vi.stubGlobal("fetch", fetchMock);

        // HttpOnly 쿠키를 서버가 검증하도록 현재 사용자를 조회한다.
        const user = await getCurrentUser();
        // 서버가 쿠키를 지우도록 로그아웃을 실행한다.
        await logout();

        // 현재 사용자가 올바르게 변환됐는지 확인한다.
        expect(user.username).toBe("session-reader");
        // 서버 관리자 판정이 화면 타입에 반영됐는지 확인한다.
        expect(user.isAdmin).toBe(true);
        // 조회와 로그아웃이 각각 한 번씩 실행됐는지 확인한다.
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // 첫 번째 요청이 현재 사용자 endpoint인지 확인한다.
        expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/auth/me");
        // 두 번째 요청이 로그아웃 endpoint인지 확인한다.
        expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/logout");
        // 로그아웃이 서버 상태를 바꾸는 POST인지 확인한다.
        expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");
        // 두 요청 모두 세션 쿠키 포함 설정을 사용하는지 확인한다.
        expect((fetchMock.mock.calls[0]?.[1] as RequestInit).credentials).toBe("include");
    });

    // 신규 질문과 후속 질문이 같은 API를 정확한 대화 번호로 호출하는지 확인한다.
    it("sends one new question and one follow-up with the correct session ids", async () => {
        // 새 대화와 후속 대화 응답을 차례대로 반환할 mock을 만든다.
        const fetchMock = vi
            // 함수 호출 횟수를 추적할 mock을 만든다.
            .fn()
            // 첫 질문의 AI 답변을 준비한다.
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        // API 요청 성공 여부다.
                        success: true,
                        // 서버가 만든 새 대화 번호다.
                        session_id: 10,
                        // 서버가 저장한 AI 답변이다.
                        message: {
                            // 답변 번호다.
                            id: 101,
                            // AI 답변 역할이다.
                            role: "assistant",
                            // 첫 답변 내용이다.
                            content: "첫 답변",
                            // 첫 답변 생성 시각이다.
                            created_at: "2026-08-08T13:00:00",
                        },
                    }),
                    {
                        // 정상 채팅 상태 코드다.
                        status: 200,
                        // JSON 응답임을 헤더로 알린다.
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            // 후속 질문의 AI 답변을 준비한다.
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        // API 요청 성공 여부다.
                        success: true,
                        // 이어지는 대화 번호다.
                        session_id: 10,
                        // 서버가 저장한 두 번째 AI 답변이다.
                        message: {
                            // 두 번째 답변 번호다.
                            id: 103,
                            // AI 답변 역할이다.
                            role: "assistant",
                            // 두 번째 답변 내용이다.
                            content: "후속 답변",
                            // 두 번째 답변 생성 시각이다.
                            created_at: "2026-08-08T13:01:00",
                        },
                    }),
                    {
                        // 정상 채팅 상태 코드다.
                        status: 200,
                        // JSON 응답임을 헤더로 알린다.
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        // 현재 테스트 동안만 전역 fetch를 바꾼다.
        vi.stubGlobal("fetch", fetchMock);

        // session_id가 없는 첫 질문을 한 번 보낸다.
        const firstResult = await sendChatMessage(null, "첫 질문");
        // 같은 대화 번호로 후속 질문을 한 번 보낸다.
        const followUpResult = await sendChatMessage(10, "후속 질문");

        // 새 대화 번호가 올바르게 변환됐는지 확인한다.
        expect(firstResult.sessionId).toBe(10);
        // 후속 답변 내용이 올바르게 변환됐는지 확인한다.
        expect(followUpResult.message.content).toBe("후속 답변");
        // 사용자 질문 두 번만 API 요청으로 이어졌는지 확인한다.
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // 첫 질문 요청 본문이 새 대화를 뜻하는 null인지 확인한다.
        expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
            // 새 대화에는 기존 번호가 없다.
            session_id: null,
            // 사용자가 보낸 첫 질문이다.
            message: "첫 질문",
        });
        // 후속 질문 요청 본문이 기존 대화 번호를 포함하는지 확인한다.
        expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
            // 후속 질문이 이어질 대화 번호다.
            session_id: 10,
            // 사용자가 보낸 후속 질문이다.
            message: "후속 질문",
        });
    });

    // 기록 목록, 상세 조회, 삭제가 AI 요청 없이 확정 endpoint만 호출하는지 확인한다.
    it("loads and deletes history without calling the chat endpoint", async () => {
        // 공통으로 사용할 대화 요약 JSON을 준비한다.
        const session = {
            // 테스트 대화 번호다.
            id: 20,
            // 서버가 첫 질문에서 만든 제목이다.
            title: "테스트 대화",
            // 대화 생성 시각이다.
            created_at: "2026-08-08T14:00:00",
            // 대화 갱신 시각이다.
            updated_at: "2026-08-08T14:01:00",
        };
        // 기록 관련 세 응답을 차례대로 반환할 mock을 만든다.
        const fetchMock = vi
            // 함수 호출 횟수를 추적할 mock을 만든다.
            .fn()
            // 기록 목록 응답을 준비한다.
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ success: true, sessions: [session] }), {
                    // 정상 목록 조회 상태 코드다.
                    status: 200,
                    // JSON 응답임을 헤더로 알린다.
                    headers: { "Content-Type": "application/json" },
                }),
            )
            // 대화 상세 응답을 준비한다.
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        // API 요청 성공 여부다.
                        success: true,
                        // 조회한 대화 요약이다.
                        session,
                        // 저장된 질문 한 건이다.
                        messages: [
                            {
                                // 질문 번호다.
                                id: 201,
                                // 사용자 질문 역할이다.
                                role: "user",
                                // 저장된 질문 내용이다.
                                content: "저장된 질문",
                                // 질문 생성 시각이다.
                                created_at: "2026-08-08T14:00:00",
                            },
                        ],
                    }),
                    {
                        // 정상 상세 조회 상태 코드다.
                        status: 200,
                        // JSON 응답임을 헤더로 알린다.
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            // 대화 삭제 성공 응답을 준비한다.
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ success: true }), {
                    // 정상 삭제 상태 코드다.
                    status: 200,
                    // JSON 응답임을 헤더로 알린다.
                    headers: { "Content-Type": "application/json" },
                }),
            );
        // 현재 테스트 동안만 전역 fetch를 바꾼다.
        vi.stubGlobal("fetch", fetchMock);

        // 로그인 사용자의 기록 목록을 조회한다.
        const sessions = await getChatSessions();
        // 선택한 대화의 저장된 메시지를 조회한다.
        const detail = await getChatSession(20);
        // 사용자가 확인한 대화를 삭제한다.
        await deleteChatSession(20);

        // 목록 응답의 제목이 올바르게 변환됐는지 확인한다.
        expect(sessions[0]?.title).toBe("테스트 대화");
        // 상세 응답의 사용자 메시지가 올바르게 변환됐는지 확인한다.
        expect(detail.messages[0]?.role).toBe("user");
        // 세 요청이 기록 endpoint만 호출했는지 확인한다.
        expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
            // 기록 목록 endpoint다.
            "/api/chats",
            // 특정 대화 상세 endpoint다.
            "/api/chats/20",
            // 같은 대화 삭제 endpoint다.
            "/api/chats/20",
        ]);
        // 어떤 요청도 AI 답변 endpoint를 호출하지 않았는지 확인한다.
        expect(fetchMock.mock.calls.some((call) => call[0] === "/api/chat")).toBe(false);
        // 세 번째 요청이 실제 삭제 method인지 확인한다.
        expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe("DELETE");
    });

    // 인증 오류가 서버 문장 없이 화면 분기용 코드로 전달되는지 확인한다.
    it("preserves AUTH_REQUIRED while hiding the raw server message", async () => {
        // 실제 인증 만료 오류와 같은 응답을 반환할 mock을 만든다.
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    // API 요청 실패 여부다.
                    success: false,
                    // 프론트가 로그인 이동에 사용할 코드다.
                    error_code: "AUTH_REQUIRED",
                    // 화면에 노출하면 안 되는 서버 원문 예시다.
                    message: "authentication required raw server text",
                }),
                {
                    // 인증 실패 상태 코드다.
                    status: 401,
                    // JSON 응답임을 헤더로 알린다.
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );
        // 현재 테스트 동안만 전역 fetch를 바꾼다.
        vi.stubGlobal("fetch", fetchMock);

        // 현재 사용자 조회 실패가 안전한 인증 오류인지 검사한다.
        await expect(getCurrentUser()).rejects.toMatchObject({
            // 로그인 화면 이동에 필요한 코드다.
            code: "AUTH_REQUIRED",
            // 원시 영어 문장 대신 정해진 한국어 안내다.
            message: "로그인이 필요한 기능입니다.",
        });
    });

    // 관리자 DB 응답의 세 테이블을 화면 타입으로 안전하게 변환하는지 확인한다.
    it("normalizes the complete admin database response", async () => {
        // Backend 관리자 database API와 같은 응답을 준비한다.
        const responseBody = {
            // API 요청 성공 여부다.
            success: true,
            // password_hash가 없는 users 테이블 행이다.
            users: [
                {
                    // 사용자 DB 기본키다.
                    id: 1,
                    // 사용자 이름이다.
                    username: "admin-reader",
                    // 사용자 이메일이다.
                    email: "admin@example.com",
                    // 계정 생성 시각이다.
                    created_at: "2026-08-19T01:00:00Z",
                },
            ],
            // chat_sessions 테이블 행이다.
            sessions: [
                {
                    // 대화방 DB 기본키다.
                    id: 10,
                    // 소유 사용자 기본키다.
                    user_id: 1,
                    // 대화 제목이다.
                    title: "관리자 테스트",
                    // 대화 생성 시각이다.
                    created_at: "2026-08-19T01:01:00Z",
                    // 대화 갱신 시각이다.
                    updated_at: "2026-08-19T01:02:00Z",
                },
            ],
            // messages 테이블 행이다.
            messages: [
                {
                    // 메시지 DB 기본키다.
                    id: 100,
                    // 소속 대화방 기본키다.
                    session_id: 10,
                    // 사용자 질문 역할이다.
                    role: "user",
                    // 질문 원문이다.
                    content: "전체 데이터를 보여줘",
                    // 운영 로그 요청 번호다.
                    request_id: "request-admin-1",
                    // 메시지 저장 상태다.
                    status: "ok",
                    // 사용자 질문에는 AI 지연 시간이 없다.
                    latency_ms: null,
                    // 메시지 생성 시각이다.
                    created_at: "2026-08-19T01:01:30Z",
                },
            ],
        };
        // 실제 네트워크 대신 준비한 관리자 JSON을 반환한다.
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(responseBody), {
                // 정상 조회 상태 코드다.
                status: 200,
                // JSON 응답임을 알린다.
                headers: { "Content-Type": "application/json" },
            }),
        );
        // 현재 테스트 동안만 fetch를 관리자 응답 mock으로 바꾼다.
        vi.stubGlobal("fetch", fetchMock);

        // 관리자 전체 DB 조회 함수를 실행한다.
        const database = await getAdminDatabase();

        // 사용자 계정 생성 시각이 camelCase로 변환됐는지 확인한다.
        expect(database.users[0]?.createdAt).toBe("2026-08-19T01:00:00Z");
        // 대화방 소유자 기본키가 camelCase로 변환됐는지 확인한다.
        expect(database.sessions[0]?.userId).toBe(1);
        // null 지연 시간이 값 손실 없이 유지되는지 확인한다.
        expect(database.messages[0]?.latencyMs).toBeNull();
        // 관리자 전용 endpoint를 정확히 호출했는지 확인한다.
        expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/database");
        // 세션 쿠키가 포함되도록 요청했는지 확인한다.
        expect((fetchMock.mock.calls[0]?.[1] as RequestInit).credentials).toBe("include");
    });

    // 네트워크 실패와 잘못된 성공 응답을 서로 다른 안전한 오류로 처리하는지 확인한다.
    it("maps network and malformed responses without exposing internals", async () => {
        // 첫 요청은 네트워크 실패, 두 번째 요청은 HTML 성공 응답으로 만든다.
        const fetchMock = vi
            // 함수 호출 순서를 추적할 mock을 만든다.
            .fn()
            // 브라우저 연결 실패와 같은 TypeError를 반환한다.
            .mockRejectedValueOnce(new TypeError("private network detail"))
            // JSON이 아닌 성공 응답을 반환한다.
            .mockResolvedValueOnce(
                new Response("<html>private proxy page</html>", {
                    // HTTP 자체는 성공인 상황을 만든다.
                    status: 200,
                    // HTML 응답임을 헤더로 알린다.
                    headers: { "Content-Type": "text/html" },
                }),
            );
        // 현재 테스트 동안만 전역 fetch를 바꾼다.
        vi.stubGlobal("fetch", fetchMock);

        // 연결 실패가 네트워크 오류 코드로 정리되는지 검사한다.
        await expect(getChatSessions()).rejects.toMatchObject({
            // 사용자 재시도에 사용할 네트워크 오류 코드다.
            code: "NETWORK_ERROR",
        });
        // 잘못된 성공 응답이 내부 오류 코드로 정리되는지 검사한다.
        await expect(getChatSessions()).rejects.toMatchObject({
            // HTML 내용이 아닌 일반 내부 오류 코드다.
            code: "INTERNAL_ERROR",
        });
    });
});
