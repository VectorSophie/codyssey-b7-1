// 질문 입력 상태와 폼 이벤트 타입을 불러온다.
import { useState } from "react";
// 앱 안에서 링크와 화면 이동을 처리하는 기능을 불러온다.
import { Link, useNavigate } from "react-router-dom";
// 서버 기준 로그인 상태를 읽는 Hook을 불러온다.
import { useAuth } from "../auth/AuthContext";
// 브라우저 탭 제목을 바꾸는 Hook을 불러온다.
import { useDocumentTitle } from "../lib/useDocumentTitle";

// 랜딩 화면에 보여줄 예시 질문 주제를 고정한다.
const EXAMPLE_QUESTIONS = [
    // 과학 분야의 구체적인 질문 예시다.
    "블랙홀은 왜 빛도 빠져나올 수 없나요?",
    // 역사 분야의 구체적인 질문 예시다.
    "로마 제국은 왜 동서로 나뉘었나요?",
    // 기술 분야의 구체적인 질문 예시다.
    "HTTP와 HTTPS는 무엇이 다른가요?",
    // 언어 분야의 구체적인 질문 예시다.
    "한글의 창제 원리를 쉽게 설명해줘",
] as const;

// 누구나 볼 수 있는 질문 중심 랜딩 화면을 만든다.
export function LandingPage() {
    // 사용자가 입력하거나 예시에서 고른 질문 초안을 보관한다.
    const [question, setQuestion] = useState("");
    // 공백 또는 길이 오류를 입력 영역 가까이에 표시한다.
    const [errorMessage, setErrorMessage] = useState("");
    // 로그인 여부에 따라 이동 경로를 정하기 위해 인증 상태를 읽는다.
    const { authError, retryAuthentication, status, user } = useAuth();
    // 폼 제출 뒤 새 화면으로 이동하는 함수를 준비한다.
    const navigate = useNavigate();
    // 현재 화면의 브라우저 탭 제목을 설정한다.
    useDocumentTitle("궁금한 건 무엇이든");

    // 랜딩 질문은 AI를 호출하지 않고 다음 화면의 초안으로만 전달한다.
    function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
        // 브라우저의 기본 페이지 새로고침을 막는다.
        event.preventDefault();
        // 앞뒤 공백을 제거한 실제 질문 초안을 만든다.
        const trimmedQuestion = question.trim();

        // 공백만 입력한 경우 다음 화면으로 이동하지 않는다.
        if (trimmedQuestion.length === 0) {
            // 사용자가 바로 수정할 수 있는 문장을 표시한다.
            setErrorMessage("질문을 입력해주세요.");
            // AI 요청이나 경로 이동 없이 함수를 끝낸다.
            return;
        }

        // 서버와 같은 2,000자 제한을 프론트에서도 확인한다.
        if (trimmedQuestion.length > 2000) {
            // 정확한 최대 길이를 텍스트로 알려준다.
            setErrorMessage("질문은 2,000자 이하로 입력해주세요.");
            // AI 요청이나 경로 이동 없이 함수를 끝낸다.
            return;
        }

        // 검증에 성공했으므로 이전 오류 문장을 지운다.
        setErrorMessage("");

        // 서버가 인증한 사용자는 채팅 입력칸으로 바로 이동한다.
        if (status === "authenticated") {
            // 질문은 state에 초안으로만 전달하고 자동 전송하지 않는다.
            navigate("/chat", { state: { pendingQuestion: trimmedQuestion } });
            // 로그인 경로로 중복 이동하지 않게 함수를 끝낸다.
            return;
        }

        // 비로그인 사용자는 로그인 뒤 채팅으로 갈 수 있게 안내한다.
        navigate("/login?next=/chat", {
            // 질문은 URL에 노출하지 않고 history state로만 전달한다.
            state: { pendingQuestion: trimmedQuestion },
        });
    }

    // 예시 질문을 실제 전송하지 않고 입력칸에만 채운다.
    function chooseExample(example: string): void {
        // 사용자가 검토하고 직접 제출할 수 있게 초안만 바꾼다.
        setQuestion(example);
        // 이전 입력 오류가 있다면 함께 지운다.
        setErrorMessage("");
    }

    // 짧고 집중된 랜딩 화면을 반환한다.
    return (
        // 전체 랜딩 화면의 미색 배경을 담당한다.
        <div className="landing-page">
            {/* 서비스 이름과 인증 링크를 담는 상단 내비게이션이다. */}
            <header className="landing-header">
                {/* 서비스 홈임을 알리는 텍스트 로고다. */}
                <Link className="wordmark" to="/" aria-label="EVERYTHING 홈">
                    {/* 다른 제품 자산을 쓰지 않은 자체 텍스트 정체성이다. */}
                    EVERYTHING
                </Link>
                {/* 인증 상태에 맞는 이동 수단을 제공한다. */}
                <nav className="landing-nav" aria-label="사용자 메뉴">
                    {/* 인증 확인 중에는 잘못된 링크 대신 상태를 표시한다. */}
                    {status === "checking" ? (
                        // 현재 수행 중인 동작을 과장 없이 표시한다.
                        <span className="nav-status">로그인 확인 중…</span>
                    ) : null}
                    {/* 인증 확인 실패는 비로그인으로 숨기지 않고 재확인 수단을 제공한다. */}
                    {status === "error" ? (
                        // 오류 문장과 재확인 버튼을 한 줄에 묶는다.
                        <div className="auth-links" role="status">
                            {/* API 계층이 정리한 안전한 문장을 짧게 표시한다. */}
                            <span className="nav-status nav-status--error" title={authError}>
                                서버 연결 오류
                            </span>
                            {/* 사용자가 원할 때만 인증 GET 요청을 다시 실행한다. */}
                            <button className="text-button" type="button" onClick={() => void retryAuthentication()}>
                                다시 확인
                            </button>
                        </div>
                    ) : null}
                    {/* 로그인 사용자는 자신의 이름과 채팅 링크를 본다. */}
                    {status === "authenticated" ? (
                        // 관리자 링크와 일반 채팅 링크를 함께 묶는다.
                        <div className="auth-links">
                            {/* 서버가 관리자라고 판정한 사용자에게만 운영 메뉴를 표시한다. */}
                            {user?.isAdmin ? (
                                <Link className="nav-link" to="/admin">관리자</Link>
                            ) : null}
                            {/* 채팅으로 이동하는 간결한 텍스트 링크다. */}
                            <Link className="nav-link" to="/chat">
                                {/* 현재 계정임을 알 수 있게 사용자 이름을 포함한다. */}
                                {user?.username}의 대화
                            </Link>
                        </div>
                    ) : null}
                    {/* 비로그인 사용자는 로그인과 회원가입 링크를 본다. */}
                    {status === "unauthenticated" ? (
                        // 두 인증 링크를 가로로 묶는다.
                        <div className="auth-links">
                            {/* 기존 계정 사용자를 로그인 화면으로 보낸다. */}
                            <Link className="nav-link" to="/login">
                                로그인
                            </Link>
                            {/* 새 사용자를 회원가입 화면으로 보낸다. */}
                            <Link className="button button--small" to="/register">
                                회원가입
                            </Link>
                        </div>
                    ) : null}
                </nav>
            </header>

            {/* 키보드 바로가기의 도착점이 되는 핵심 콘텐츠다. */}
            <main id="main-content" className="landing-main">
                {/* 백과사전처럼 차분한 소개 영역이다. */}
                <section className="landing-hero" aria-labelledby="landing-title">
                    {/* 제품 성격을 한 문장으로 먼저 설명한다. */}
                    <p className="eyebrow">대화형 백과사전</p>
                    {/* 가장 중요한 서비스 약속을 큰 제목으로 표시한다. */}
                    <h1 id="landing-title">궁금한 건 무엇이든.</h1>
                    {/* 질문 중심 서비스라는 짧은 보조 문구다. */}
                    <p className="landing-subtitle">질문으로 읽는 백과사전.</p>

                    {/* 질문을 검증한 뒤 다음 화면으로 이동하는 폼이다. */}
                    <form className="landing-search" onSubmit={handleSubmit} noValidate>
                        {/* 시각적으로 숨겨도 보조기술에는 남는 입력 설명이다. */}
                        <label className="visually-hidden" htmlFor="landing-question">
                            알고 싶은 질문
                        </label>
                        {/* 입력과 제출 버튼을 하나의 검색 도구처럼 묶는다. */}
                        <div className="landing-search__control">
                            {/* 사용자가 먼저 질문을 작성하는 큰 입력칸이다. */}
                            <input
                                // label과 입력을 연결하는 고유 번호다.
                                id="landing-question"
                                // 브라우저가 일반 텍스트 질문으로 인식하게 한다.
                                type="text"
                                // 제안 문구만 보여주고 실제 값으로 취급하지 않는다.
                                placeholder="무엇이 궁금한가요?"
                                // 현재 React 질문 상태를 입력칸에 표시한다.
                                value={question}
                                // 사용자의 입력을 React 상태에 반영한다.
                                onChange={(event) => {
                                    // 사용자의 새 입력을 질문 상태에 반영한다.
                                    setQuestion(event.target.value);
                                    // 수정이 시작되면 이전 입력 오류를 지운다.
                                    setErrorMessage("");
                                }}
                                // 서버 제한보다 긴 입력 자체를 브라우저에서도 막는다.
                                maxLength={2000}
                                // 검색 기록 자동완성으로 질문이 노출되는 것을 줄인다.
                                autoComplete="off"
                                // 화면 진입 시 질문이 가장 먼저 선택되게 한다.
                                autoFocus
                                // 오류 문장과 입력칸의 관계를 보조기술에 알린다.
                                aria-describedby="landing-error landing-character-count"
                                // 오류가 있을 때 입력 상태를 명확히 알린다.
                                aria-invalid={errorMessage.length > 0}
                            />
                            {/* 폼을 제출하되 여기서는 AI를 자동 호출하지 않는다. */}
                            <button className="landing-search__submit" type="submit">
                                {/* 버튼 동작을 텍스트로 명확하게 표현한다. */}
                                질문 시작
                            </button>
                        </div>
                        {/* 오류는 색상뿐 아니라 실제 문장으로 전달한다. */}
                        <p id="landing-error" className="form-error" role="alert">
                            {/* 오류가 없을 때도 영역을 유지해 레이아웃 흔들림을 줄인다. */}
                            {errorMessage || " "}
                        </p>
                        {/* 사용자가 현재 질문 길이를 확인할 수 있게 한다. */}
                        <p id="landing-character-count" className="character-count">
                            {/* 현재 글자 수와 최대 글자 수를 함께 표시한다. */}
                            {question.length.toLocaleString("ko-KR")} / 2,000
                        </p>
                    </form>

                    {/* 마케팅 카드 대신 실제 질문 예시만 조용히 제공한다. */}
                    <section className="example-questions" aria-labelledby="example-questions-title">
                        {/* 예시 영역의 목적을 짧게 설명한다. */}
                        <p id="example-questions-title">이런 질문으로 시작해보세요</p>
                        {/* 네 가지 예시를 실제 버튼으로 제공한다. */}
                        <div className="example-questions__list">
                            {/* 각 예시는 입력만 채우며 네트워크 요청을 만들지 않는다. */}
                            {EXAMPLE_QUESTIONS.map((example) => (
                                // 자동 전송을 피하기 위해 button 타입을 명시한다.
                                <button key={example} type="button" onClick={() => chooseExample(example)}>
                                    {/* 사용자가 선택 전에 내용을 읽을 수 있게 전체 문장을 표시한다. */}
                                    {example}
                                </button>
                            ))}
                        </div>
                    </section>
                </section>
            </main>

            {/* 페이지 성격을 짧게 정리하는 최소한의 하단 영역이다. */}
            <footer className="landing-footer">
                {/* AI 답변의 성격을 과장하지 않고 설명한다. */}
                <p>질문하고, 읽고, 이어서 알아가는 지식의 기록.</p>
            </footer>
        </div>
    );
}
