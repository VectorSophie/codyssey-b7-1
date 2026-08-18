// 관리자 화면을 사용자처럼 조작할 테스트 기능을 불러온다.
import { fireEvent, render, screen } from "@testing-library/react";
// 실제 내부 경로 이동을 메모리에서 확인할 Router 기능을 불러온다.
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
// 테스트 전 mock 초기화와 검증 기능을 불러온다.
import { beforeEach, describe, expect, it, vi } from "vitest";
// 실제 오류 클래스와 mock할 관리자 API 함수를 불러온다.
import { ApiRequestError, getAdminDatabase } from "../api/client";
// 테스트 관리자 DB 타입만 불러온다.
import type { AdminDatabase, User } from "../types";

// 인증 관련 호출 기록을 모든 mock 렌더에서 재사용한다.
const authMocks = vi.hoisted(() => ({
    // 인증 만료 처리를 기록한다.
    expireSession: vi.fn(),
    // 로그아웃 처리를 기록한다.
    signOut: vi.fn(),
}));

// 관리자 API만 테스트가 정한 응답을 반환하게 바꾼다.
vi.mock("../api/client", async () => {
    // ApiRequestError 같은 실제 항목을 유지하기 위해 원래 모듈을 읽는다.
    const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
    // 원래 모듈에 관리자 조회 mock만 덮어쓴다.
    return {
        // 오류 클래스와 다른 함수는 실제 구현을 유지한다.
        ...actual,
        // 관리자 전체 DB 응답은 테스트가 직접 제어한다.
        getAdminDatabase: vi.fn(),
    };
});

// 실제 AuthProvider 없이 관리자 인증 상태를 고정한다.
vi.mock("../auth/AuthContext", () => ({
    // AdminPage가 사용할 관리자 정보와 인증 동작을 제공한다.
    useAuth: () => ({
        // 인증 확인 오류는 없는 상태다.
        authError: "",
        // 이 화면에서 직접 사용하지 않는 재확인 함수다.
        retryAuthentication: vi.fn(),
        // 이미 로그인한 상태다.
        status: "authenticated",
        // 관리자 메뉴 표시값이 참인 공개 사용자다.
        user: {
            // 테스트 관리자 기본키다.
            id: 1,
            // 화면 상단에 표시할 관리자 이름이다.
            username: "admin-reader",
            // 공개 관리자 이메일이다.
            email: "admin@example.com",
            // 테스트 계정 생성 시각이다.
            createdAt: "2026-08-19T00:00:00Z",
            // 서버가 판정한 관리자 메뉴 표시값이다.
            isAdmin: true,
        } satisfies User,
        // 이 화면에서 사용하지 않는 로그인 함수다.
        signIn: vi.fn(),
        // 이 화면에서 사용하지 않는 회원가입 함수다.
        signUp: vi.fn(),
        // 인증 만료 mock을 제공한다.
        expireSession: authMocks.expireSession,
        // 로그아웃 mock을 제공한다.
        signOut: authMocks.signOut,
    }),
}));

// mock이 준비된 뒤 실제 관리자 화면을 불러온다.
import { AdminPage } from "./AdminPage";

