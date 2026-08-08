// 인증 Context를 실제 사용자 동작처럼 검사할 React Testing Library 기능을 불러온다.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
// 테스트 전 mock 정리와 결과 검증에 사용할 Vitest 기능을 불러온다.
import { beforeEach, describe, expect, it, vi } from "vitest";
// 인증 요청 실패 문장을 테스트 화면에 보관할 React 상태 기능을 불러온다.
import { useState } from "react";
// mock 대상으로 사용할 실제 API 모듈의 타입과 오류 클래스를 불러온다.
import * as apiClient from "../api/client";
// 테스트 사용자 객체의 타입만 불러온다.
import type { User } from "../types";

// 인증 Provider가 실제 네트워크 없이 요청 순서만 검증하도록 API 함수를 바꾼다.
vi.mock("../api/client", async () => {
    // 오류 클래스처럼 그대로 사용할 실제 모듈 부분을 불러온다.
    const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
    // 실제 타입과 오류 클래스는 유지하고 네트워크 함수만 mock으로 교체한다.
    return {
        // 원래 모듈의 공개 항목을 모두 유지한다.
        ...actual,
        // 현재 사용자 조회 결과를 테스트가 직접 정한다.
        getCurrentUser: vi.fn(),
        // 로그인 결과를 테스트가 직접 정한다.
        login: vi.fn(),
        // 로그아웃 결과를 테스트가 직접 정한다.
        logout: vi.fn(),
        // 회원가입 결과를 테스트가 직접 정한다.
        register: vi.fn(),
    };
});

// mock 준비 뒤 실제 인증 Provider와 Hook을 불러온다.
import { AuthProvider, useAuth } from "./AuthContext";

// 모든 테스트에서 재사용할 공개 사용자 정보를 만든다.
const testUser: User = {
    // 테스트 사용자 번호다.
    id: 7,
    // 화면에 표시할 테스트 사용자 이름이다.
    username: "context-reader",
    // 공개 이메일 필드의 테스트 값이다.
    email: "context-reader@example.com",
    // 화면 타입으로 변환된 계정 생성 시각이다.
    createdAt: "2026-08-08T15:00:00",
};

// 테스트가 인증 상태와 인증 동작을 화면 요소로 확인할 수 있게 만든다.
function AuthProbe() {
    // Provider가 제공하는 인증 값과 함수를 읽는다.
    const { authError, retryAuthentication, signIn, signUp, status, user } = useAuth();
    // 테스트가 인증 mutation 실패 문장을 확인할 지역 상태를 만든다.
    const [mutationError, setMutationError] = useState("");

    // 테스트가 접근 가능한 상태와 동작 버튼을 반환한다.
    return (
        <div>
            {/* 현재 인증 상태를 문자열로 표시한다. */}
            <p data-testid="auth-status">{status}</p>
            {/* 현재 사용자 이름 또는 빈 상태를 표시한다. */}
            <p data-testid="auth-user">{user?.username ?? "사용자 없음"}</p>
            {/* 인증 확인 실패의 안전한 오류 문장을 표시한다. */}
            <p data-testid="auth-error">{authError}</p>
            {/* 로그인 또는 회원가입 요청 자체의 안전한 오류 문장을 표시한다. */}
            <p data-testid="mutation-error">{mutationError}</p>
            {/* 사용자가 인증 확인을 명시적으로 다시 실행하는 버튼이다. */}
            <button type="button" onClick={() => void retryAuthentication()}>
                인증 재확인
            </button>
            {/* 초기 인증 확인 중에도 사용자가 로그인할 수 있는 상황을 재현한다. */}
            <button
                // 일반 버튼으로 지정해 예상 밖 폼 제출을 막는다.
                type="button"
                // 확정된 username과 password로 로그인 함수를 실행한다.
                onClick={() => {
                    // 테스트 시작 전에 이전 인증 요청 오류를 지운다.
                    setMutationError("");
                    // 로그인 Promise 실패도 테스트 화면에서 안전하게 처리한다.
                    void signIn({
                        // 실제 백엔드가 지원하는 username이다.
                        username: "context-reader",
                        // 테스트에서만 사용하는 충분히 긴 비밀번호다.
                        password: "password123",
                    }).catch((error: unknown) => {
                        // 실제 Error 객체의 안전한 문장만 테스트 화면에 표시한다.
                        setMutationError(error instanceof Error ? error.message : "알 수 없는 오류");
                    });
                }}
            >
                테스트 로그인
            </button>
            {/* 로그인과 동시에 회원가입이 실행되지 않는지 확인할 버튼이다. */}
            <button
                // 일반 버튼으로 지정해 예상 밖 폼 제출을 막는다.
                type="button"
                // 실제 회원가입 Context 함수를 테스트 값으로 실행한다.
                onClick={() => {
                    // 테스트 시작 전에 이전 인증 요청 오류를 지운다.
                    setMutationError("");
                    // 회원가입 Promise 실패도 테스트 화면에서 안전하게 처리한다.
                    void signUp({
                        // 테스트용 새 사용자 이름이다.
                        username: "new-context-reader",
                        // 테스트용 새 이메일 주소다.
                        email: "new-context-reader@example.com",
                        // 테스트에서만 사용하는 충분히 긴 비밀번호다.
                        password: "password123",
                    }).catch((error: unknown) => {
                        // 실제 Error 객체의 안전한 문장만 테스트 화면에 표시한다.
                        setMutationError(error instanceof Error ? error.message : "알 수 없는 오류");
                    });
                }}
            >
                테스트 회원가입
            </button>
        </div>
    );
}

