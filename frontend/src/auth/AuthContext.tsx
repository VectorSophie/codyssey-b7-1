// React에서 전역 인증 상태를 만들 때 필요한 기능을 불러온다.
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
// 자식 컴포넌트 타입만 별도로 불러온다.
import type { ReactNode } from "react";
// 실제 서버 인증 API 함수를 불러온다.
import {
    ApiRequestError,
    getCurrentUser,
    login as requestLogin,
    logout as requestLogout,
    register as requestRegister,
} from "../api/client";
// 로그인 요청과 사용자 정보 타입을 불러온다.
import type { LoginInput, RegisterInput, User } from "../types";

// 앱이 구분할 인증 확인 상태를 네 가지로 제한한다.
type AuthStatus = "checking" | "authenticated" | "unauthenticated" | "error";

// 모든 화면이 인증 상태를 사용할 때 필요한 값을 정의한다.
interface AuthContextValue {
    // 로그인한 사용자 또는 비로그인 상태를 보관한다.
    user: User | null;
    // 서버 확인이 끝났는지 판단할 현재 상태다.
    status: AuthStatus;
    // 인증 확인 자체가 실패했을 때 표시할 안전한 문장이다.
    authError: string;
    // 사용자가 서버 인증 확인을 다시 실행하는 함수다.
    retryAuthentication: () => Promise<void>;
    // 로그인 폼이 호출할 서버 로그인 함수다.
    signIn: (input: LoginInput) => Promise<User>;
    // 회원가입 폼이 호출할 서버 가입 함수다.
    signUp: (input: RegisterInput) => Promise<User>;
    // API가 세션 만료를 알렸을 때 인증 상태를 정리하는 함수다.
    expireSession: () => void;
    // 로그아웃 버튼이 호출할 서버 로그아웃 함수다.
    signOut: () => Promise<void>;
}

// Provider 밖에서 잘못 사용한 경우를 찾기 위해 초기값을 비워 둔다.
const AuthContext = createContext<AuthContextValue | null>(null);