// 관리자 화면의 JOIN과 검색을 검증할 전체 DB 예시다.
const adminDatabase: AdminDatabase = {
    // 대화가 있는 관리자와 대화가 없는 일반 사용자를 준비한다.
    users: [
        {
            // 관리자 사용자 기본키다.
            id: 1,
            // 관리자 사용자 이름이다.
            username: "admin-reader",
            // 관리자 이메일이다.
            email: "admin@example.com",
            // 관리자 계정 생성 시각이다.
            createdAt: "2026-08-19T00:00:00Z",
        },
        {
            // 일반 사용자 기본키다.
            id: 2,
            // 일반 사용자 이름이다.
            username: "quiet-reader",
            // 일반 사용자 이메일이다.
            email: "quiet@example.com",
            // 일반 사용자 계정 생성 시각이다.
            createdAt: "2026-08-19T00:10:00Z",
        },
    ],
    // 관리자가 만든 대화방 한 건을 준비한다.
    sessions: [
        {
            // 대화방 기본키다.
            id: 10,
            // 관리자 사용자 기본키와 연결한다.
            userId: 1,
            // 대화방 제목이다.
            title: "운영 데이터 질문",
            // 대화방 생성 시각이다.
            createdAt: "2026-08-19T01:00:00Z",
            // 대화방 갱신 시각이다.
            updatedAt: "2026-08-19T01:01:00Z",
        },
    ],
    // 같은 대화방의 사용자 질문과 AI 답변을 준비한다.
    messages: [
        {
            // 사용자 메시지 기본키다.
            id: 100,
            // 준비한 대화방에 연결한다.
            sessionId: 10,
            // 사용자 질문 역할이다.
            role: "user",
            // 관리자 표에서 확인할 질문 원문이다.
            content: "SQLite 전체 데이터는 어떻게 확인해?",
            // 운영 로그 추적 번호다.
            requestId: "request-admin-100",
            // 정상 저장 상태다.
            status: "ok",
            // 사용자 질문에는 AI 지연 시간이 없다.
            latencyMs: null,
            // 사용자 메시지 생성 시각이다.
            createdAt: "2026-08-19T01:00:30Z",
        },
        {
            // AI 메시지 기본키다.
            id: 101,
            // 같은 대화방에 연결한다.
            sessionId: 10,
            // AI 답변 역할이다.
            role: "assistant",
            // 관리자 표에서 확인할 답변 원문이다.
            content: "관리자 데이터 콘솔에서 세 테이블을 확인할 수 있어.",
            // 같은 요청 흐름의 추적 번호다.
            requestId: "request-admin-100",
            // 정상 저장 상태다.
            status: "ok",
            // AI 답변 생성 지연 시간이다.
            latencyMs: 320,
            // AI 메시지 생성 시각이다.
            createdAt: "2026-08-19T01:01:00Z",
        },
    ],
};

// 테스트 화면에서 현재 URL을 텍스트로 확인한다.
function LocationProbe() {
    // 현재 메모리 Router 주소를 읽는다.
    const location = useLocation();
    // pathname과 query를 하나의 출력으로 표시한다.
    return <output data-testid="admin-location">{location.pathname}{location.search}</output>;
}

// 실제 관리자 경로와 인증 만료 도착 경로를 함께 렌더링한다.
function renderAdminPage(): void {
    // 관리자 URL에서 메모리 Router를 시작한다.
    render(
        <MemoryRouter initialEntries={["/admin"]} useTransitions={false}>
            {/* 경로 이동 결과를 계속 표시한다. */}
            <LocationProbe />
            {/* 관리자와 로그인 경로를 테스트용으로 정의한다. */}
            <Routes>
                {/* 실제 관리자 화면을 렌더링한다. */}
                <Route path="/admin" element={<AdminPage />} />
                {/* 인증 만료 뒤 도착 여부를 확인할 화면이다. */}
                <Route path="/login" element={<main>로그인 화면</main>} />
                {/* 링크 렌더링에 필요한 일반 채팅 경로다. */}
                <Route path="/chat" element={<main>채팅 화면</main>} />
            </Routes>
        </MemoryRouter>,
    );
}

