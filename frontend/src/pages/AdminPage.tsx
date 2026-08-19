// 관리자 화면의 비동기 조회, 검색, 탭 상태를 관리할 React 기능을 불러온다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// 관리자 화면 안의 링크와 안전한 경로 이동 기능을 불러온다.
import { Link, useNavigate } from "react-router-dom";
// 관리자 API 오류와 전체 DB 조회 함수를 불러온다.
import { ApiRequestError, getAdminDatabase } from "../api/client";
// 현재 관리자 정보와 인증 만료·로그아웃 동작을 불러온다.
import { useAuth } from "../auth/AuthContext";
// 서버 UTC 시각을 브라우저 Date로 안전하게 바꾸는 함수를 불러온다.
import { parseServerDate } from "../lib/dateTime";
// 브라우저 탭 제목을 바꾸는 Hook을 불러온다.
import { useDocumentTitle } from "../lib/useDocumentTitle";
// 관리자 DB 데이터 타입만 불러온다.
import type { AdminDatabase, AdminMessage, AdminSession, AdminUser } from "../types";

// 화면에서 전환할 SQLite 테이블 이름을 세 가지로 제한한다.
type AdminTable = "users" | "sessions" | "messages";

// 한국어 관리자 화면에서 날짜와 시각을 짧게 표시할 형식을 준비한다.
const ADMIN_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
    // 연도를 네 자리로 표시한다.
    year: "numeric",
    // 월을 두 자리로 표시한다.
    month: "2-digit",
    // 일을 두 자리로 표시한다.
    day: "2-digit",
    // 시를 두 자리로 표시한다.
    hour: "2-digit",
    // 분을 두 자리로 표시한다.
    minute: "2-digit",
    // 초를 두 자리로 표시한다.
    second: "2-digit",
});

// 서버 시각을 관리자에게 읽기 쉬운 한국어 시각으로 바꾼다.
function formatAdminDate(value: string): string {
    // 시간대가 없는 서버 UTC 문자열도 안전하게 Date로 바꾼다.
    const date = parseServerDate(value);

    // 잘못된 날짜가 화면을 깨뜨리지 않게 대체 문자를 반환한다.
    if (Number.isNaN(date.getTime())) {
        // 알 수 없는 시각을 짧은 기호로 표시한다.
        return "-";
    }

    // 현재 브라우저 시간대 기준의 한국어 시각을 반환한다.
    return ADMIN_DATE_FORMATTER.format(date);
}

// 검색 비교 전에 숫자와 문자열을 같은 소문자 문자열로 바꾼다.
function includesQuery(query: string, values: Array<string | number | null>): boolean {
    // 검색어가 비어 있으면 모든 행을 보여준다.
    if (query.length === 0) {
        // 현재 행을 검색 결과에 포함한다.
        return true;
    }

    // 행의 여러 필드 중 하나라도 검색어를 포함하는지 확인한다.
    return values.some((value) => String(value ?? "").toLocaleLowerCase("ko-KR").includes(query));
}

// 메시지 원문을 표에서 먼저 읽을 수 있는 짧은 문장으로 만든다.
function getMessagePreview(content: string): string {
    // 여러 줄 공백을 한 칸으로 합쳐 표의 한 줄 요약으로 만든다.
    const compactContent = content.replace(/\s+/g, " ").trim();

    // 짧은 메시지는 잘라내지 않고 그대로 반환한다.
    if (compactContent.length <= 90) {
        // 전체 메시지를 요약 문장으로 사용한다.
        return compactContent;
    }

    // 긴 메시지는 앞 90자와 생략 부호를 보여준다.
    return `${compactContent.slice(0, 90)}…`;
}

