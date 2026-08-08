// textarea 참조 전달과 키보드 이벤트 타입을 불러온다.
import { forwardRef } from "react";

// 질문 입력기가 부모 화면과 주고받을 값을 정의한다.
interface QuestionComposerProps {
    // 현재 textarea에 표시할 질문 초안이다.
    value: string;
    // 사용자가 입력할 때 부모 상태를 바꾸는 함수다.
    onChange: (value: string) => void;
    // 검증된 질문을 서버로 보내도록 부모에 알리는 함수다.
    onSubmit: () => void;
    // 요청 중 입력과 버튼을 잠그는 상태다.
    isSending: boolean;
    // 기록을 불러오지 못한 경우처럼 입력 자체를 막는 상태다.
    isDisabled: boolean;
    // 입력 가까이에 표시할 안전한 오류 문장이다.
    errorMessage: string;
}

// 어느 대화 상태에서도 하단에 유지할 질문 입력기를 만든다.
export const QuestionComposer = forwardRef<HTMLTextAreaElement, QuestionComposerProps>(
    // 부모가 넘긴 값과 textarea 참조를 받아 컴포넌트를 만든다.
    function QuestionComposer(
        { value, onChange, onSubmit, isSending, isDisabled, errorMessage },
        textareaRef,
    ) {
        // Enter와 Shift+Enter를 서로 다른 동작으로 처리한다.
        function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
            // 한글 조합 중 Enter는 글자 확정이므로 전송하지 않는다.
            if (event.nativeEvent.isComposing) {
                // 브라우저의 한글 입력 동작을 그대로 유지한다.
                return;
            }

            // Shift 없는 Enter만 질문 전송으로 사용한다.
            if (event.key === "Enter" && !event.shiftKey) {
                // textarea에 불필요한 줄바꿈이 생기는 것을 막는다.
                event.preventDefault();

                // 이미 전송 중이면 두 번째 요청을 만들지 않는다.
                if (isSending || isDisabled) {
                    // 중복 실행 없이 키보드 처리를 끝낸다.
                    return;
                }

                // 부모의 동일한 제출 검증 함수를 실행한다.
                onSubmit();
            }
        }

        // 버튼 제출도 키보드 제출과 같은 함수로 연결한다.
        function handleFormSubmit(event: React.FormEvent<HTMLFormElement>): void {
            // 브라우저의 기본 페이지 새로고침을 막는다.
            event.preventDefault();

            // 이미 전송 중이면 두 번째 요청을 만들지 않는다.
            if (isSending || isDisabled) {
                // 중복 실행 없이 폼 처리를 끝낸다.
                return;
            }

            // 부모의 동일한 제출 검증 함수를 실행한다.
            onSubmit();
        }

        // 입력, 상태, 전송 버튼을 하나의 폼으로 반환한다.
        return (
            // 질문을 서버로 보낼 수 있는 의미 있는 form 요소다.
            <form className="composer" onSubmit={handleFormSubmit}>
                {/* 입력기 안내와 글자 수를 위쪽에 배치한다. */}
                <div className="composer__meta">
                    {/* placeholder와 별도로 실제 입력 label을 제공한다. */}
                    <label htmlFor="chat-question">질문</label>
                    {/* 현재 길이와 서버 최대 길이를 함께 표시한다. */}
                    <span id="chat-character-count">
                        {value.length.toLocaleString("ko-KR")} / 2,000
                    </span>
                </div>

                {/* textarea와 전송 버튼을 하나의 도구처럼 묶는다. */}
                <div className="composer__control">
                    {/* 여러 줄 질문을 입력할 수 있는 textarea다. */}
                    <textarea
                        // 부모가 새 질문 때 직접 focus할 수 있는 참조다.
                        ref={textareaRef}
                        // label과 입력을 연결하는 고유 번호다.
                        id="chat-question"
                        // 입력 전에 보여줄 차분한 안내 문구다.
                        placeholder="무엇이든 질문하세요…"
                        // 현재 부모 질문 상태를 표시한다.
                        value={value}
                        // 사용자의 입력을 부모 질문 상태에 반영한다.
                        onChange={(event) => onChange(event.target.value)}
                        // Enter와 Shift+Enter 동작을 구분한다.
                        onKeyDown={handleKeyDown}
                        // 브라우저에서도 2,000자 이후 입력을 막는다.
                        maxLength={2000}
                        // 질문 원문이 자동완성 기록에 남는 것을 줄인다.
                        autoComplete="off"
                        // 모바일 브라우저의 입력 크기 계산을 돕는다.
                        rows={1}
                        // 전송 중에는 질문 수정과 중복 전송을 막는다.
                        disabled={isSending || isDisabled}
                        // 오류와 글자 수 영역의 관계를 보조기술에 알린다.
                        aria-describedby="chat-error chat-character-count composer-help"
                        // 오류가 있을 때 입력 상태를 보조기술에 알린다.
                        aria-invalid={errorMessage.length > 0}
                    />
                    {/* 명시적인 질문 전송 버튼을 제공한다. */}
                    <button
                        // form의 submit 동작을 실행한다.
                        type="submit"
                        // 전송 버튼 전용 시각 스타일을 적용한다.
                        className="composer__send"
                        // 요청 중이거나 공백뿐이면 버튼을 비활성화한다.
                        disabled={isSending || isDisabled}
                        // 화살표만 보지 않아도 동작을 알 수 있는 이름이다.
                        aria-label={isSending ? "답변을 기다리는 중" : "질문 보내기"}
                    >
                        {/* 전송 상태는 짧은 텍스트로 정확하게 표시한다. */}
                        {isSending ? "대기" : "보내기"}
                    </button>
                </div>

                {/* Enter 동작을 입력 전에 이해할 수 있게 설명한다. */}
                <p id="composer-help" className="composer__help">
                    Enter로 보내기 · Shift+Enter로 줄바꿈
                </p>
                {/* 오류는 색상뿐 아니라 실제 문장으로 제공한다. */}
                <p id="chat-error" className="form-error composer__error" role="alert">
                    {/* 오류가 없을 때도 영역을 유지해 배치 흔들림을 줄인다. */}
                    {errorMessage || " "}
                </p>
            </form>
        );
    },
);
