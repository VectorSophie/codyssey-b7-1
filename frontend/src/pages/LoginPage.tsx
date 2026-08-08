// 폼 입력, 화면 생존 여부, 제출 상태를 관리하는 기능을 불러온다.
import { useEffect, useRef, useState } from "react";
// 인증 상태에 따른 링크, 이동, 현재 주소 기능을 불러온다.
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
// API 오류를 안전하게 구분하는 클래스를 불러온다.
import { ApiRequestError } from "../api/client";
// 전역 로그인 상태와 실행 함수를 불러온다.
import { useAuth } from "../auth/AuthContext";
// 이동 state와 다음 경로를 안전하게 읽는 함수를 불러온다.
import { readPendingQuestion, readSafeNextPath } from "../lib/navigationState";
// 브라우저 탭 제목을 바꾸는 Hook을 불러온다.
import { useDocumentTitle } from "../lib/useDocumentTitle";

// 기존 계정 사용자가 서버 세션을 만드는 화면이다.
export function LoginPage() {
    // 실제 백엔드가 지원하는 사용자 이름을 보관한다.
    const [username, setUsername] = useState("");
    // 비밀번호는 현재 컴포넌트 메모리에만 잠시 보관한다.
    const [password, setPassword] = useState("");
    // 폼 가까이에 표시할 안전한 오류 문장을 보관한다.
    const [errorMessage, setErrorMessage] = useState("");
    // 중복 로그인 요청을 막는 제출 상태다.
    const [isSubmitting, setIsSubmitting] = useState(false);
    // 화면을 떠난 뒤 늦은 로그인 응답이 URL을 바꾸지 못하게 생존 여부를 보관한다.
    const isMountedRef = useRef(true);
    // 서버 기준 로그인 상태와 로그인 함수를 읽는다.
    const { status, signIn } = useAuth();
    // 이전 화면의 질문 초안과 query string을 읽는다.
    const location = useLocation();
    // 로그인 성공 뒤 안전한 내부 경로로 이동할 함수를 준비한다.
    const navigate = useNavigate();
    // 현재 화면의 브라우저 탭 제목을 설정한다.
    useDocumentTitle("로그인");
    // URL에 노출되지 않은 질문 초안만 안전하게 읽는다.
    const pendingQuestion = readPendingQuestion(location.state);
    // 외부 리다이렉트를 막고 채팅 경로만 허용한다.
    const nextPath = readSafeNextPath(location.search);

    // 로그인 화면이 사라질 때 늦은 비동기 UI 처리를 무효화한다.
    useEffect(() => {
        // 개발 환경의 effect 재실행에서도 현재 화면이 살아 있음을 기록한다.
        isMountedRef.current = true;

        // 다른 경로로 이동하면 이전 로그인 화면이 상태와 URL을 바꾸지 않는다.
        return () => {
            // 이후 도착한 로그인 응답의 화면 처리를 막는다.
            isMountedRef.current = false;
        };
    }, []);

    // 이미 로그인한 사용자는 로그인 폼을 다시 볼 필요가 없다.
    if (status === "authenticated") {
        // 질문 초안을 유지한 채 채팅 화면으로 이동한다.
        return <Navigate to={nextPath} replace state={{ pendingQuestion }} />;
    }

    // 입력값을 확인한 뒤 로그인 API를 정확히 한 번 호출한다.
    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        // 브라우저 기본 새로고침 제출을 막는다.
        event.preventDefault();

        // 이미 요청 중이면 더블클릭이나 Enter 반복을 무시한다.
        if (isSubmitting) {
            // 두 번째 네트워크 요청 없이 함수를 끝낸다.
            return;
        }

        // 서버와 동일하게 사용할 사용자 이름의 앞뒤 공백을 제거한다.
        const trimmedUsername = username.trim();

        // 사용자 이름과 비밀번호가 모두 입력됐는지 확인한다.
        if (trimmedUsername.length === 0 || password.length === 0) {
            // 비어 있는 인증 정보를 명확한 문장으로 안내한다.
            setErrorMessage("사용자 이름과 비밀번호를 모두 입력해주세요.");
            // 서버 요청 없이 함수를 끝낸다.
            return;
        }

        // 검증이 끝났으므로 기존 오류를 지운다.
        setErrorMessage("");
        // 버튼과 입력을 잠가 중복 요청을 막는다.
        setIsSubmitting(true);

        // 서버 세션 생성을 시도한다.
        try {
            // 실제 백엔드 계약인 username과 password만 보낸다.
            await signIn({ username: trimmedUsername, password });

            // 사용자가 이미 로그인 화면을 떠났다면 현재 경로를 유지한다.
            if (!isMountedRef.current) {
                // 서버 세션은 유지하고 이전 화면의 지역 상태와 URL만 바꾸지 않는다.
                return;
            }

            // 성공 뒤 비밀번호 상태를 즉시 비운다.
            setPassword("");
            // 질문은 채팅 입력칸 초안으로만 전달하고 자동 전송하지 않는다.
            navigate(nextPath, { replace: true, state: { pendingQuestion } });
        } catch (error: unknown) {
            // 사용자가 이미 로그인 화면을 떠났다면 오류 UI를 만들지 않는다.
            if (!isMountedRef.current) {
                // 현재 다른 화면의 상태를 건드리지 않고 처리를 끝낸다.
                return;
            }

            // 실패한 비밀번호가 화면 상태에 계속 남지 않게 지운다.
            setPassword("");

            // API 오류면 준비된 안전한 사용자 문장만 표시한다.
            if (error instanceof ApiRequestError) {
                // 원시 서버 응답이나 stack trace는 화면에 표시하지 않는다.
                setErrorMessage(error.message);
            } else {
                // 예상 밖 오류도 일반 문장으로 숨긴다.
                setErrorMessage("예상하지 못한 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        } finally {
            // 현재 로그인 화면이 살아 있을 때만 폼 잠금을 해제한다.
            if (isMountedRef.current) {
                // 성공과 실패 모두에서 폼을 다시 조작할 수 있게 한다.
                setIsSubmitting(false);
            }
        }
    }

    // 조용하고 집중된 로그인 화면을 반환한다.
    return (
        // 인증 화면 공통 배경과 배치를 적용한다.
        <div className="auth-page">
            {/* 서비스 홈으로 돌아가는 상단 텍스트 정체성이다. */}
            <header className="auth-header">
                {/* 다른 제품 자산을 쓰지 않은 자체 텍스트 로고다. */}
                <Link className="wordmark" to="/" aria-label="EVERYTHING 홈">
                    EVERYTHING
                </Link>
            </header>

            {/* 키보드 바로가기의 도착점이 되는 로그인 본문이다. */}
            <main id="main-content" className="auth-main">
                {/* 폼의 목적을 제목과 설명으로 먼저 알린다. */}
                <section className="auth-panel" aria-labelledby="login-title">
                    {/* 화면 종류를 짧게 표시한다. */}
                    <p className="eyebrow">다시 이어가기</p>
                    {/* 로그인 폼을 설명하는 핵심 제목이다. */}
                    <h1 id="login-title">로그인</h1>
                    {/* 로그인해야 기록과 대화를 사용할 수 있음을 설명한다. */}
                    <p className="auth-description">나의 질문과 답변 기록을 이어서 읽습니다.</p>

                    {/* 인증 정보를 안전하게 서버로 전송하는 폼이다. */}
                    <form className="auth-form" onSubmit={handleSubmit}>
                        {/* 사용자 이름 입력과 실제 label을 묶는다. */}
                        <div className="field-group">
                            {/* placeholder에 의존하지 않는 입력 설명이다. */}
                            <label htmlFor="login-username">사용자 이름</label>
                            {/* 실제 백엔드가 지원하는 username을 입력받는다. */}
                            <input
                                // label과 연결할 고유 번호다.
                                id="login-username"
                                // 일반 텍스트 사용자 이름으로 입력받는다.
                                type="text"
                                // 브라우저 비밀번호 관리자가 사용자 이름으로 인식한다.
                                autoComplete="username"
                                // 현재 React 상태를 입력칸에 표시한다.
                                value={username}
                                // 사용자의 입력을 React 상태에 반영한다.
                                onChange={(event) => {
                                    // 사용자의 새 입력을 사용자 이름 상태에 반영한다.
                                    setUsername(event.target.value);
                                    // 수정이 시작되면 이전 폼 오류를 지운다.
                                    setErrorMessage("");
                                }}
                                // 빈 값의 기본 폼 제출도 브라우저에서 막는다.
                                required
                                // 제출 중에는 중복 입력과 요청을 막는다.
                                disabled={isSubmitting}
                                // 오류 영역과 입력의 관계를 보조기술에 알린다.
                                aria-describedby="login-error"
                                // 처음 화면에서 바로 사용자 이름을 입력할 수 있게 한다.
                                autoFocus
                            />
                        </div>

                        {/* 비밀번호 입력과 실제 label을 묶는다. */}
                        <div className="field-group">
                            {/* 비밀번호 입력 목적을 명확히 알린다. */}
                            <label htmlFor="login-password">비밀번호</label>
                            {/* 입력 문자가 화면에 그대로 보이지 않게 한다. */}
                            <input
                                // label과 연결할 고유 번호다.
                                id="login-password"
                                // 브라우저가 입력 문자를 가려서 표시한다.
                                type="password"
                                // 비밀번호 관리자가 기존 비밀번호로 인식한다.
                                autoComplete="current-password"
                                // 현재 컴포넌트의 비밀번호 상태를 표시한다.
                                value={password}
                                // 입력을 현재 컴포넌트 메모리에만 반영한다.
                                onChange={(event) => {
                                    // 사용자의 새 입력을 비밀번호 상태에 반영한다.
                                    setPassword(event.target.value);
                                    // 수정이 시작되면 이전 폼 오류를 지운다.
                                    setErrorMessage("");
                                }}
                                // 빈 비밀번호 제출을 브라우저에서도 막는다.
                                required
                                // 제출 중에는 중복 입력과 요청을 막는다.
                                disabled={isSubmitting}
                                // 오류 영역과 입력의 관계를 보조기술에 알린다.
                                aria-describedby="login-error"
                            />
                        </div>

                        {/* 오류는 색상뿐 아니라 실제 문장으로 제공한다. */}
                        <p id="login-error" className="form-error" role="alert">
                            {/* 오류가 없을 때도 공간을 유지한다. */}
                            {errorMessage || " "}
                        </p>

                        {/* 폼 전체를 서버에 제출하는 명시적 버튼이다. */}
                        <button className="button button--primary button--full" type="submit" disabled={isSubmitting}>
                            {/* 요청 상태를 사용자가 바로 알 수 있게 문구를 바꾼다. */}
                            {isSubmitting ? "로그인하는 중…" : "로그인"}
                        </button>
                    </form>

                    {/* 계정이 없는 사용자를 회원가입 화면으로 안내한다. */}
                    <p className="auth-switch">
                        {/* 질문 초안이 있으면 다음 화면에서도 유지한다. */}
                        처음인가요?{" "}
                        <Link to="/register" state={{ pendingQuestion }}>
                            회원가입
                        </Link>
                    </p>
                </section>
            </main>
        </div>
    );
}
