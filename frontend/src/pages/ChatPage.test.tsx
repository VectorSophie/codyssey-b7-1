// 채팅 화면을 사용자 동작처럼 검사할 React Testing Library 기능을 불러온다.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
// 실제 URL 전환을 메모리 안에서 재현할 React Router 기능을 불러온다.
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
// 테스트 전 mock 정리와 결과 검증에 사용할 Vitest 기능을 불러온다.
import { beforeEach, describe, expect, it, vi } from "vitest";
// mock 호출 횟수와 반환값을 정할 API 함수들을 불러온다.
import {
    // API 오류 코드를 실제 화면 분기로 전달할 클래스를 불러온다.
    ApiRequestError,
    // 삭제 API mock을 초기화하기 위해 불러온다.
    deleteChatSession,
    // 선택 대화 GET mock을 설정하기 위해 불러온다.
    getChatSession,
    // 기록 목록 GET mock을 설정하기 위해 불러온다.
    getChatSessions,
    // 채팅 POST mock을 설정하기 위해 불러온다.
    sendChatMessage,
} from "../api/client";
// 로그인 이동 state의 질문을 화면에서 안전하게 확인할 함수를 불러온다.
import { readPendingQuestion } from "../lib/navigationState";
// 테스트 대화와 메시지에 실제 화면 타입을 적용한다.
import type { ChatMessage, ChatSession, User } from "../types";

// 인증 mock 함수가 렌더마다 바뀌어 effect를 다시 실행하지 않게 고정한다.
const authMocks = vi.hoisted(() => ({
    // 인증 만료 처리 호출을 기록한다.
    expireSession: vi.fn(),
    // 로그아웃 호출을 기록한다.
    signOut: vi.fn(),
}));

// 채팅 화면이 실제 네트워크 없이 요청 순서와 화면 상태만 검증하도록 API를 바꾼다.
vi.mock("../api/client", async () => {
    // 오류 클래스처럼 그대로 사용할 실제 모듈 부분을 불러온다.
    const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
    // 네트워크 함수만 테스트 mock으로 교체한다.
    return {
        // 실제 오류 클래스와 나머지 공개 항목을 유지한다.
        ...actual,
        // 대화 삭제 결과를 테스트가 직접 정한다.
        deleteChatSession: vi.fn(),
        // 선택 대화 조회 결과를 테스트가 직접 정한다.
        getChatSession: vi.fn(),
        // 기록 목록 결과를 테스트가 직접 정한다.
        getChatSessions: vi.fn(),
        // 질문 전송 결과를 테스트가 직접 정한다.
        sendChatMessage: vi.fn(),
    };
});

// 보호 경로를 이미 통과한 사용자 상태만 채팅 화면에 제공한다.
vi.mock("../auth/AuthContext", () => ({
    // 실제 ChatPage가 호출할 인증 Hook을 고정된 값으로 바꾼다.
    useAuth: () => ({
        // 인증 오류는 없는 상태다.
        authError: "",
        // 테스트에서 직접 쓰지 않는 재확인 함수다.
        retryAuthentication: vi.fn(),
        // 이미 인증된 테스트 사용자다.
        status: "authenticated",
        // 테스트 사용자 공개 정보다.
        user: {
            // 테스트 사용자 번호다.
            id: 1,
            // 상단에 표시할 사용자 이름이다.
            username: "chat-reader",
            // 공개 이메일 주소다.
            email: "chat-reader@example.com",
            // 테스트 계정 생성 시각이다.
            createdAt: "2026-08-08T16:00:00Z",
        } satisfies User,
        // 이 테스트에서 직접 쓰지 않는 로그인 함수다.
        signIn: vi.fn(),
        // 이 테스트에서 직접 쓰지 않는 회원가입 함수다.
        signUp: vi.fn(),
        // 실제 고정된 인증 만료 mock을 제공한다.
        expireSession: authMocks.expireSession,
        // 실제 고정된 로그아웃 mock을 제공한다.
        signOut: authMocks.signOut,
    }),
}));

// 모든 mock이 준비된 뒤 실제 채팅 화면을 불러온다.
import { ChatPage } from "./ChatPage";

