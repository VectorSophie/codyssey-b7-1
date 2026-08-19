// 화면 이동 state를 검사할 때 사용할 객체 타입이다.
type NavigationRecord = Record<string, unknown>;

// 알 수 없는 값이 일반 객체인지 확인한다.
function isNavigationRecord(value: unknown): value is NavigationRecord {
    // null과 배열을 제외한 객체만 안전한 state 객체로 인정한다.
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 화면 이동 state에서 자동 전송하지 않을 질문 초안을 읽는다.
export function readPendingQuestion(state: unknown): string {
    // state가 객체가 아니면 질문이 없는 것으로 처리한다.
    if (!isNavigationRecord(state)) {
        // 빈 초안을 반환해 예상 밖 값을 무시한다.
        return "";
    }

    // pendingQuestion이 문자열인지 확인한다.
    if (typeof state.pendingQuestion !== "string") {
        // 문자열이 아니면 화면에 표시하지 않는다.
        return "";
    }

    // 서버 제한을 넘지 않는 문자열만 질문 초안으로 사용한다.
    return state.pendingQuestion.slice(0, 2000);
}

// query string의 다음 경로를 안전한 내부 경로로 제한한다.
export function readSafeNextPath(search: string): string {
    // 브라우저 표준 도구로 query string을 해석한다.
    const searchParams = new URLSearchParams(search);
    // 사용자가 요청한 다음 경로를 읽는다.
    const nextPath = searchParams.get("next");

    // 현재 서비스에서 인증 후 허용할 경로는 채팅과 관리자 화면뿐이다.
    if (nextPath === "/chat" || nextPath === "/admin") {
        // 검증된 내부 경로만 반환한다.
        return nextPath;
    }

    // 외부 URL이나 알 수 없는 값은 채팅 경로로 대체한다.
    return "/chat";
}
