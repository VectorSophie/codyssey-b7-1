// 새 답변 위치 이동과 상태 반영에 필요한 React 기능을 불러온다.
import { useEffect, useRef } from "react";
// 질문과 답변 타입을 불러온다.
import type { ChatMessage } from "../types";
// 시간대 없는 서버 UTC 시각도 안전하게 해석하는 함수를 불러온다.
import { parseServerDate } from "../lib/dateTime";

// 대화 읽기 영역이 부모 화면에서 받을 값을 정의한다.
interface ConversationViewProps {
    // 현재 선택한 대화의 질문과 답변 목록이다.
    messages: ChatMessage[];
    // 저장된 대화를 서버에서 읽는 중인지 나타낸다.
    isLoading: boolean;
    // 새 AI 답변을 기다리는 중인지 나타낸다.
    isSending: boolean;
    // 실제 POST 성공 시점에만 읽을 접근성 상태 문장이다.
    announcement: string;
}

// ISO 시각을 한국어의 짧고 읽기 쉬운 시각으로 바꾼다.
function formatMessageTime(value: string): string {
    // 서버 시각 문자열을 브라우저 Date 객체로 변환한다.
    const date = parseServerDate(value);

    // 잘못된 시각이면 화면에 잘못된 날짜를 표시하지 않는다.
    if (Number.isNaN(date.getTime())) {
        // 유효한 시각이 없음을 빈 문자열로 처리한다.
        return "";
    }

    // 한국어 월, 일, 시, 분 형식으로 읽기 쉽게 표시한다.
    return new Intl.DateTimeFormat("ko-KR", {
        // 월을 숫자로 표시한다.
        month: "numeric",
        // 일을 숫자로 표시한다.
        day: "numeric",
        // 시를 숫자로 표시한다.
        hour: "numeric",
        // 분을 두 자리까지 표시한다.
        minute: "2-digit",
    }).format(date);
}

// AI 답변을 말풍선이 아닌 문서형 읽기 구조로 표시한다.
export function ConversationView({
    messages,
    isLoading,
    isSending,
    announcement,
}: ConversationViewProps) {
    // 새 질문이나 답변이 추가될 때 이동할 끝 지점을 보관한다.
    const endRef = useRef<HTMLDivElement | null>(null);

    // 메시지 수나 전송 상태가 바뀔 때 최신 위치가 보이게 한다.
    useEffect(() => {
        // 움직임 축소 설정을 사용하는지 브라우저에 확인한다.
        const prefersReducedMotion = typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // 브라우저가 지원하는 경우에만 부드럽게 끝 지점으로 이동한다.
        endRef.current?.scrollIntoView?.({
            // 축소 설정에서는 즉시 이동하고 그 외에만 부드럽게 이동한다.
            behavior: prefersReducedMotion ? "auto" : "smooth",
            // 최신 답변의 끝을 읽기 영역 아래쪽에 맞춘다.
            block: "end",
        });
    }, [isSending, messages.length]);

    // 저장된 대화를 불러오는 동안 정확한 상태를 표시한다.
    if (isLoading) {
        // 보조기술이 상태 변화를 읽을 수 있는 문구를 반환한다.
        return (
            <div className="conversation-state" role="status" aria-live="polite">
                {/* AI나 웹 검색이 아니라 기록 조회 중임을 정확히 말한다. */}
                <p>대화 기록을 불러오는 중…</p>
            </div>
        );
    }

    // 선택된 메시지가 없으면 차분한 첫 질문 안내를 표시한다.
    if (messages.length === 0) {
        // 새 대화 상태를 제목과 설명으로 반환한다.
        return (
            <div className="chat-empty-state">
                {/* 백과사전의 첫 장처럼 보이는 짧은 장식 텍스트다. */}
                <p className="eyebrow">새로운 항목</p>
                {/* 요구사항이 정한 차분한 빈 화면 문구다. */}
                <h1>세상에는 궁금한 것이 너무 많습니다.</h1>
                {/* 사용자의 다음 행동을 직접 질문한다. */}
                <p>무엇이 궁금한가요?</p>
            </div>
        );
    }

    // 저장된 질문과 답변을 문서 순서로 반환한다.
    return (
        // 새 답변 상태를 보조기술에 전달하는 전체 대화 영역이다.
        <div className="conversation-list">
            {/* 전체 답변을 재낭독하지 않고 새 답변 도착만 알리는 상태 영역이다. */}
            <p className="visually-hidden" aria-live="polite" aria-atomic="true">
                {/* 부모가 실제 POST 성공 때 전달한 문장만 읽는다. */}
                {announcement}
            </p>
            {/* 서버 또는 임시 메시지를 원래 순서대로 표시한다. */}
            {messages.map((message) => {
                // 사용자 질문과 AI 답변을 서로 다른 문서 구조로 나눈다.
                if (message.role === "user") {
                    // 질문은 다음 답변의 제목처럼 시각적으로 구분한다.
                    return (
                        <article className="question-entry" key={message.id}>
                            {/* 글의 종류와 시각을 한 줄에 표시한다. */}
                            <div className="entry-meta">
                                {/* 이 항목이 사용자의 질문임을 표시한다. */}
                                <span>질문</span>
                                {/* 유효한 시각이 있을 때만 time 요소로 표시한다. */}
                                {formatMessageTime(message.createdAt) ? (
                                    <time dateTime={message.createdAt}>
                                        {formatMessageTime(message.createdAt)}
                                    </time>
                                ) : null}
                            </div>
                            {/* React 기본 escape가 적용되는 일반 텍스트 제목이다. */}
                            <h2>{message.content}</h2>
                        </article>
                    );
                }

                // AI 답변은 읽기 폭을 제한한 백과사전 본문처럼 표시한다.
                return (
                    <article className="answer-entry" key={message.id}>
                        {/* 답변의 작성 주체와 시각을 한 줄에 표시한다. */}
                        <div className="entry-meta">
                            {/* 제품 이름을 답변 작성 주체로 표시한다. */}
                            <span>EVERYTHING</span>
                            {/* 유효한 시각이 있을 때만 time 요소로 표시한다. */}
                            {formatMessageTime(message.createdAt) ? (
                                <time dateTime={message.createdAt}>
                                    {formatMessageTime(message.createdAt)}
                                </time>
                            ) : null}
                        </div>
                        {/* HTML 삽입 없이 React가 escape한 원문만 표시한다. */}
                        <p className="answer-entry__content">{message.content}</p>
                    </article>
                );
            })}

            {/* 새 AI 요청 중에는 실제 수행 중인 상태만 간결하게 표시한다. */}
            {isSending ? (
                <div className="answer-loading" role="status">
                    {/* 웹 검색을 가장하지 않는 정확한 로딩 문구다. */}
                    <span>지식을 찾는 중…</span>
                </div>
            ) : null}

            {/* 새 답변 뒤 화면 이동의 기준이 되는 빈 요소다. */}
            <div ref={endRef} aria-hidden="true" />
        </div>
    );
}
