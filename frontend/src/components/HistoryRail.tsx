// 대화 목록 타입을 불러온다.
import type { ChatSession } from "../types";
// 시간대 없는 서버 UTC 시각도 안전하게 해석하는 함수를 불러온다.
import { parseServerDate } from "../lib/dateTime";

// 날짜별로 묶은 대화 목록의 모양을 정의한다.
interface SessionGroup {
    // React key로 사용할 날짜 식별값이다.
    key: string;
    // 사용자에게 보일 오늘, 어제 또는 날짜 문장이다.
    label: string;
    // 같은 날짜에 속한 대화 목록이다.
    sessions: ChatSession[];
}

// 기록 레일이 부모 채팅 화면과 주고받을 값을 정의한다.
interface HistoryRailProps {
    // 서버에서 불러온 사용자 대화 목록이다.
    sessions: ChatSession[];
    // 현재 읽고 있는 대화 번호다.
    selectedSessionId: number | null;
    // 기록 목록을 처음 불러오는 중인지 나타낸다.
    isLoading: boolean;
    // 기록 목록을 불러오지 못했을 때의 안전한 문장이다.
    errorMessage: string;
    // 모바일 drawer가 열렸는지 나타낸다.
    isOpen: boolean;
    // 모바일 drawer를 닫는 함수다.
    onClose: () => void;
    // 저장된 대화를 선택하는 함수다.
    onSelect: (sessionId: number) => void;
    // 삭제 확인 대상을 선택하는 함수다.
    onDelete: (session: ChatSession) => void;
    // AI 요청 중 기록 변경을 막는 상태다.
    isInteractionDisabled: boolean;
    // 실패한 기록 조회를 사용자가 다시 실행하는 함수다.
    onRetry: () => void;
}

// 두 날짜가 같은 연, 월, 일인지 확인한다.
function isSameDate(left: Date, right: Date): boolean {
    // 세 날짜 구성요소가 모두 같을 때만 같은 날로 판단한다.
    return (
        left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate()
    );
}

// 서버 대화 목록을 오늘, 어제, 이전 날짜 그룹으로 묶는다.
function groupSessions(sessions: ChatSession[]): SessionGroup[] {
    // 현재 사용자의 현지 날짜를 기준으로 오늘을 만든다.
    const today = new Date();
    // 오늘을 복사해 어제 날짜 계산에 사용한다.
    const yesterday = new Date(today);
    // 복사한 날짜를 하루 전으로 바꾼다.
    yesterday.setDate(today.getDate() - 1);
    // 같은 label의 그룹을 빠르게 찾을 Map을 만든다.
    const groups = new Map<string, SessionGroup>();

    // 서버가 준 최신순 목록을 그대로 순회한다.
    sessions.forEach((session) => {
        // 대화 갱신 시각을 브라우저 Date로 변환한다.
        const updatedAt = parseServerDate(session.updatedAt);
        // 잘못된 날짜라도 대화를 숨기지 않도록 별도 label을 준비한다.
        let label = "날짜 미상";
        // 공백 없는 HTML id와 그룹 식별값을 별도로 준비한다.
        let groupKey = "unknown-date";

        // 유효한 날짜일 때만 오늘과 어제를 비교한다.
        if (!Number.isNaN(updatedAt.getTime())) {
            // 오늘 대화는 짧은 고정 문구로 표시한다.
            if (isSameDate(updatedAt, today)) {
                // 요구사항의 오늘 그룹 이름을 사용한다.
                label = "오늘";
                // 접근성 연결에 안전한 영문 식별값을 사용한다.
                groupKey = "today";
            } else if (isSameDate(updatedAt, yesterday)) {
                // 요구사항의 어제 그룹 이름을 사용한다.
                label = "어제";
                // 접근성 연결에 안전한 영문 식별값을 사용한다.
                groupKey = "yesterday";
            } else {
                // 더 오래된 대화는 정확한 한국어 날짜로 표시한다.
                label = new Intl.DateTimeFormat("ko-KR", {
                    // 연도를 숫자로 표시한다.
                    year: "numeric",
                    // 월을 숫자로 표시한다.
                    month: "long",
                    // 일을 숫자로 표시한다.
                    day: "numeric",
                }).format(updatedAt);
                // 같은 날짜끼리 묶을 공백 없는 현지 날짜 식별값을 만든다.
                groupKey = `${updatedAt.getFullYear()}-${updatedAt.getMonth() + 1}-${updatedAt.getDate()}`;
            }
        }

        // 같은 label의 기존 그룹이 있는지 확인한다.
        const existingGroup = groups.get(groupKey);

        // 기존 그룹이 있으면 현재 대화를 그 목록에 추가한다.
        if (existingGroup) {
            // 서버 순서를 유지하면서 뒤에 대화를 넣는다.
            existingGroup.sessions.push(session);
            // 새 그룹을 만들지 않고 다음 대화로 넘어간다.
            return;
        }

        // 처음 만난 날짜 label이면 새 그룹을 만든다.
        groups.set(groupKey, {
            // Map과 React에서 공통으로 쓸 식별값이다.
            key: groupKey,
            // 사용자에게 보여줄 날짜 문장이다.
            label,
            // 현재 대화를 첫 항목으로 넣는다.
            sessions: [session],
        });
    });

    // Map에 저장된 서버 순서 그룹을 배열로 반환한다.
    return Array.from(groups.values());
}