// 관리자 데이터 콘솔의 성공·검색·권한 상태를 검사한다.
describe("AdminPage", () => {
    // 각 테스트가 독립적인 API와 인증 호출 기록을 사용하게 한다.
    beforeEach(() => {
        // 이전 mock 호출과 구현을 모두 지운다.
        vi.resetAllMocks();
        // 기본 관리자 API는 준비한 세 테이블을 성공으로 반환한다.
        vi.mocked(getAdminDatabase).mockResolvedValue(adminDatabase);
        // 로그아웃은 기본적으로 성공한다.
        authMocks.signOut.mockResolvedValue(undefined);
    });

    // 세 테이블의 전체 데이터와 관계 정보가 화면에 표시되는지 확인한다.
    it("shows complete users, sessions, and messages with searchable relations", async () => {
        // 실제 관리자 경로를 연다.
        renderAdminPage();

        // 관리자 API 성공 뒤 화면 제목이 나타날 때까지 기다린다.
        expect(await screen.findByRole("heading", { name: "관리자 데이터 콘솔" })).toBeInTheDocument();
        // 사용자 표에 관리자 이메일이 표시되는지 확인한다.
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
        // 대화가 없는 사용자도 전체 users 표에 표시되는지 확인한다.
        expect(screen.getByText("quiet-reader")).toBeInTheDocument();

        // 대화방 탭을 선택한다.
        fireEvent.click(screen.getByRole("tab", { name: "대화방 1" }));
        // user_id 관계로 사용자와 대화 제목이 함께 표시되는지 확인한다.
        expect(screen.getByText("운영 데이터 질문")).toBeInTheDocument();
        // 실제 사용자 기본키도 표시되는지 확인한다.
        expect(screen.getByText("user_id 1")).toBeInTheDocument();

        // 메시지 탭을 선택한다.
        fireEvent.click(screen.getByRole("tab", { name: "메시지 2" }));
        // 사용자 질문 원문 요약이 표시되는지 확인한다.
        expect(
            screen.getByText("SQLite 전체 데이터는 어떻게 확인해?", { selector: "summary" }),
        ).toBeInTheDocument();
        // AI 지연 시간이 단위와 함께 표시되는지 확인한다.
        expect(screen.getByText("320 ms")).toBeInTheDocument();
        // 운영 로그 request_id가 표시되는지 확인한다.
        expect(screen.getAllByText("request-admin-100")).toHaveLength(2);

        // 사용자 탭으로 돌아간다.
        fireEvent.click(screen.getByRole("tab", { name: "사용자 2" }));
        // quiet 사용자만 찾을 검색어를 입력한다.
        fireEvent.change(screen.getByLabelText("전체 필드 검색"), {
            // quiet 이메일과 일치할 검색어다.
            target: { value: "quiet@example.com" },
        });
        // 검색한 사용자 이메일은 남아 있어야 한다.
        expect(screen.getByText("quiet@example.com")).toBeInTheDocument();
        // 검색과 일치하지 않는 관리자 이메일은 표에서 사라져야 한다.
        expect(screen.queryByText("admin@example.com")).not.toBeInTheDocument();
        // 전체 DB API는 화면 최초 진입에 한 번만 호출돼야 한다.
        expect(getAdminDatabase).toHaveBeenCalledTimes(1);
    });

    // 로그인 사용자가 관리자 목록에 없을 때 개인정보를 표시하지 않는지 확인한다.
    it("shows an access denied state without rendering private data", async () => {
        // 관리자 API가 권한 부족 오류를 반환하게 한다.
        vi.mocked(getAdminDatabase).mockRejectedValueOnce(new ApiRequestError("ADMIN_REQUIRED", 403));
        // 관리자 경로를 연다.
        renderAdminPage();

        // 권한 부족 제목이 나타날 때까지 기다린다.
        expect(await screen.findByRole("heading", { name: "관리자 권한이 없습니다" })).toBeInTheDocument();
        // 사용자 개인정보는 화면에 남지 않아야 한다.
        expect(screen.queryByText("admin@example.com")).not.toBeInTheDocument();
    });

    // 관리자 API에서 세션 만료가 오면 안전한 로그인 경로로 이동하는지 확인한다.
    it("redirects an expired admin session back to the admin login flow", async () => {
        // 관리자 API가 인증 만료 오류를 반환하게 한다.
        vi.mocked(getAdminDatabase).mockRejectedValueOnce(new ApiRequestError("AUTH_REQUIRED", 401));
        // 관리자 경로를 연다.
        renderAdminPage();

        // 로그인 화면이 나타날 때까지 기다린다.
        expect(await screen.findByText("로그인 화면")).toBeInTheDocument();
        // 로그인 성공 뒤 /admin으로 돌아올 안전한 query가 있는지 확인한다.
        expect(screen.getByTestId("admin-location")).toHaveTextContent("/login?next=/admin");
        // 전역 인증 상태 정리가 한 번 호출돼야 한다.
        expect(authMocks.expireSession).toHaveBeenCalledTimes(1);
    });
});
