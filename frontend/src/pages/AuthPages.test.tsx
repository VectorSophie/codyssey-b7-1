// 인증 화면을 사용자처럼 조작할 React Testing Library 기능을 불러온다.
import { act, fireEvent, render, screen } from "@testing-library/react";
// 실제 내부 경로 이동을 메모리에서 검사할 Router 기능을 불러온다.
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
// 테스트 전 mock 정리와 결과 검증에 사용할 Vitest 기능을 불러온다.
import { beforeEach, describe, expect, it, vi } from "vitest";
// 로그인과 회원가입 성공 응답에 실제 사용자 타입을 적용한다.
import type { User } from "../types";

// 인증 화면이 호출할 지연 로그인과 회원가입 함수를 고정한다.
const authMocks = vi.hoisted(() => ({
    // 로그인 호출과 반환 시점을 테스트가 직접 제어한다.
    signIn: vi.fn(),
    // 회원가입 호출과 반환 시점을 테스트가 직접 제어한다.
    signUp: vi.fn(),
}));

// 실제 Provider 없이 인증 화면의 지역 비동기 이동만 검사한다.
vi.mock("../auth/AuthContext", () => ({
    // 두 인증 화면에 필요한 비로그인 상태와 함수를 제공한다.
    useAuth: () => ({
        // 인증 확인 오류가 없는 상태다.
        authError: "",
        // 이 테스트에서 사용하지 않는 인증 재확인 함수다.
        retryAuthentication: vi.fn(),
        // 폼을 표시해야 하는 비로그인 상태다.
        status: "unauthenticated",
        // 비로그인 상태이므로 사용자 정보가 없다.
        user: null,
        // 테스트가 제어하는 지연 로그인 함수다.
        signIn: authMocks.signIn,
        // 테스트가 제어하는 지연 회원가입 함수다.
        signUp: authMocks.signUp,
        // 이 화면에서 사용하지 않는 만료 처리 함수다.
        expireSession: vi.fn(),
        // 이 화면에서 사용하지 않는 로그아웃 함수다.
        signOut: vi.fn(),
    }),
}));

// mock이 준비된 뒤 실제 로그인 화면을 불러온다.
import { LoginPage } from "./LoginPage";
// mock이 준비된 뒤 실제 회원가입 화면을 불러온다.
import { RegisterPage } from "./RegisterPage";

// 두 인증 요청의 성공 결과로 사용할 공개 사용자 정보다.
const authenticatedUser: User = {
    // 서버가 부여한 테스트 사용자 번호다.
    id: 91,
    // 화면에 표시할 사용자 이름이다.
    username: "auth-reader",
    // 서버가 반환한 공개 이메일 주소다.
    email: "auth-reader@example.com",
    // 서버가 반환한 계정 생성 시각이다.
    createdAt: "2026-08-08T17:00:00Z",
    // 일반 인증 화면 테스트이므로 관리자 권한은 없다.
    isAdmin: false,
};

// 현재 내부 경로를 테스트 화면에서 확인하는 작은 컴포넌트다.
function LocationProbe() {
    // 메모리 Router의 최신 주소를 읽는다.
    const location = useLocation();
    // pathname과 query를 한 문자열로 표시한다.
    return <output data-testid="auth-location">{location.pathname}{location.search}</output>;
}

// 로그인 또는 회원가입 화면을 실제 앱과 같은 내부 경로 구조로 연다.
function renderAuthPage(initialEntry: "/login" | "/register"): void {
    // 각 테스트가 지정한 인증 경로에서 메모리 Router를 시작한다.
    render(
        <MemoryRouter initialEntries={[initialEntry]} useTransitions={false}>
            {/* 경로가 바뀌어도 현재 주소를 계속 확인한다. */}
            <LocationProbe />
            {/* 인증 화면, 홈, 채팅 경로를 테스트용으로 정의한다. */}
            <Routes>
                {/* 실제 로그인 폼을 로그인 경로에 연결한다. */}
                <Route path="/login" element={<LoginPage />} />
                {/* 실제 회원가입 폼을 가입 경로에 연결한다. */}
                <Route path="/register" element={<RegisterPage />} />
                {/* 사용자가 직접 떠난 홈 경로를 확인할 화면이다. */}
                <Route path="/" element={<main>홈 유지</main>} />
                {/* 늦은 인증 응답이 잘못 이동하면 드러날 화면이다. */}
                <Route path="/chat" element={<main>채팅 이동</main>} />
            </Routes>
        </MemoryRouter>,
    );
}