// 관리자가 SQLite 사용자·대화방·메시지를 한 화면에서 탐색하게 한다.
export function AdminPage() {
    // 서버에서 받은 세 SQLite 테이블 또는 아직 받지 않은 상태를 보관한다.
    const [database, setDatabase] = useState<AdminDatabase | null>(null);
    // 관리자 API 첫 조회와 수동 새로고침 상태를 보관한다.
    const [isLoading, setIsLoading] = useState(true);
    // 일반 조회 실패의 안전한 안내 문장을 보관한다.
    const [loadError, setLoadError] = useState("");
    // 로그인했지만 관리자가 아닌 403 상태를 별도로 보관한다.
    const [isForbidden, setIsForbidden] = useState(false);
    // 현재 화면에 표시할 SQLite 테이블을 보관한다.
    const [activeTable, setActiveTable] = useState<AdminTable>("users");
    // 세 테이블에 공통 적용할 검색어를 보관한다.
    const [searchQuery, setSearchQuery] = useState("");
    // 화면을 떠난 뒤 늦은 API 응답이 상태를 바꾸지 못하게 생존 여부를 기억한다.
    const isMountedRef = useRef(true);
    // 수동 새로고침과 첫 조회 중 최신 요청만 적용할 번호를 기억한다.
    const requestVersionRef = useRef(0);
    // 현재 사용자와 인증 관련 동작을 읽는다.
    const { expireSession, signOut, user } = useAuth();
    // 인증 만료와 로그아웃 뒤 안전한 내부 경로로 이동할 함수를 준비한다.
    const navigate = useNavigate();
    // 브라우저 탭에 현재 관리자 화면 이름을 표시한다.
    useDocumentTitle("관리자 데이터 콘솔");

    // 관리자 전체 DB 데이터를 서버에서 다시 읽는다.
    const loadDatabase = useCallback(async (): Promise<void> => {
        // 이번 요청을 이전 요청과 구분할 번호를 발급한다.
        const requestVersion = requestVersionRef.current + 1;
        // 이후 응답 비교를 위해 최신 번호를 저장한다.
        requestVersionRef.current = requestVersion;
        // 조회 시작 상태를 화면에 표시한다.
        setIsLoading(true);
        // 이전 일반 오류를 지운다.
        setLoadError("");
        // 새 요청에서는 이전 권한 오류 판정을 지운다.
        setIsForbidden(false);

        // 관리자 API 호출을 시도한다.
        try {
            // users, chat_sessions, messages 전체를 한 번에 조회한다.
            const loadedDatabase = await getAdminDatabase();

            // 화면을 떠났거나 더 최신 요청이 시작됐다면 오래된 결과를 버린다.
            if (!isMountedRef.current || requestVersionRef.current !== requestVersion) {
                // 현재 화면 상태를 바꾸지 않고 종료한다.
                return;
            }

            // 검증된 세 테이블 데이터를 화면 상태에 저장한다.
            setDatabase(loadedDatabase);
        } catch (error: unknown) {
            // 화면을 떠났거나 더 최신 요청이 시작됐다면 오래된 오류를 버린다.
            if (!isMountedRef.current || requestVersionRef.current !== requestVersion) {
                // 현재 화면 오류를 바꾸지 않고 종료한다.
                return;
            }

            // 세션 만료는 전역 인증 상태를 지우고 로그인 화면으로 이동한다.
            if (error instanceof ApiRequestError && error.code === "AUTH_REQUIRED") {
                // 더 이상 유효하지 않은 사용자 정보를 전역 상태에서 지운다.
                expireSession();
                // 로그인 성공 뒤 관리자 화면으로만 돌아오는 안전한 내부 경로를 사용한다.
                navigate("/login?next=/admin", { replace: true });
                // 일반 오류 화면을 표시하지 않고 종료한다.
                return;
            }

            // 로그인했지만 관리자 목록에 없는 사용자는 별도 권한 화면을 표시한다.
            if (error instanceof ApiRequestError && error.code === "ADMIN_REQUIRED") {
                // 개인정보 표 대신 권한 부족 안내를 표시한다.
                setIsForbidden(true);
                // 이전에 받은 관리자 데이터가 남아 보이지 않게 지운다.
                setDatabase(null);
                // 일반 오류 처리 없이 종료한다.
                return;
            }

            // API 계층이 정리한 안전한 오류 문장만 화면에 저장한다.
            setLoadError(
                // 알려진 API 오류는 준비된 사용자 문장을 사용한다.
                error instanceof ApiRequestError
                    ? error.message
                    // 예상 밖 오류는 내부 정보를 숨긴 공통 문장을 사용한다.
                    : "관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
            );
        } finally {
            // 현재 화면의 최신 요청이 끝난 경우에만 로딩 상태를 해제한다.
            if (isMountedRef.current && requestVersionRef.current === requestVersion) {
                // 조회 완료 상태로 전환한다.
                setIsLoading(false);
            }
        }
    }, [expireSession, navigate]);

    // 관리자 화면이 처음 열릴 때 전체 DB를 한 번 조회한다.
    useEffect(() => {
        // 개발 환경 Effect 재실행에서도 현재 화면이 살아 있음을 기록한다.
        isMountedRef.current = true;
        // 관리자 전체 DB 조회를 시작한다.
        void loadDatabase();

        // 관리자 화면이 사라질 때 늦은 응답을 무효화한다.
        return () => {
            // 이후 도착한 응답이 사라진 화면을 바꾸지 못하게 한다.
            isMountedRef.current = false;
            // 진행 중인 요청 번호도 오래된 값으로 만든다.
            requestVersionRef.current += 1;
        };
    }, [loadDatabase]);

    // 사용자 기본키로 사용자 정보를 바로 찾는 표를 만든다.
    const usersById = useMemo(() => {
        // 아직 데이터가 없으면 빈 Map을 만든다.
        const map = new Map<number, AdminUser>();
        // 전체 사용자를 기본키와 함께 Map에 넣는다.
        database?.users.forEach((adminUser) => map.set(adminUser.id, adminUser));
        // 대화방과 메시지 표가 재사용할 Map을 반환한다.
        return map;
    }, [database]);

    // 대화방 기본키로 대화방 정보를 바로 찾는 표를 만든다.
    const sessionsById = useMemo(() => {
        // 아직 데이터가 없으면 빈 Map을 만든다.
        const map = new Map<number, AdminSession>();
        // 전체 대화방을 기본키와 함께 Map에 넣는다.
        database?.sessions.forEach((session) => map.set(session.id, session));
        // 메시지 표가 사용자와 제목을 연결할 Map을 반환한다.
        return map;
    }, [database]);

    // 사용자별 대화방 수를 계산한다.
    const sessionCountByUserId = useMemo(() => {
        // 사용자 기본키와 대화방 수를 담을 Map을 만든다.
        const map = new Map<number, number>();
        // 각 대화방을 소유 사용자 기준으로 센다.
        database?.sessions.forEach((session) => {
            // 현재까지 센 값에 한 건을 더한다.
            map.set(session.userId, (map.get(session.userId) ?? 0) + 1);
        });
        // 사용자 표가 사용할 계산 결과를 반환한다.
        return map;
    }, [database]);

    // 대화방별 메시지 수와 사용자별 메시지 수를 함께 계산한다.
    const messageCounts = useMemo(() => {
        // 대화방 기본키별 메시지 수를 담는다.
        const bySessionId = new Map<number, number>();
        // 사용자 기본키별 메시지 수를 담는다.
        const byUserId = new Map<number, number>();
        // 전체 메시지를 한 번만 순회한다.
        database?.messages.forEach((message) => {
            // 현재 대화방의 메시지 수를 한 건 늘린다.
            bySessionId.set(message.sessionId, (bySessionId.get(message.sessionId) ?? 0) + 1);
            // 메시지의 대화방을 찾는다.
            const session = sessionsById.get(message.sessionId);
            // 연결된 대화방이 있을 때만 사용자별 수를 계산한다.
            if (session) {
                // 대화방 소유자의 메시지 수를 한 건 늘린다.
                byUserId.set(session.userId, (byUserId.get(session.userId) ?? 0) + 1);
            }
        });
        // 두 집계 Map을 이름 있는 객체로 반환한다.
        return { bySessionId, byUserId };
    }, [database, sessionsById]);

    // 사용자가 입력한 검색어를 공백 제거와 소문자로 정규화한다.
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR");

    // 현재 검색어와 일치하는 사용자 행만 계산한다.
    const filteredUsers = useMemo(() => {
        // 데이터가 없으면 빈 목록을 사용한다.
        const users = database?.users ?? [];
        // 기본키, 이름, 이메일, 생성 시각에서 검색한다.
        return users.filter((adminUser) => includesQuery(normalizedQuery, [
            // 사용자 기본키다.
            adminUser.id,
            // 사용자 이름이다.
            adminUser.username,
            // 사용자 이메일이다.
            adminUser.email,
            // 계정 생성 시각 원문이다.
            adminUser.createdAt,
        ]));
    }, [database, normalizedQuery]);

    // 현재 검색어와 일치하는 대화방 행만 계산한다.
    const filteredSessions = useMemo(() => {
        // 데이터가 없으면 빈 목록을 사용한다.
        const sessions = database?.sessions ?? [];
        // 각 대화방의 사용자 정보를 함께 검색한다.
        return sessions.filter((session) => {
            // user_id로 소유 사용자 정보를 찾는다.
            const owner = usersById.get(session.userId);
            // 대화방과 사용자 관련 필드에서 검색한다.
            return includesQuery(normalizedQuery, [
                // 대화방 기본키다.
                session.id,
                // 사용자 기본키다.
                session.userId,
                // 사용자 이름이다.
                owner?.username ?? null,
                // 사용자 이메일이다.
                owner?.email ?? null,
                // 대화 제목이다.
                session.title,
                // 대화 생성 시각이다.
                session.createdAt,
                // 대화 갱신 시각이다.
                session.updatedAt,
            ]);
        });
    }, [database, normalizedQuery, usersById]);

    // 현재 검색어와 일치하는 메시지 행만 계산한다.
    const filteredMessages = useMemo(() => {
        // 데이터가 없으면 빈 목록을 사용한다.
        const messages = database?.messages ?? [];
        // 각 메시지의 대화방과 사용자 정보를 함께 검색한다.
        return messages.filter((message) => {
            // session_id로 대화방 정보를 찾는다.
            const session = sessionsById.get(message.sessionId);
            // 대화방의 user_id로 사용자 정보를 찾는다.
            const owner = session ? usersById.get(session.userId) : undefined;
            // 메시지, 대화방, 사용자 관련 필드에서 검색한다.
            return includesQuery(normalizedQuery, [
                // 메시지 기본키다.
                message.id,
                // 대화방 기본키다.
                message.sessionId,
                // 사용자 이름이다.
                owner?.username ?? null,
                // 사용자 이메일이다.
                owner?.email ?? null,
                // 대화 제목이다.
                session?.title ?? null,
                // 메시지 역할이다.
                message.role,
                // 질문 또는 답변 원문이다.
                message.content,
                // 요청 추적 번호다.
                message.requestId,
                // 저장 상태다.
                message.status,
                // 메시지 생성 시각이다.
                message.createdAt,
            ]);
        });
    }, [database, normalizedQuery, sessionsById, usersById]);

    // 가장 최근 메시지 시각을 요약 카드에 표시한다.
    const latestMessageDate = useMemo(() => {
        // 메시지가 없으면 저장 기록 없음 문장을 반환한다.
        if (!database || database.messages.length === 0) {
            // 빈 DB 상태를 명확히 표시한다.
            return "저장 기록 없음";
        }

        // 생성 시각을 비교해 가장 최신 메시지를 찾는다.
        const latestMessage = database.messages.reduce((latest, message) => (
            // 현재 메시지가 더 최신이면 현재 메시지를 선택한다.
            parseServerDate(message.createdAt).getTime() > parseServerDate(latest.createdAt).getTime()
                ? message
                // 기존 최신 메시지가 더 최신이면 그대로 유지한다.
                : latest
        ));
        // 가장 최신 시각을 한국어 표시 형식으로 반환한다.
        return formatAdminDate(latestMessage.createdAt);
    }, [database]);

    // 관리자 로그아웃을 서버와 전역 인증 상태에 반영한다.
    async function handleLogout(): Promise<void> {
        // 서버 세션 쿠키 삭제를 시도한다.
        try {
            // 서버 로그아웃 API를 호출한다.
            await signOut();
            // 로그아웃 성공 뒤 랜딩 화면으로 이동한다.
            navigate("/", { replace: true });
        } catch {
            // 로그아웃 실패는 관리자 데이터 영역의 안전한 일반 오류로 표시한다.
            setLoadError("로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.");
        }
    }

    // 관리자 전체 화면을 반환한다.
    return (
        // 일반 사용자 화면과 구분되는 관리자 최상위 배경이다.
        <div className="admin-page">
            {/* 서비스 이름, 현재 관리자, 이동 동작을 담는 상단 바다. */}
            <header className="admin-topbar">
                {/* 서비스 홈으로 이동하는 텍스트 로고다. */}
                <Link className="wordmark" to="/" aria-label="EVERYTHING 홈">
                    {/* 기존 서비스 정체성을 그대로 유지한다. */}
                    EVERYTHING
                </Link>
                {/* 현재 화면이 운영 전용임을 짧게 표시한다. */}
                <span className="admin-topbar__label">ADMIN CONSOLE</span>
                {/* 관리자 이동과 계정 동작을 묶는다. */}
                <nav className="admin-topbar__actions" aria-label="관리자 메뉴">
                    {/* 일반 채팅 화면으로 돌아가는 링크다. */}
                    <Link className="text-button" to="/chat">
                        채팅으로
                    </Link>
                    {/* 현재 관리자 이름을 넓은 화면에서 표시한다. */}
                    <span className="account-name">{user?.username}</span>
                    {/* 서버 세션을 삭제하는 로그아웃 버튼이다. */}
                    <button className="text-button" type="button" onClick={() => void handleLogout()}>
                        로그아웃
                    </button>
                </nav>
            </header>

            {/* 키보드 바로가기의 도착점이 되는 관리자 핵심 영역이다. */}
            <main id="main-content" className="admin-main">
                {/* 화면 목적과 보안 범위를 먼저 설명한다. */}
                <section className="admin-hero" aria-labelledby="admin-title">
                    {/* 화면 종류를 작은 표제로 표시한다. */}
                    <p className="eyebrow">운영 데이터</p>
                    {/* 관리자가 현재 화면 목적을 바로 이해할 제목이다. */}
                    <h1 id="admin-title">관리자 데이터 콘솔</h1>
                    {/* 실제로 조회하는 테이블과 제외하는 보안 필드를 설명한다. */}
                    <p>
                        SQLite의 users, chat_sessions, messages 전체 행을 확인한다.
                        비밀번호 해시와 환경 비밀정보는 제공하지 않는다.
                    </p>
                </section>

                {/* 로딩 중인 실제 작업을 보조기술에도 알린다. */}
                {isLoading ? (
                    <section className="admin-state" aria-live="polite">
                        {/* 현재 서버에서 데이터를 읽는 중임을 알린다. */}
                        <p>관리자 데이터를 불러오는 중…</p>
                    </section>
                ) : null}

                {/* 일반 사용자가 관리자 API에 접근한 경우 데이터 대신 안내한다. */}
                {!isLoading && isForbidden ? (
                    <section className="admin-state admin-state--danger" role="alert">
                        {/* 권한 문제를 직접적인 제목으로 표시한다. */}
                        <h2>관리자 권한이 없습니다</h2>
                        {/* 설정 변경과 서버 재시작이 필요함을 설명한다. */}
                        <p>현재 사용자 이름이 서버의 ADMIN_USERNAMES에 등록되어 있는지 확인한다.</p>
                        {/* 일반 사용자가 안전한 채팅 화면으로 돌아가게 한다. */}
                        <Link className="button" to="/chat">채팅으로 돌아가기</Link>
                    </section>
                ) : null}

                {/* 네트워크나 서버 실패에는 재시도 수단을 제공한다. */}
                {!isLoading && !isForbidden && loadError.length > 0 ? (
                    <section className="admin-state admin-state--danger" role="alert">
                        {/* 안전하게 변환된 오류 문장만 표시한다. */}
                        <p>{loadError}</p>
                        {/* 사용자가 원할 때만 같은 조회를 다시 실행한다. */}
                        <button className="button" type="button" onClick={() => void loadDatabase()}>
                            다시 불러오기
                        </button>
                    </section>
                ) : null}

                {/* 전체 DB 조회에 성공한 경우에만 데이터 콘솔을 표시한다. */}
                {!isLoading && !isForbidden && loadError.length === 0 && database ? (
                    <>
                        {/* DB 전체 규모를 네 개의 요약 카드로 보여준다. */}
                        <section className="admin-metrics" aria-label="데이터 요약">
                            {/* users 전체 행 수를 표시한다. */}
                            <article className="admin-metric">
                                <span>사용자</span>
                                <strong>{database.users.length.toLocaleString("ko-KR")}</strong>
                                <small>users 행</small>
                            </article>
                            {/* chat_sessions 전체 행 수를 표시한다. */}
                            <article className="admin-metric">
                                <span>대화방</span>
                                <strong>{database.sessions.length.toLocaleString("ko-KR")}</strong>
                                <small>chat_sessions 행</small>
                            </article>
                            {/* messages 전체 행 수를 표시한다. */}
                            <article className="admin-metric">
                                <span>메시지</span>
                                <strong>{database.messages.length.toLocaleString("ko-KR")}</strong>
                                <small>messages 행</small>
                            </article>
                            {/* 마지막 메시지 저장 시각을 표시한다. */}
                            <article className="admin-metric admin-metric--wide">
                                <span>마지막 저장</span>
                                <strong>{latestMessageDate}</strong>
                                <small>현재 브라우저 시간</small>
                            </article>
                        </section>

                        {/* 검색, 새로고침, 테이블 전환을 한 도구 영역에 둔다. */}
                        <section className="admin-toolbar" aria-label="데이터 탐색 도구">
                            {/* 검색 label과 입력을 함께 묶는다. */}
                            <label className="admin-search" htmlFor="admin-search-input">
                                {/* 입력의 목적을 항상 보이는 글자로 표시한다. */}
                                <span>전체 필드 검색</span>
                                {/* 현재 선택 테이블의 여러 필드를 동시에 검색한다. */}
                                <input
                                    // label과 연결할 고유 id다.
                                    id="admin-search-input"
                                    // 일반 텍스트 검색 입력이다.
                                    type="search"
                                    // 현재 검색어를 입력에 표시한다.
                                    value={searchQuery}
                                    // 입력할 때마다 화면 필터를 갱신한다.
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    // 검색 기록 자동 저장으로 개인정보가 남는 것을 줄인다.
                                    autoComplete="off"
                                    // 검색 가능한 대표 필드를 안내한다.
                                    placeholder="이름, 이메일, 제목, 내용, ID"
                                />
                            </label>
                            {/* 서버의 최신 DB를 수동으로 다시 읽는다. */}
                            <button className="button" type="button" onClick={() => void loadDatabase()}>
                                새로고침
                            </button>
                        </section>

                        {/* 세 SQLite 테이블을 명확한 탭으로 전환한다. */}
                        <div className="admin-tabs" role="tablist" aria-label="SQLite 테이블">
                            {/* users 테이블 탭이다. */}
                            <button
                                // 탭 자체는 form 제출과 무관한 버튼이다.
                                type="button"
                                // 보조기술이 탭으로 인식하게 한다.
                                role="tab"
                                // 현재 선택 여부를 전달한다.
                                aria-selected={activeTable === "users"}
                                // 이 탭이 제어할 panel을 연결한다.
                                aria-controls="admin-table-panel"
                                // 선택 상태에 맞는 class를 적용한다.
                                className={activeTable === "users" ? "is-active" : ""}
                                // 클릭하면 users 표로 전환한다.
                                onClick={() => setActiveTable("users")}
                            >
                                사용자 {database.users.length.toLocaleString("ko-KR")}
                            </button>
                            {/* chat_sessions 테이블 탭이다. */}
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTable === "sessions"}
                                aria-controls="admin-table-panel"
                                className={activeTable === "sessions" ? "is-active" : ""}
                                onClick={() => setActiveTable("sessions")}
                            >
                                대화방 {database.sessions.length.toLocaleString("ko-KR")}
                            </button>
                            {/* messages 테이블 탭이다. */}
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTable === "messages"}
                                aria-controls="admin-table-panel"
                                className={activeTable === "messages" ? "is-active" : ""}
                                onClick={() => setActiveTable("messages")}
                            >
                                메시지 {database.messages.length.toLocaleString("ko-KR")}
                            </button>
                        </div>

                        {/* 선택한 테이블 하나만 표시하는 가로 스크롤 영역이다. */}
                        <section
                            // 탭과 연결할 고유 id다.
                            id="admin-table-panel"
                            // 보조기술이 선택 탭의 panel로 인식하게 한다.
                            role="tabpanel"
                            // 넓은 DB 표가 작은 화면을 밀지 않게 한다.
                            className="admin-table-shell"
                        >
                            {/* users 탭에서 사용자 개인정보와 집계를 표시한다. */}
                            {activeTable === "users" ? (
                                <table className="admin-table">
                                    {/* 보조기술에 표 목적을 설명한다. */}
                                    <caption>users 전체 데이터</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">ID</th>
                                            <th scope="col">사용자 이름</th>
                                            <th scope="col">이메일</th>
                                            <th scope="col">가입 시각</th>
                                            <th scope="col">대화방</th>
                                            <th scope="col">메시지</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* 검색 결과 사용자 행을 순서대로 표시한다. */}
                                        {filteredUsers.map((adminUser) => (
                                            <tr key={adminUser.id}>
                                                <td className="admin-table__id">{adminUser.id}</td>
                                                <td><strong>{adminUser.username}</strong></td>
                                                <td>{adminUser.email}</td>
                                                <td>{formatAdminDate(adminUser.createdAt)}</td>
                                                <td>{sessionCountByUserId.get(adminUser.id) ?? 0}</td>
                                                <td>{messageCounts.byUserId.get(adminUser.id) ?? 0}</td>
                                            </tr>
                                        ))}
                                        {/* 검색 결과가 없으면 빈 상태를 표 안에 표시한다. */}
                                        {filteredUsers.length === 0 ? (
                                            <tr><td colSpan={6} className="admin-table__empty">검색 결과가 없습니다.</td></tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            ) : null}

                            {/* sessions 탭에서 대화방과 소유 사용자를 연결해 표시한다. */}
                            {activeTable === "sessions" ? (
                                <table className="admin-table">
                                    <caption>chat_sessions 전체 데이터</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">ID</th>
                                            <th scope="col">사용자</th>
                                            <th scope="col">제목</th>
                                            <th scope="col">생성 시각</th>
                                            <th scope="col">갱신 시각</th>
                                            <th scope="col">메시지</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* 검색 결과 대화방 행을 표시한다. */}
                                        {filteredSessions.map((session) => {
                                            // user_id로 화면에 표시할 소유 사용자를 찾는다.
                                            const owner = usersById.get(session.userId);
                                            // 현재 대화방 한 행을 반환한다.
                                            return (
                                                <tr key={session.id}>
                                                    <td className="admin-table__id">{session.id}</td>
                                                    <td>
                                                        <strong>{owner?.username ?? "알 수 없음"}</strong>
                                                        <small>user_id {session.userId}</small>
                                                    </td>
                                                    <td>{session.title}</td>
                                                    <td>{formatAdminDate(session.createdAt)}</td>
                                                    <td>{formatAdminDate(session.updatedAt)}</td>
                                                    <td>{messageCounts.bySessionId.get(session.id) ?? 0}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* 검색 결과가 없으면 빈 상태를 표시한다. */}
                                        {filteredSessions.length === 0 ? (
                                            <tr><td colSpan={6} className="admin-table__empty">검색 결과가 없습니다.</td></tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            ) : null}

                            {/* messages 탭에서 전체 질문과 AI 답변 원문을 표시한다. */}
                            {activeTable === "messages" ? (
                                <table className="admin-table admin-table--messages">
                                    <caption>messages 전체 데이터</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">ID</th>
                                            <th scope="col">사용자</th>
                                            <th scope="col">대화방</th>
                                            <th scope="col">역할</th>
                                            <th scope="col">내용</th>
                                            <th scope="col">요청 ID</th>
                                            <th scope="col">상태</th>
                                            <th scope="col">지연</th>
                                            <th scope="col">생성 시각</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* 검색 결과 메시지 행을 표시한다. */}
                                        {filteredMessages.map((message: AdminMessage) => {
                                            // session_id로 대화방 정보를 찾는다.
                                            const session = sessionsById.get(message.sessionId);
                                            // 대화방 user_id로 사용자 정보를 찾는다.
                                            const owner = session ? usersById.get(session.userId) : undefined;
                                            // 현재 메시지 한 행을 반환한다.
                                            return (
                                                <tr key={message.id}>
                                                    <td className="admin-table__id">{message.id}</td>
                                                    <td>
                                                        <strong>{owner?.username ?? "알 수 없음"}</strong>
                                                        <small>{owner?.email ?? "사용자 정보 없음"}</small>
                                                    </td>
                                                    <td>
                                                        <strong>{session?.title ?? "알 수 없는 대화"}</strong>
                                                        <small>session_id {message.sessionId}</small>
                                                    </td>
                                                    <td>
                                                        <span className={`admin-role admin-role--${message.role}`}>
                                                            {message.role === "user" ? "사용자" : "AI"}
                                                        </span>
                                                    </td>
                                                    <td className="admin-table__content">
                                                        <details>
                                                            <summary>{getMessagePreview(message.content)}</summary>
                                                            <p>{message.content}</p>
                                                        </details>
                                                    </td>
                                                    <td><code>{message.requestId}</code></td>
                                                    <td>{message.status}</td>
                                                    <td>{message.latencyMs === null ? "-" : `${message.latencyMs} ms`}</td>
                                                    <td>{formatAdminDate(message.createdAt)}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* 검색 결과가 없으면 빈 상태를 표시한다. */}
                                        {filteredMessages.length === 0 ? (
                                            <tr><td colSpan={9} className="admin-table__empty">검색 결과가 없습니다.</td></tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            ) : null}
                        </section>

                        {/* 현재 검색 결과 행 수를 표 아래에 명확히 표시한다. */}
                        <p className="admin-result-count" aria-live="polite">
                            {activeTable === "users" ? filteredUsers.length.toLocaleString("ko-KR") : null}
                            {activeTable === "sessions" ? filteredSessions.length.toLocaleString("ko-KR") : null}
                            {activeTable === "messages" ? filteredMessages.length.toLocaleString("ko-KR") : null}
                            개 행 표시
                        </p>
                    </>
                ) : null}
            </main>
        </div>
    );
}