// 각 테스트에서 Provider를 동일한 구조로 렌더링한다.
function renderAuthProvider(): void {
    // 실제 앱과 같이 Provider 안에 상태 확인 화면을 넣는다.
    render(
        <AuthProvider>
            {/* 테스트 전용 화면이 Context 값을 읽게 한다. */}
            <AuthProbe />
        </AuthProvider>,
    );
}

// 서버 인증 확인과 사용자 동작이 교차할 때 상태를 안전하게 유지하는지 검사한다.
describe("AuthProvider", () => {
    // 각 테스트 전에 이전 호출 결과와 구현을 모두 지운다.
    beforeEach(() => {
        // API mock의 호출 기록과 반환 구현을 초기화한다.
        vi.resetAllMocks();
    });

    // 서버가 인증 필요를 명시할 때만 비로그인 상태가 되는지 확인한다.
    it("treats AUTH_REQUIRED as unauthenticated", async () => {
        // 현재 사용자 조회가 실제 인증 만료 오류를 반환하게 한다.
        vi.mocked(apiClient.getCurrentUser).mockRejectedValueOnce(
            // 화면 분기에 필요한 인증 오류 코드를 사용한다.
            new apiClient.ApiRequestError("AUTH_REQUIRED", 401),
        );

        // Provider를 렌더링해 초기 /me 확인을 시작한다.
        renderAuthProvider();

        // 비동기 인증 확인이 끝나 비로그인 상태가 될 때까지 기다린다.
        await waitFor(() => {
            // AUTH_REQUIRED만 비로그인으로 분류해야 한다.
            expect(screen.getByTestId("auth-status")).toHaveTextContent("unauthenticated");
        });
        // 비로그인은 연결 오류가 아니므로 오류 문장이 비어 있어야 한다.
        expect(screen.getByTestId("auth-error")).toBeEmptyDOMElement();
    });

    // 네트워크 오류를 로그아웃으로 오인하지 않고 재시도할 수 있는지 확인한다.
    it("keeps authentication failures separate and supports an explicit retry", async () => {
        // 첫 조회는 연결 실패, 두 번째 조회는 로그인 사용자 성공으로 정한다.
        vi.mocked(apiClient.getCurrentUser)
            // 첫 인증 확인에서 안전한 네트워크 오류를 반환한다.
            .mockRejectedValueOnce(new apiClient.ApiRequestError("NETWORK_ERROR"))
            // 사용자가 누른 재확인에서는 로그인 사용자를 반환한다.
            .mockResolvedValueOnce(testUser);

        // Provider를 렌더링해 첫 인증 확인을 시작한다.
        renderAuthProvider();

        // 연결 실패가 별도 error 상태로 바뀔 때까지 기다린다.
        await waitFor(() => {
            // 네트워크 실패를 unauthenticated로 만들면 안 된다.
            expect(screen.getByTestId("auth-status")).toHaveTextContent("error");
        });
        // 원시 네트워크 정보 대신 안전한 사용자 문장만 표시해야 한다.
        expect(screen.getByTestId("auth-error")).toHaveTextContent(
            "서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.",
        );

        // 사용자가 명시적으로 인증 재확인 버튼을 누른다.
        fireEvent.click(screen.getByRole("button", { name: "인증 재확인" }));

        // 두 번째 서버 확인 성공으로 인증 상태가 될 때까지 기다린다.
        await waitFor(() => {
            // 유효한 서버 사용자면 보호 화면을 열 수 있어야 한다.
            expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");
        });
        // 서버가 확인한 사용자 이름이 상태에 저장됐는지 확인한다.
        expect(screen.getByTestId("auth-user")).toHaveTextContent("context-reader");
        // 재시도 성공 뒤 이전 연결 오류가 지워졌는지 확인한다.
        expect(screen.getByTestId("auth-error")).toBeEmptyDOMElement();
    });

    // 느린 초기 /me 오류가 더 최신 로그인 성공을 덮지 못하는지 확인한다.
    it("ignores a stale initial session response after login succeeds", async () => {
        // 지연된 초기 조회를 나중에 실패시킬 함수를 보관한다.
        let rejectInitialRequest: ((reason?: unknown) => void) | undefined;
        // 첫 /me 요청을 테스트가 원하는 시점까지 끝나지 않는 Promise로 만든다.
        vi.mocked(apiClient.getCurrentUser).mockReturnValueOnce(
            new Promise<User>((_resolve, reject) => {
                // Promise 실패 함수를 바깥 테스트에서 호출할 수 있게 저장한다.
                rejectInitialRequest = reject;
            }),
        );
        // 사용자가 실행한 로그인 요청은 바로 성공하게 한다.
        vi.mocked(apiClient.login).mockResolvedValueOnce(testUser);

        // Provider를 렌더링해 느린 초기 /me 요청을 시작한다.
        renderAuthProvider();
        // 초기 서버 확인이 아직 진행 중인지 확인한다.
        expect(screen.getByTestId("auth-status")).toHaveTextContent("checking");

        // 초기 조회가 끝나기 전에 사용자가 로그인을 성공시킨다.
        fireEvent.click(screen.getByRole("button", { name: "테스트 로그인" }));

        // 로그인 성공이 최신 인증 상태로 반영될 때까지 기다린다.
        await waitFor(() => {
            // 보호 화면을 열 수 있는 인증 상태여야 한다.
            expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");
        });
        // 로그인 API가 반환한 사용자 이름이 저장됐는지 확인한다.
        expect(screen.getByTestId("auth-user")).toHaveTextContent("context-reader");

        // 뒤늦은 초기 /me 오류를 React 상태 갱신 범위 안에서 도착시킨다.
        await act(async () => {
            // 실제로 가장 위험한 뒤늦은 401 오류를 반환한다.
            rejectInitialRequest?.(new apiClient.ApiRequestError("AUTH_REQUIRED", 401));
            // Promise catch와 상태 분기가 실행될 한 차례를 기다린다.
            await Promise.resolve();
        });

        // 오래된 오류가 최신 로그인 상태를 덮지 않았는지 확인한다.
        expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");
        // 최신 로그인 사용자도 그대로 유지돼야 한다.
        expect(screen.getByTestId("auth-user")).toHaveTextContent("context-reader");
    });

    // 초기 확인 중 로그인 실패가 checking 상태를 영구적으로 남기지 않는지 확인한다.
    it("rechecks the session when login fails during the initial authentication check", async () => {
        // 무효화될 첫 /me 요청을 나중에 끝낼 실패 함수를 보관한다.
        let rejectInitialRequest: ((reason?: unknown) => void) | undefined;
        // 첫 조회는 지연하고 로그인 실패 뒤 두 번째 조회는 비로그인으로 정한다.
        vi.mocked(apiClient.getCurrentUser)
            // 초기 /me 요청을 원하는 시점까지 보류한다.
            .mockReturnValueOnce(
                new Promise<User>((_resolve, reject) => {
                    // 오래된 Promise를 마지막에 정리할 실패 함수를 저장한다.
                    rejectInitialRequest = reject;
                }),
            )
            // 로그인 실패 뒤 재확인은 정상적인 비로그인 오류를 반환한다.
            .mockRejectedValueOnce(new apiClient.ApiRequestError("AUTH_REQUIRED", 401));
        // 사용자가 입력한 로그인 정보는 서버에서 거절되게 한다.
        vi.mocked(apiClient.login).mockRejectedValueOnce(
            // 실제 로그인 실패 코드와 상태를 사용한다.
            new apiClient.ApiRequestError("INVALID_CREDENTIALS", 401),
        );

        // Provider를 렌더링해 느린 초기 /me 요청을 시작한다.
        renderAuthProvider();
        // 초기 확인이 끝나기 전에 실패할 로그인을 실행한다.
        fireEvent.click(screen.getByRole("button", { name: "테스트 로그인" }));

        // 로그인 실패 뒤 새 /me가 끝나 비로그인 상태가 될 때까지 기다린다.
        await waitFor(() => {
            // 앱이 checking에 멈추지 않고 비로그인 폼을 사용할 수 있어야 한다.
            expect(screen.getByTestId("auth-status")).toHaveTextContent("unauthenticated");
        });
        // 로그인 API 실패 문장이 원시 서버 정보 없이 표시되는지 확인한다.
        expect(screen.getByTestId("mutation-error")).toHaveTextContent(
            "사용자 이름 또는 비밀번호가 올바르지 않습니다.",
        );
        // 초기 확인과 복구 확인이 각각 한 번씩 실행됐는지 확인한다.
        expect(apiClient.getCurrentUser).toHaveBeenCalledTimes(2);

        // 아직 남은 오래된 첫 /me Promise를 React 처리 범위에서 끝낸다.
        await act(async () => {
            // 늦은 401이 최신 비로그인 상태를 다시 바꾸지 않게 한다.
            rejectInitialRequest?.(new apiClient.ApiRequestError("AUTH_REQUIRED", 401));
            // Promise catch가 실행될 한 차례를 기다린다.
            await Promise.resolve();
        });
        // 오래된 응답 뒤에도 복구된 상태가 그대로인지 확인한다.
        expect(screen.getByTestId("auth-status")).toHaveTextContent("unauthenticated");
    });

    // 로그인과 회원가입이 동시에 세션 쿠키를 바꾸지 못하는지 확인한다.
    it("allows only one authentication mutation at a time", async () => {
        // 첫 로그인 요청을 나중에 성공시킬 함수를 보관한다.
        let resolveLoginRequest: ((user: User) => void) | undefined;
        // 초기 인증 확인은 정상적인 비로그인 상태로 끝낸다.
        vi.mocked(apiClient.getCurrentUser).mockRejectedValueOnce(
            // 세션이 없음을 뜻하는 실제 오류를 사용한다.
            new apiClient.ApiRequestError("AUTH_REQUIRED", 401),
        );
        // 로그인 API는 사용자가 회원가입을 누를 때까지 진행 중으로 둔다.
        vi.mocked(apiClient.login).mockReturnValueOnce(
            new Promise<User>((resolve) => {
                // 첫 인증 요청을 마지막에 성공시킬 함수를 저장한다.
                resolveLoginRequest = resolve;
            }),
        );

        // Provider를 렌더링해 초기 비로그인 확인을 시작한다.
        renderAuthProvider();
        // 비로그인 상태가 확정될 때까지 기다린다.
        await waitFor(() => {
            // 인증 mutation을 시작할 수 있는 상태인지 확인한다.
            expect(screen.getByTestId("auth-status")).toHaveTextContent("unauthenticated");
        });

        // 첫 로그인 요청을 시작하고 응답은 아직 끝내지 않는다.
        fireEvent.click(screen.getByRole("button", { name: "테스트 로그인" }));
        // 같은 Provider에서 회원가입 요청을 바로 이어서 시도한다.
        fireEvent.click(screen.getByRole("button", { name: "테스트 회원가입" }));

        // 두 번째 인증 요청이 서버 호출 전에 막혔는지 확인한다.
        await waitFor(() => {
            // 사용자가 잠시 기다려야 함을 안전한 문장으로 알려야 한다.
            expect(screen.getByTestId("mutation-error")).toHaveTextContent(
                "다른 로그인 요청을 처리하고 있습니다. 잠시 후 다시 시도해주세요.",
            );
        });
        // 실제 회원가입 API는 한 번도 호출되면 안 된다.
        expect(apiClient.register).not.toHaveBeenCalled();

        // 첫 로그인 응답을 React 상태 갱신 범위 안에서 성공시킨다.
        await act(async () => {
            // 서버가 공개 사용자와 세션 쿠키를 반환한 상황을 만든다.
            resolveLoginRequest?.(testUser);
            // 로그인 성공 상태가 반영될 Promise 처리를 기다린다.
            await Promise.resolve();
        });
        // 실제 쿠키를 만든 첫 로그인 사용자만 전역 상태에 남아야 한다.
        expect(screen.getByTestId("auth-user")).toHaveTextContent("context-reader");
    });
});