// 인증 화면이 사라진 뒤 늦은 성공 응답의 URL 부작용을 검사한다.
describe("LoginPage and RegisterPage", () => {
    // 각 테스트 전에 이전 인증 mock 호출과 구현을 모두 지운다.
    beforeEach(() => {
        // 두 mock을 새 테스트가 독립적으로 제어할 수 있게 초기화한다.
        vi.resetAllMocks();
    });

    // 사용자가 로그인 중 홈으로 떠나면 늦은 성공이 채팅으로 끌어오지 않는지 확인한다.
    it("keeps the chosen route when login succeeds after the page unmounts", async () => {
        // 로그인 성공 Promise를 나중에 끝낼 함수를 보관한다.
        let resolveLogin: ((user: User) => void) | undefined;
        // 로그인 요청을 사용자가 홈으로 이동할 때까지 지연한다.
        authMocks.signIn.mockReturnValueOnce(
            new Promise<User>((resolve) => {
                // 테스트 바깥에서 성공시킬 함수를 저장한다.
                resolveLogin = resolve;
            }),
        );

        // 실제 로그인 경로에서 폼을 연다.
        renderAuthPage("/login");
        // 유효한 사용자 이름을 입력한다.
        fireEvent.change(screen.getByLabelText("사용자 이름"), {
            // 백엔드가 받을 username 값을 넣는다.
            target: { value: "auth-reader" },
        });
        // 유효한 비밀번호를 입력한다.
        fireEvent.change(screen.getByLabelText("비밀번호"), {
            // 테스트에서만 사용하는 비밀번호 값을 넣는다.
            target: { value: "password123" },
        });
        // 로그인 API 요청을 시작한다.
        fireEvent.click(screen.getByRole("button", { name: "로그인" }));
        // 요청이 진행 중일 때 사용자가 상단 홈 링크로 직접 떠난다.
        fireEvent.click(screen.getByRole("link", { name: "EVERYTHING 홈" }));

        // 사용자가 선택한 홈 화면이 실제로 렌더링됐는지 확인한다.
        expect(await screen.findByText("홈 유지")).toBeInTheDocument();
        // 현재 내부 경로도 홈인지 확인한다.
        expect(screen.getByTestId("auth-location")).toHaveTextContent(/^\/$/);

        // 화면이 사라진 뒤 지연된 로그인 요청을 성공시킨다.
        await act(async () => {
            // 서버가 공개 사용자 정보를 반환한 상황을 재현한다.
            resolveLogin?.(authenticatedUser);
            // Promise 후속 처리가 끝날 한 차례를 기다린다.
            await Promise.resolve();
        });

        // 늦은 성공 뒤에도 사용자가 선택한 홈 경로가 유지돼야 한다.
        expect(screen.getByTestId("auth-location")).toHaveTextContent(/^\/$/);
        // 사라진 로그인 화면이 채팅 이동을 실행하면 안 된다.
        expect(screen.queryByText("채팅 이동")).not.toBeInTheDocument();
    });

    // 사용자가 가입 중 홈으로 떠나면 늦은 성공이 채팅으로 끌어오지 않는지 확인한다.
    it("keeps the chosen route when registration succeeds after the page unmounts", async () => {
        // 회원가입 성공 Promise를 나중에 끝낼 함수를 보관한다.
        let resolveRegistration: ((user: User) => void) | undefined;
        // 회원가입 요청을 사용자가 홈으로 이동할 때까지 지연한다.
        authMocks.signUp.mockReturnValueOnce(
            new Promise<User>((resolve) => {
                // 테스트 바깥에서 성공시킬 함수를 저장한다.
                resolveRegistration = resolve;
            }),
        );

        // 실제 회원가입 경로에서 폼을 연다.
        renderAuthPage("/register");
        // 서버 길이 조건을 만족하는 사용자 이름을 입력한다.
        fireEvent.change(screen.getByLabelText("사용자 이름"), {
            // 가입 API에 보낼 username 값을 넣는다.
            target: { value: "auth-reader" },
        });
        // 기본 형식이 올바른 이메일을 입력한다.
        fireEvent.change(screen.getByLabelText("이메일"), {
            // 가입 API에 보낼 email 값을 넣는다.
            target: { value: "auth-reader@example.com" },
        });
        // 서버 길이 조건을 만족하는 비밀번호를 입력한다.
        fireEvent.change(screen.getByLabelText("비밀번호"), {
            // 테스트에서만 사용하는 비밀번호 값을 넣는다.
            target: { value: "password123" },
        });
        // 같은 비밀번호를 확인 입력에 넣는다.
        fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
            // 두 비밀번호가 일치하도록 같은 값을 넣는다.
            target: { value: "password123" },
        });
        // 회원가입 API 요청을 시작한다.
        fireEvent.click(screen.getByRole("button", { name: "계정 만들기" }));
        // 요청이 진행 중일 때 사용자가 상단 홈 링크로 직접 떠난다.
        fireEvent.click(screen.getByRole("link", { name: "EVERYTHING 홈" }));

        // 사용자가 선택한 홈 화면이 실제로 렌더링됐는지 확인한다.
        expect(await screen.findByText("홈 유지")).toBeInTheDocument();
        // 현재 내부 경로도 홈인지 확인한다.
        expect(screen.getByTestId("auth-location")).toHaveTextContent(/^\/$/);

        // 화면이 사라진 뒤 지연된 회원가입 요청을 성공시킨다.
        await act(async () => {
            // 서버가 공개 사용자 정보를 반환한 상황을 재현한다.
            resolveRegistration?.(authenticatedUser);
            // Promise 후속 처리가 끝날 한 차례를 기다린다.
            await Promise.resolve();
        });

        // 늦은 성공 뒤에도 사용자가 선택한 홈 경로가 유지돼야 한다.
        expect(screen.getByTestId("auth-location")).toHaveTextContent(/^\/$/);
        // 사라진 가입 화면이 채팅 이동을 실행하면 안 된다.
        expect(screen.queryByText("채팅 이동")).not.toBeInTheDocument();
    });
});