// 앱 전체에 서버 기준 인증 상태를 제공한다.
export function AuthProvider({ children }: { children: ReactNode }) {
    // 현재 사용자 정보는 처음에 알 수 없으므로 null로 시작한다.
    const [user, setUser] = useState<User | null>(null);
    // 첫 화면에서 서버 세션을 확인하는 중임을 표시한다.
    const [status, setStatus] = useState<AuthStatus>("checking");
    // 네트워크나 서버 문제를 비로그인과 구분해 보관한다.
    const [authError, setAuthError] = useState("");
    // 오래된 인증 응답이 최신 로그인 상태를 덮지 못하게 번호를 보관한다.
    const authRequestVersionRef = useRef(0);
    // 로그인과 회원가입이 동시에 세션 쿠키를 바꾸지 못하게 전역 잠금을 보관한다.
    const authMutationLockRef = useRef(false);

    // HttpOnly 쿠키를 서버에서 검증하고 네트워크 오류를 별도로 처리한다.
    const retryAuthentication = useCallback(async (): Promise<void> => {
        // 현재 인증 조회가 최신인지 구분할 번호를 하나 증가시킨다.
        const requestVersion = authRequestVersionRef.current + 1;
        // 다음 로그인 동작이 이전 응답을 무효화할 수 있게 번호를 저장한다.
        authRequestVersionRef.current = requestVersion;
        // 재확인 중임을 모든 화면에 알린다.
        setStatus("checking");
        // 이전 연결 오류 문장을 지운다.
        setAuthError("");

        // 실제 서버 사용자 조회를 시도한다.
        try {
            // 쿠키가 유효하면 서버가 현재 사용자를 반환한다.
            const currentUser = await getCurrentUser();

            // 더 최신 로그인이나 재확인이 시작됐다면 오래된 결과를 버린다.
            if (authRequestVersionRef.current !== requestVersion) {
                // 현재 인증 상태를 바꾸지 않고 함수를 끝낸다.
                return;
            }

            // 서버가 확인한 공개 사용자 정보를 저장한다.
            setUser(currentUser);
            // 보호된 화면을 열 수 있는 상태로 바꾼다.
            setStatus("authenticated");
        } catch (error: unknown) {
            // 더 최신 로그인이나 재확인이 시작됐다면 오래된 오류를 버린다.
            if (authRequestVersionRef.current !== requestVersion) {
                // 현재 인증 상태를 바꾸지 않고 함수를 끝낸다.
                return;
            }

            // 서버가 명시한 AUTH_REQUIRED만 실제 비로그인으로 처리한다.
            if (error instanceof ApiRequestError && error.code === "AUTH_REQUIRED") {
                // 유효한 사용자가 없음을 명확히 저장한다.
                setUser(null);
                // 로그인과 회원가입을 사용할 수 있는 상태로 바꾼다.
                setStatus("unauthenticated");
                // 비로그인은 연결 오류가 아니므로 오류 문장을 비운다.
                setAuthError("");
                // 다른 오류 처리 없이 함수를 끝낸다.
                return;
            }

            // 네트워크나 서버 오류가 인증 정보를 없다고 단정하지 않게 한다.
            setStatus("error");
            // API 계층이 정리한 안전한 문장만 보관한다.
            setAuthError(
                error instanceof ApiRequestError
                    ? error.message
                    : "로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
            );
        }
    }, []);

    // 앱이 처음 열릴 때 서버 인증 확인을 한 번 시작한다.
    useEffect(() => {
        // 최신 인증 확인 함수를 실행한다.
        void retryAuthentication();

        // Provider가 사라지면 진행 중 응답을 오래된 것으로 만든다.
        return () => {
            // 이후 도착한 응답이 상태를 바꾸지 못하게 번호를 증가시킨다.
            authRequestVersionRef.current += 1;
        };
    }, [retryAuthentication]);

    // 로그인 폼이 성공한 사용자 정보를 전역 상태에 반영한다.
    async function signIn(input: LoginInput): Promise<User> {
        // 다른 화면에서 이미 로그인이나 회원가입을 처리 중인지 확인한다.
        if (authMutationLockRef.current) {
            // 두 Set-Cookie 응답이 교차하지 않도록 두 번째 요청을 서버 전에 막는다.
            throw new ApiRequestError("AUTH_IN_PROGRESS");
        }

        // React state 반영 전 같은 순간의 다른 인증 요청도 막는다.
        authMutationLockRef.current = true;
        // 진행 중인 초기 /me 응답을 오래된 것으로 만드는 번호를 발급한다.
        const requestVersion = authRequestVersionRef.current + 1;
        // 로그인 요청을 가장 최신 인증 동작으로 기록한다.
        authRequestVersionRef.current = requestVersion;
        try {
            // 서버에 비밀번호를 한 번 전송하고 사용자 정보를 받는다.
            const authenticatedUser = await requestLogin(input);
            // 더 최신 인증 동작이 시작됐다면 오래된 로그인 결과를 적용하지 않는다.
            if (authRequestVersionRef.current !== requestVersion) {
                // 호출한 폼에는 서버가 반환한 사용자 정보만 전달한다.
                return authenticatedUser;
            }
            // 비밀번호가 없는 공개 사용자 정보만 상태에 저장한다.
            setUser(authenticatedUser);
            // 보호된 채팅 화면을 열 수 있는 상태로 바꾼다.
            setStatus("authenticated");
            // 이전 인증 확인 오류를 지운다.
            setAuthError("");
            // 로그인 화면이 다음 경로로 이동할 수 있게 사용자를 반환한다.
            return authenticatedUser;
        } catch (error: unknown) {
            // 이 로그인이 최신이고 초기 확인 중이었다면 서버 상태를 다시 확인한다.
            if (authRequestVersionRef.current === requestVersion && status === "checking") {
                // 무효화된 초기 /me 대신 새 인증 조회를 백그라운드에서 시작한다.
                void retryAuthentication();
            }

            // 로그인 폼이 실제 실패 원인을 안전하게 표시하도록 같은 오류를 전달한다.
            throw error;
        } finally {
            // 성공과 실패 모두에서 다음 인증 요청을 다시 허용한다.
            authMutationLockRef.current = false;
        }
    }

    // 회원가입 뒤 서버가 설정한 세션을 전역 상태에 즉시 반영한다.
    async function signUp(input: RegisterInput): Promise<User> {
        // 다른 화면에서 이미 로그인이나 회원가입을 처리 중인지 확인한다.
        if (authMutationLockRef.current) {
            // 두 Set-Cookie 응답이 교차하지 않도록 두 번째 요청을 서버 전에 막는다.
            throw new ApiRequestError("AUTH_IN_PROGRESS");
        }

        // React state 반영 전 같은 순간의 다른 인증 요청도 막는다.
        authMutationLockRef.current = true;
        // 진행 중인 초기 /me 응답을 오래된 것으로 만드는 번호를 발급한다.
        const requestVersion = authRequestVersionRef.current + 1;
        // 회원가입 요청을 가장 최신 인증 동작으로 기록한다.
        authRequestVersionRef.current = requestVersion;
        try {
            // 서버에 가입 정보를 한 번 전송하고 공개 사용자 정보를 받는다.
            const registeredUser = await requestRegister(input);
            // 더 최신 인증 동작이 시작됐다면 오래된 가입 결과를 적용하지 않는다.
            if (authRequestVersionRef.current !== requestVersion) {
                // 호출한 폼에는 서버가 반환한 사용자 정보만 전달한다.
                return registeredUser;
            }
            // 비밀번호가 없는 공개 사용자 정보만 상태에 저장한다.
            setUser(registeredUser);
            // 백엔드가 세션 쿠키를 설정했으므로 인증 상태로 바꾼다.
            setStatus("authenticated");
            // 이전 인증 확인 오류를 지운다.
            setAuthError("");
            // 회원가입 화면이 채팅으로 이동할 수 있게 사용자를 반환한다.
            return registeredUser;
        } catch (error: unknown) {
            // 이 가입이 최신이고 초기 확인 중이었다면 서버 상태를 다시 확인한다.
            if (authRequestVersionRef.current === requestVersion && status === "checking") {
                // 무효화된 초기 /me 대신 새 인증 조회를 백그라운드에서 시작한다.
                void retryAuthentication();
            }

            // 회원가입 폼이 실제 실패 원인을 안전하게 표시하도록 같은 오류를 전달한다.
            throw error;
        } finally {
            // 성공과 실패 모두에서 다음 인증 요청을 다시 허용한다.
            authMutationLockRef.current = false;
        }
    }

    // 보호 API가 AUTH_REQUIRED를 반환하면 만료된 인증 상태를 정리한다.
    function expireSession(): void {
        // 진행 중인 인증 응답을 모두 오래된 것으로 만든다.
        authRequestVersionRef.current += 1;
        // 더 이상 유효하지 않은 공개 사용자 정보를 지운다.
        setUser(null);
        // 로그인 화면으로 이동할 수 있는 비로그인 상태로 바꾼다.
        setStatus("unauthenticated");
        // 세션 만료는 연결 오류가 아니므로 오류 문장을 비운다.
        setAuthError("");
    }

    // 서버가 세션 쿠키를 삭제한 뒤에만 전역 인증 상태를 정리한다.
    async function signOut(): Promise<void> {
        // 진행 중인 인증 응답을 모두 오래된 것으로 만든다.
        authRequestVersionRef.current += 1;
        // 쿠키 삭제 요청이 성공할 때까지 현재 화면 상태를 유지한다.
        await requestLogout();
        // 서버 로그아웃 성공 뒤 공개 사용자 정보를 지운다.
        setUser(null);
        // 보호된 화면을 닫는 비로그인 상태로 전환한다.
        setStatus("unauthenticated");
        // 성공한 로그아웃 뒤 인증 오류 문장을 지운다.
        setAuthError("");
    }

    // 상태가 바뀔 때만 Context 객체를 새로 만들어 불필요한 렌더를 줄인다.
    const contextValue = useMemo<AuthContextValue>(() => {
        // 하위 화면에서 사용할 인증 값과 함수를 하나로 묶는다.
        return {
            // 공개 사용자 정보 또는 null을 제공한다.
            user,
            // 서버 인증 확인 상태를 제공한다.
            status,
            // 인증 확인 실패의 안전한 문장을 제공한다.
            authError,
            // 서버 인증 확인을 다시 실행하는 함수를 제공한다.
            retryAuthentication,
            // 로그인 실행 함수를 제공한다.
            signIn,
            // 회원가입 실행 함수를 제공한다.
            signUp,
            // 만료된 서버 세션을 정리하는 함수를 제공한다.
            expireSession,
            // 로그아웃 실행 함수를 제공한다.
            signOut,
        };
    }, [authError, retryAuthentication, status, user]);

    // 모든 자식 화면이 동일한 인증 상태를 읽을 수 있게 감싼다.
    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

// 각 화면에서 인증 Context를 안전하게 꺼내 쓰는 Hook이다.
export function useAuth(): AuthContextValue {
    // 가장 가까운 AuthProvider가 제공한 값을 읽는다.
    const context = useContext(AuthContext);

    // Provider 없이 사용한 개발 실수를 즉시 알린다.
    if (context === null) {
        // 민감정보 없는 고정 개발 오류 문장만 던진다.
        throw new Error("useAuth must be used inside AuthProvider");
    }

    // 검증된 인증 상태와 함수를 호출한 화면에 반환한다.
    return context;
}