// 테스트에서 URL 변경 결과를 텍스트로 확인하는 작은 화면이다.
function LocationProbe() {
    // 현재 메모리 Router의 경로와 query를 읽는다.
    const location = useLocation();
    // 테스트 전용 output에 현재 전체 내부 주소를 표시한다.
    return (
        <div>
            {/* 현재 경로와 query를 합쳐서 보여준다. */}
            <output data-testid="current-location">{location.pathname}{location.search}</output>
            {/* URL에 노출되지 않은 질문 이동 state를 별도 출력한다. */}
            <output data-testid="pending-question">{readPendingQuestion(location.state)}</output>
        </div>
    );
}

// 실제 앱 경로 구조와 비슷하게 채팅과 랜딩을 함께 렌더링한다.
function renderChat(
    // 문자열 URL 또는 질문 이동 state가 포함된 채팅 주소를 받는다.
    initialEntry: string | { pathname: string; state: { pendingQuestion: string } } = "/chat",
): void {
    // 원하는 첫 URL로 메모리 Router를 시작한다.
    render(
        <MemoryRouter initialEntries={[initialEntry]} useTransitions={false}>
            {/* 현재 URL을 모든 경로에서 계속 확인한다. */}
            <LocationProbe />
            {/* 테스트에 필요한 두 경로만 정의한다. */}
            <Routes>
                {/* 실제 채팅 화면을 /chat에서 렌더링한다. */}
                <Route path="/chat" element={<ChatPage />} />
                {/* 채팅을 떠났는지 확인할 간단한 랜딩 화면이다. */}
                <Route path="/" element={<main>랜딩 도착</main>} />
                {/* 인증 만료가 안전한 로그인 경로로 이동했는지 확인할 화면이다. */}
                <Route path="/login" element={<main>로그인 도착</main>} />
            </Routes>
        </MemoryRouter>,
    );
}

// 테스트에 사용할 저장 대화 요약을 만든다.
const storedSession: ChatSession = {
    // 서버가 부여한 대화 번호다.
    id: 7,
    // 첫 질문에서 서버가 만든 제목이다.
    title: "저장된 대화",
    // 대화 생성 시각이다.
    createdAt: "2026-08-08T16:10:00Z",
    // 대화 갱신 시각이다.
    updatedAt: "2026-08-08T16:11:00Z",
};

// 저장 대화에 표시할 기존 사용자 질문을 만든다.
const storedQuestion: ChatMessage = {
    // 서버 메시지 번호다.
    id: 71,
    // 사용자가 작성한 질문 역할이다.
    role: "user",
    // 저장된 질문 내용이다.
    content: "저장된 질문",
    // 질문 생성 시각이다.
    createdAt: "2026-08-08T16:10:00Z",
};

// 저장 대화 전환 실패를 검사할 두 번째 대화 요약을 만든다.
const unavailableSession: ChatSession = {
    // 서버가 부여한 두 번째 대화 번호다.
    id: 8,
    // 기록 레일에 표시할 두 번째 대화 제목이다.
    title: "열 수 없는 대화",
    // 두 번째 대화 생성 시각이다.
    createdAt: "2026-08-08T16:12:00Z",
    // 두 번째 대화 갱신 시각이다.
    updatedAt: "2026-08-08T16:13:00Z",
};