// 데스크톱 레일과 모바일 drawer로 함께 쓰는 기록 목록을 만든다.
export function HistoryRail({
    sessions,
    selectedSessionId,
    isLoading,
    errorMessage,
    isOpen,
    onClose,
    onSelect,
    onDelete,
    isInteractionDisabled,
    onRetry,
}: HistoryRailProps) {
    // 서버 대화 목록을 사용자에게 익숙한 날짜 그룹으로 묶는다.
    const sessionGroups = groupSessions(sessions);

    // 기록 제목, 상태, 날짜별 목록을 포함한 aside를 반환한다.
    return (
        // 모바일에서는 is-open class로 drawer의 보임 상태를 바꾼다.
        <aside
            // 화면 크기에 따라 레일과 drawer에 공통 스타일을 적용한다.
            className={`history-rail${isOpen ? " is-open" : ""}`}
            // 보조기술에 이 영역의 목적을 알린다.
            aria-label="대화 기록"
            // 모바일에서 열렸을 때 뒤 화면과 분리된 dialog로 알린다.
            role={isOpen ? "dialog" : undefined}
            // 열린 모바일 drawer가 현재 조작 영역임을 보조기술에 알린다.
            aria-modal={isOpen ? true : undefined}
        >
            {/* 기록 제목과 모바일 닫기 버튼을 한 줄에 배치한다. */}
            <div className="history-rail__header">
                {/* 요구사항이 정한 기록 영역 제목이다. */}
                <h2>나의 기록</h2>
                {/* 작은 화면에서 drawer를 닫는 명시적 버튼이다. */}
                <button className="text-button history-close" type="button" onClick={onClose}>
                    닫기
                </button>
            </div>

            {/* 기록을 처음 읽는 동안 정확한 상태를 표시한다. */}
            {isLoading ? (
                <p className="history-state" role="status">
                    기록을 불러오는 중…
                </p>
            ) : null}

            {/* 기록 조회 오류와 사용자 주도 재시도 버튼을 함께 제공한다. */}
            {!isLoading && errorMessage ? (
                <div className="history-state history-state--error" role="alert">
                    {/* 원시 서버 오류가 아닌 안전한 문장만 표시한다. */}
                    <p>{errorMessage}</p>
                    {/* 사용자가 원할 때만 기록 GET 요청을 다시 보낸다. */}
                    <button className="text-button" type="button" onClick={onRetry}>
                        다시 불러오기
                    </button>
                </div>
            ) : null}

            {/* 로딩과 오류가 끝났지만 기록이 없을 때 빈 상태를 표시한다. */}
            {!isLoading && !errorMessage && sessions.length === 0 ? (
                <div className="history-state">
                    {/* 빈 기록의 의미를 간결하게 설명한다. */}
                    <p>아직 저장된 대화가 없습니다.</p>
                    {/* 첫 질문이 자동 생성되지 않음을 암시하는 안내다. */}
                    <small>첫 질문을 보내면 여기에 기록됩니다.</small>
                </div>
            ) : null}

            {/* 날짜별 대화가 있을 때만 실제 탐색 목록을 만든다. */}
            {sessionGroups.length > 0 ? (
                <nav className="history-groups" aria-label="저장된 대화">
                    {/* 오늘, 어제, 이전 날짜 순서로 그룹을 표시한다. */}
                    {sessionGroups.map((group) => (
                        <section className="history-group" key={group.key} aria-labelledby={`history-${group.key}`}>
                            {/* 각 기록 묶음의 날짜 제목이다. */}
                            <h3 id={`history-${group.key}`}>{group.label}</h3>
                            {/* 같은 날짜의 대화 제목 목록이다. */}
                            <ul>
                                {/* 서버가 준 대화 제목을 그대로 사용한다. */}
                                {group.sessions.map((session) => (
                                    <li
                                        // 대화 번호가 안정적인 React 식별값이다.
                                        key={session.id}
                                        // 현재 대화는 별도 class로 구분한다.
                                        className={selectedSessionId === session.id ? "is-selected" : ""}
                                    >
                                        {/* 제목을 누르면 저장된 대화만 조회한다. */}
                                        <button
                                            // form 제출이 아닌 탐색 버튼임을 명시한다.
                                            type="button"
                                            // 긴 제목을 한 줄로 줄이는 스타일을 적용한다.
                                            className="history-item__select"
                                            // 선택한 대화 번호를 부모에 전달한다.
                                            onClick={() => onSelect(session.id)}
                                            // 현재 대화임을 보조기술에 알린다.
                                            aria-current={selectedSessionId === session.id ? "page" : undefined}
                                            // AI 요청 중 다른 대화로 이동하지 못하게 한다.
                                            disabled={isInteractionDisabled}
                                        >
                                            {/* AI가 아닌 서버 제공 제목을 그대로 텍스트 렌더링한다. */}
                                            {session.title}
                                        </button>
                                        {/* 삭제는 대화 열기와 분리한 독립 버튼이다. */}
                                        <button
                                            // form 제출이 아닌 삭제 확인 열기 버튼이다.
                                            type="button"
                                            // 작은 보조 동작 스타일을 적용한다.
                                            className="history-item__delete"
                                            // 실제 삭제 전에 부모 확인창을 연다.
                                            onClick={() => onDelete(session)}
                                            // 제목까지 포함해 삭제 대상을 명확히 알린다.
                                            aria-label={`${session.title} 대화 삭제`}
                                            // AI 요청 중 대화 상태를 바꾸지 못하게 한다.
                                            disabled={isInteractionDisabled}
                                        >
                                            삭제
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </nav>
            ) : null}
        </aside>
    );
}