// ChatPage의 비동기 URL 전환과 화면 생명주기 회귀를 검사한다.
describe("ChatPage", () => {
    // 각 테스트 전에 API mock과 브라우저 기능을 같은 상태로 만든다.
    beforeEach(() => {
        // 이전 테스트의 호출 기록과 구현을 모두 지운다.
        vi.resetAllMocks();
        // 기본 기록 목록은 빈 배열로 바로 반환한다.
        vi.mocked(getChatSessions).mockResolvedValue([]);
        // 기본 삭제 요청은 성공으로 바로 끝낸다.
        vi.mocked(deleteChatSession).mockResolvedValue(undefined);
        // 기본 로그아웃 요청은 성공으로 바로 끝낸다.
        authMocks.signOut.mockResolvedValue(undefined);
        // jsdom에 없는 viewport media query API를 안전한 고정값으로 제공한다.
        vi.stubGlobal(
            "matchMedia",
            // ChatPage와 ConversationView가 호출할 MediaQueryList 형태를 만든다.
            vi.fn().mockImplementation((query: string) => ({
                // 테스트는 모바일이나 축소 모션 조건이 아닌 상태다.
                matches: false,
                // 원래 query 문자열을 그대로 보관한다.
                media: query,
                // 오래된 브라우저 호환 함수는 빈 mock으로 제공한다.
                onchange: null,
                // viewport 변경 등록 호출을 기록한다.
                addEventListener: vi.fn(),
                // viewport 변경 해제 호출을 기록한다.
                removeEventListener: vi.fn(),
                // 구형 이벤트 등록 함수도 빈 mock으로 제공한다.
                addListener: vi.fn(),
                // 구형 이벤트 해제 함수도 빈 mock으로 제공한다.
                removeListener: vi.fn(),
                // 직접 이벤트 전달은 사용하지 않으므로 false를 반환한다.
                dispatchEvent: vi.fn().mockReturnValue(false),
            })),
        );
    });

    // 로그인 전에 작성한 질문이 채팅 진입 직후 별도 클릭 없이 전송되는지 확인한다.
    it("automatically sends the pending question once after login", async () => {
        // 자동 전송 요청에 서버가 새 대화 번호와 답변을 반환하게 한다.
        vi.mocked(sendChatMessage).mockResolvedValueOnce({
            // 서버가 자동 질문으로 만든 새 대화 번호다.
            sessionId: 42,
            // 화면에 표시할 AI 답변 객체다.
            message: {
                // 테스트 답변의 고유 번호다.
                id: 422,
                // AI가 작성한 메시지임을 표시한다.
                role: "assistant",
                // 자동 전송 성공을 확인할 답변 내용이다.
                content: "자동 전송 답변",
                // 화면이 날짜를 표시할 때 사용할 생성 시각이다.
                createdAt: "2026-08-19T10:00:00Z",
            },
        });

        // 로그인 성공 이동처럼 질문을 URL이 아닌 Router state에 담아 채팅을 연다.
        renderChat({
            // 보호된 채팅 화면 주소다.
            pathname: "/chat",
            // 로그인 전에 작성한 질문을 이동 state로 전달한다.
            state: { pendingQuestion: "로그인 전에 작성한 질문" },
        });

        // 사용자가 보내기 버튼을 누르지 않아도 채팅 API가 호출될 때까지 기다린다.
        await waitFor(() => {
            // 새 대화이므로 session id 없이 최초 질문을 정확히 전송해야 한다.
            expect(sendChatMessage).toHaveBeenCalledWith(null, "로그인 전에 작성한 질문");
        });
        // React StrictMode와 Router state 제거가 같은 질문을 중복 전송하지 않아야 한다.
        expect(sendChatMessage).toHaveBeenCalledTimes(1);
        // 사용이 끝난 질문은 브라우저 이동 state에 남지 않아야 한다.
        expect(screen.getByTestId("pending-question")).toHaveTextContent("");
    });

    // 첫 질문 성공 결과가 새 URL 전환 뒤에도 같은 화면에 남는지 확인한다.
    it("keeps the first question and answer while moving to the new session URL", async () => {
        // 서버가 새 대화 번호와 AI 답변을 반환하게 한다.
        vi.mocked(sendChatMessage).mockResolvedValueOnce({
            // 서버가 만든 새 대화 번호다.
            sessionId: 41,
            // 서버가 저장한 AI 답변이다.
            message: {
                // 새 답변 번호다.
                id: 412,
                // AI 답변 역할이다.
                role: "assistant",
                // 화면에 표시할 답변 내용이다.
                content: "새 대화 답변",
                // 답변 생성 시각이다.
                createdAt: "2026-08-08T16:20:00Z",
            },
        });
        // 선택 대화 GET이 실수로 호출되면 확인할 mock을 준비한다.
        vi.mocked(getChatSession).mockResolvedValue({
            // 임시 상세 응답의 대화 요약이다.
            session: storedSession,
            // 임시 상세 응답의 메시지다.
            messages: [storedQuestion],
        });

        // 선택 대화가 없는 새 질문 URL에서 화면을 연다.
        renderChat();
        // 실제 label로 질문 입력칸을 찾는다.
        const questionInput = screen.getByLabelText("질문");
        // 사용자가 첫 질문을 입력한다.
        fireEvent.change(questionInput, { target: { value: "새 대화 질문" } });
        // 명시적인 전송 버튼으로 질문을 한 번 보낸다.
        fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

        // 서버가 만든 새 번호가 URL에 반영될 때까지 기다린다.
        await waitFor(() => {
            // 새로고침 복원을 위한 query가 정확한지 확인한다.
            expect(screen.getByTestId("current-location")).toHaveTextContent("/chat?session=41");
        });
        // URL effect가 성공 결과를 적용한 뒤 사용자 질문이 보일 때까지 기다린다.
        expect(await screen.findByRole("heading", { name: "새 대화 질문" })).toBeInTheDocument();
        // 같은 effect에서 AI 답변도 바로 읽을 수 있어야 한다.
        expect(await screen.findByText("새 대화 답변")).toBeInTheDocument();
        // 성공 응답을 다시 읽기 위한 불필요한 대화 GET이 없어야 한다.
        expect(getChatSession).not.toHaveBeenCalled();
        // 사용자 제출 한 번이 AI 요청 한 번으로 이어졌는지 확인한다.
        expect(sendChatMessage).toHaveBeenCalledTimes(1);
        // 새 대화 요청은 기존 session id 없이 보내야 한다.
        expect(sendChatMessage).toHaveBeenCalledWith(null, "새 대화 질문");
    });

    // 사용자가 채팅을 떠난 뒤 늦은 POST가 현재 경로를 되돌리지 않는지 확인한다.
    it("does not navigate back to chat when a response arrives after unmount", async () => {
        // 지연된 AI 응답을 나중에 성공시킬 함수를 보관한다.
        let resolveChatRequest: ((value: Awaited<ReturnType<typeof sendChatMessage>>) => void) | undefined;
        // 채팅 POST를 테스트가 원하는 시점까지 끝나지 않는 Promise로 만든다.
        vi.mocked(sendChatMessage).mockReturnValueOnce(
            new Promise((resolve) => {
                // 응답 성공 함수를 바깥 테스트에서 호출할 수 있게 저장한다.
                resolveChatRequest = resolve;
            }),
        );

        // 새 질문 URL에서 채팅 화면을 연다.
        renderChat();
        // 전송 전에 사용자의 질문을 입력한다.
        fireEvent.change(screen.getByLabelText("질문"), {
            // 실제 사용자가 작성한 질문 값이다.
            target: { value: "떠나기 전 질문" },
        });
        // 아직 끝나지 않을 AI 요청을 시작한다.
        fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));
        // 상단 서비스 링크로 사용자가 명시적으로 랜딩으로 이동한다.
        fireEvent.click(screen.getByRole("link", { name: "EVERYTHING" }));

        // 채팅 컴포넌트가 사라지고 랜딩이 보이는지 확인한다.
        expect(await screen.findByText("랜딩 도착")).toBeInTheDocument();
        // 실제 현재 URL도 랜딩 경로인지 확인한다.
        expect(screen.getByTestId("current-location")).toHaveTextContent(/^\/$/);

        // 화면을 떠난 뒤 늦은 AI 응답을 React 처리 범위 안에서 도착시킨다.
        await act(async () => {
            // 서버가 저장한 새 대화와 답변을 반환한다.
            resolveChatRequest?.({
                // 서버가 만든 새 대화 번호다.
                sessionId: 51,
                // 늦게 도착한 AI 답변이다.
                message: {
                    // 답변 번호다.
                    id: 512,
                    // AI 답변 역할이다.
                    role: "assistant",
                    // 늦은 답변 내용이다.
                    content: "늦은 답변",
                    // 답변 생성 시각이다.
                    createdAt: "2026-08-08T16:30:00Z",
                },
            });
            // Promise 후속 처리가 실행될 한 차례를 기다린다.
            await Promise.resolve();
        });

        // 늦은 응답 뒤에도 사용자가 선택한 랜딩 경로를 유지해야 한다.
        expect(screen.getByTestId("current-location")).toHaveTextContent(/^\/$/);
        // 사라진 채팅 화면의 답변이 현재 랜딩에 섞이면 안 된다.
        expect(screen.queryByText("늦은 답변")).not.toBeInTheDocument();
    });

    // 전송과 병행한 기록 조회가 먼저 만료돼도 제출 질문을 로그인까지 보존하는지 확인한다.
    it("preserves the submitted question when history authentication expires first", async () => {
        // 지연된 기록 요청을 원하는 시점에 인증 실패시킬 함수를 보관한다.
        let rejectHistoryRequest: ((reason?: unknown) => void) | undefined;
        // 화면을 떠난 뒤 채팅 요청을 정리할 성공 함수를 보관한다.
        let resolveChatRequest: ((value: Awaited<ReturnType<typeof sendChatMessage>>) => void) | undefined;
        // 첫 기록 GET을 사용자가 질문을 보낼 때까지 끝나지 않게 만든다.
        vi.mocked(getChatSessions).mockReturnValueOnce(
            new Promise<ChatSession[]>((_resolve, reject) => {
                // 인증 만료를 나중에 발생시킬 함수를 테스트에 전달한다.
                rejectHistoryRequest = reject;
            }),
        );
        // 채팅 POST도 기록 오류가 먼저 도착하도록 지연한다.
        vi.mocked(sendChatMessage).mockReturnValueOnce(
            new Promise((resolve) => {
                // 화면 이동 뒤 Promise를 안전하게 정리할 함수를 보관한다.
                resolveChatRequest = resolve;
            }),
        );

        // 선택 대화가 없는 새 질문 화면을 연다.
        renderChat();
        // 사용자가 인증 만료 뒤에도 복원되어야 할 질문을 입력한다.
        fireEvent.change(screen.getByLabelText("질문"), {
            // 실제 입력값을 사용자 질문으로 전달한다.
            target: { value: "로그인 뒤 이어갈 질문" },
        });
        // 질문 POST를 시작해 입력칸이 비워지는 상황을 만든다.
        fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

        // 채팅 요청이 실제로 한 번 시작됐는지 확인한다.
        await waitFor(() => {
            // 새 대화이므로 session id 없이 질문을 보내야 한다.
            expect(sendChatMessage).toHaveBeenCalledWith(null, "로그인 뒤 이어갈 질문");
        });

        // 병행 중이던 기록 GET을 먼저 인증 만료로 끝낸다.
        await act(async () => {
            // 서버가 쿠키 만료를 알린 것과 같은 오류를 반환한다.
            rejectHistoryRequest?.(new ApiRequestError("AUTH_REQUIRED", 401));
            // Promise 오류 후속 처리가 실행될 한 차례를 기다린다.
            await Promise.resolve();
        });

        // 인증 만료가 안전한 로그인 경로로 이동했는지 확인한다.
        expect(await screen.findByText("로그인 도착")).toBeInTheDocument();
        // 외부 주소가 아닌 고정된 내부 로그인 query만 사용해야 한다.
        expect(screen.getByTestId("current-location")).toHaveTextContent("/login?next=/chat");
        // 이미 입력칸에서 지운 제출 질문도 이동 state에 그대로 남아야 한다.
        expect(screen.getByTestId("pending-question")).toHaveTextContent("로그인 뒤 이어갈 질문");
        // 전역 인증 상태도 만료 처리됐는지 확인한다.
        expect(authMocks.expireSession).toHaveBeenCalledTimes(1);

        // 화면을 떠난 뒤 남은 POST Promise를 성공으로 정리한다.
        await act(async () => {
            // 늦은 서버 성공은 현재 로그인 경로를 바꾸지 않아야 한다.
            resolveChatRequest?.({
                // 서버가 만든 테스트 대화 번호다.
                sessionId: 61,
                // 테스트용 AI 답변 객체다.
                message: {
                    // 서버 답변 번호다.
                    id: 612,
                    // AI 답변 역할이다.
                    role: "assistant",
                    // 로그인 화면에 나타나면 안 되는 늦은 답변이다.
                    content: "늦은 인증 만료 답변",
                    // 답변 생성 시각이다.
                    createdAt: "2026-08-08T16:40:00Z",
                },
            });
            // 늦은 POST 후속 처리가 실행될 한 차례를 기다린다.
            await Promise.resolve();
        });
        // 늦은 성공 뒤에도 사용자가 도착한 로그인 경로를 유지해야 한다.
        expect(screen.getByTestId("current-location")).toHaveTextContent("/login?next=/chat");
    });

    // 저장 대화에서 새 질문으로 전환할 때 삭제할 화면을 다시 GET하지 않는지 확인한다.
    it("moves from a stored session to a blank question without a duplicate GET", async () => {
        // 기록 레일에 현재 저장 대화를 반환한다.
        vi.mocked(getChatSessions).mockResolvedValueOnce([storedSession]);
        // URL에 선택된 대화의 저장 내용을 반환한다.
        vi.mocked(getChatSession).mockResolvedValueOnce({
            // 선택한 대화 요약이다.
            session: storedSession,
            // 선택한 대화의 저장 질문이다.
            messages: [storedQuestion],
        });

        // 저장 대화 번호가 포함된 URL에서 화면을 연다.
        renderChat("/chat?session=7");
        // 첫 대화 GET이 끝나 저장 질문이 보일 때까지 기다린다.
        expect(await screen.findByRole("heading", { name: "저장된 질문" })).toBeInTheDocument();
        // 상단의 새 질문 버튼은 AI 호출 없이 새 상태를 만든다.
        fireEvent.click(screen.getByRole("button", { name: "새 질문" }));

        // query가 제거된 새 질문 URL에 도착할 때까지 기다린다.
        await waitFor(() => {
            // 저장 대화 번호가 현재 URL에서 사라져야 한다.
            expect(screen.getByTestId("current-location")).toHaveTextContent("/chat");
        });
        // 새 대화 안내 제목이 표시되는지 확인한다.
        expect(
            screen.getByRole("heading", { name: "세상에는 궁금한 것이 너무 많습니다." }),
        ).toBeInTheDocument();
        // 떠난 대화를 URL 전환 중 다시 조회하면 안 된다.
        expect(getChatSession).toHaveBeenCalledTimes(1);
        // 새 질문 버튼 자체는 AI POST를 만들면 안 된다.
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    // 다른 기록 조회 실패가 사용자 동작 없이 자동 재시도되지 않는지 확인한다.
    it("shows one failed session load and waits for an explicit retry", async () => {
        // 기록 레일에 현재 대화와 실패할 대화를 함께 반환한다.
        vi.mocked(getChatSessions).mockResolvedValueOnce([storedSession, unavailableSession]);
        // 첫 조회는 성공하고 두 번째 대화 조회는 찾을 수 없음으로 실패하게 한다.
        vi.mocked(getChatSession)
            // 현재 URL의 저장 대화는 정상적으로 반환한다.
            .mockResolvedValueOnce({
                // 현재 대화 요약이다.
                session: storedSession,
                // 현재 대화의 저장 질문이다.
                messages: [storedQuestion],
            })
            // 사용자가 선택한 두 번째 대화는 서버에서 찾을 수 없게 한다.
            .mockRejectedValueOnce(new ApiRequestError("NOT_FOUND", 404));

        // 첫 번째 저장 대화 URL에서 화면을 연다.
        renderChat("/chat?session=7");
        // 현재 저장 질문이 표시될 때까지 기다린다.
        expect(await screen.findByRole("heading", { name: "저장된 질문" })).toBeInTheDocument();
        // 기록 레일에서 두 번째 대화를 사용자가 직접 선택한다.
        fireEvent.click(screen.getByRole("button", { name: "열 수 없는 대화" }));

        // 조회 실패의 안전한 문장이 표시될 때까지 기다린다.
        expect(await screen.findByText("대화를 찾을 수 없습니다.")).toBeInTheDocument();
        // 비동기 effect가 자동 재시도할 기회를 한 차례 더 기다린다.
        await act(async () => {
            // 남은 Promise 후속 처리를 실행한다.
            await Promise.resolve();
        });
        // 초기 A 조회와 사용자가 선택한 B 조회만 실행돼야 한다.
        expect(getChatSession).toHaveBeenCalledTimes(2);
        // 세 번째 GET은 오류 화면의 다시 불러오기 버튼을 눌러야만 가능해야 한다.
        expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeInTheDocument();
    });

    // 느린 다른 대화 GET 중 메모리에 있는 대화로 돌아오면 즉시 복원되는지 확인한다.
    it("restores the active session while a different session request is still pending", async () => {
        // 느린 두 번째 대화 응답을 나중에 성공시킬 함수를 보관한다.
        let resolveSecondSession: ((value: Awaited<ReturnType<typeof getChatSession>>) => void) | undefined;
        // 기록 레일에 돌아올 현재 대화와 느린 대화를 함께 반환한다.
        vi.mocked(getChatSessions).mockResolvedValueOnce([storedSession, unavailableSession]);
        // 첫 대화는 바로 성공하고 두 번째 대화는 원하는 시점까지 지연한다.
        vi.mocked(getChatSession)
            // 현재 URL의 저장 대화와 질문을 반환한다.
            .mockResolvedValueOnce({
                // 현재 대화 요약이다.
                session: storedSession,
                // 현재 대화의 저장 질문이다.
                messages: [storedQuestion],
            })
            // 두 번째 대화는 브라우저 왕복을 재현할 지연 Promise로 만든다.
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    // 두 번째 GET을 나중에 끝낼 함수를 저장한다.
                    resolveSecondSession = resolve;
                }),
            );

        // 첫 번째 저장 대화 URL에서 화면을 연다.
        renderChat("/chat?session=7");
        // 메모리에 남길 첫 질문이 표시될 때까지 기다린다.
        expect(await screen.findByRole("heading", { name: "저장된 질문" })).toBeInTheDocument();
        // 응답이 지연될 두 번째 대화를 선택한다.
        fireEvent.click(screen.getByRole("button", { name: "열 수 없는 대화" }));
        // 두 번째 대화 URL과 로딩 화면에 도착할 때까지 기다린다.
        await waitFor(() => {
            // 선택 query가 두 번째 번호로 바뀌었는지 확인한다.
            expect(screen.getByTestId("current-location")).toHaveTextContent("/chat?session=8");
            // 저장 대화 GET의 정확한 로딩 문장이 표시돼야 한다.
            expect(screen.getByText("대화 기록을 불러오는 중…")).toBeInTheDocument();
        });

        // 느린 GET이 끝나기 전에 메모리에 있는 첫 대화로 돌아간다.
        fireEvent.click(screen.getByRole("button", { name: "저장된 대화" }));

        // 첫 대화 URL과 기존 질문이 즉시 복원될 때까지 기다린다.
        await waitFor(() => {
            // URL이 첫 대화 번호로 돌아와야 한다.
            expect(screen.getByTestId("current-location")).toHaveTextContent("/chat?session=7");
            // 느린 GET을 기다리지 않고 기존 질문을 다시 보여줘야 한다.
            expect(screen.getByRole("heading", { name: "저장된 질문" })).toBeInTheDocument();
        });

        // 뒤늦은 두 번째 GET 성공을 React 처리 범위 안에서 도착시킨다.
        await act(async () => {
            // 두 번째 대화의 늦은 메시지 응답을 반환한다.
            resolveSecondSession?.({
                // 두 번째 대화 요약이다.
                session: unavailableSession,
                // 현재 화면에 섞이면 안 되는 늦은 질문이다.
                messages: [
                    {
                        // 늦은 메시지 번호다.
                        id: 81,
                        // 사용자 질문 역할이다.
                        role: "user",
                        // 화면에 나타나면 실패인 문장이다.
                        content: "늦은 두 번째 질문",
                        // 늦은 메시지 생성 시각이다.
                        createdAt: "2026-08-08T16:14:00Z",
                    },
                ],
            });
            // Promise 후속 처리가 실행될 한 차례를 기다린다.
            await Promise.resolve();
        });

        // 늦은 B 응답이 현재 A 화면을 덮으면 안 된다.
        expect(screen.queryByRole("heading", { name: "늦은 두 번째 질문" })).not.toBeInTheDocument();
        // A 초기 조회와 B 선택 조회 외 자동 GET은 없어야 한다.
        expect(getChatSession).toHaveBeenCalledTimes(2);
    });
});
