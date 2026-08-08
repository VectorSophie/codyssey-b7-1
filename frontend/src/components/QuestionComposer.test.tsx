// React 컴포넌트를 DOM에 그리고 키보드 이벤트를 보낼 도구를 불러온다.
import { fireEvent, render, screen } from "@testing-library/react";
// 테스트 함수와 mock 함수를 불러온다.
import { describe, expect, it, vi } from "vitest";
// 실제 질문 입력기 컴포넌트를 불러온다.
import { QuestionComposer } from "./QuestionComposer";

// Enter, Shift+Enter, 전송 잠금 동작을 검사한다.
describe("QuestionComposer", () => {
    // Enter가 질문 전송을 한 번 실행하는지 확인한다.
    it("submits once when Enter is pressed", () => {
        // 호출 횟수를 확인할 제출 mock을 만든다.
        const onSubmit = vi.fn();
        // 질문이 입력된 composer를 화면에 그린다.
        render(
            <QuestionComposer
                // 현재 질문 값을 전달한다.
                value="블랙홀이 뭐야?"
                // 현재 테스트에서는 입력 상태 변경이 필요하지 않다.
                onChange={vi.fn()}
                // 호출 횟수를 확인할 제출 함수를 전달한다.
                onSubmit={onSubmit}
                // 전송 중이 아님을 전달한다.
                isSending={false}
                // 입력 사용 가능 상태를 전달한다.
                isDisabled={false}
                // 오류가 없는 상태를 전달한다.
                errorMessage=""
            />,
        );
        // 실제 label로 textarea를 찾는다.
        const textarea = screen.getByLabelText("질문");
        // Shift 없는 Enter 키보드 이벤트를 보낸다.
        fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
        // 제출 함수가 정확히 한 번 실행됐는지 확인한다.
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    // Shift+Enter가 줄바꿈으로 남고 제출하지 않는지 확인한다.
    it("does not submit when Shift and Enter are pressed together", () => {
        // 호출되지 않아야 할 제출 mock을 만든다.
        const onSubmit = vi.fn();
        // 질문이 입력된 composer를 화면에 그린다.
        render(
            <QuestionComposer
                // 현재 질문 값을 전달한다.
                value="첫 줄"
                // 현재 테스트에서는 입력 상태 변경이 필요하지 않다.
                onChange={vi.fn()}
                // 호출 여부를 확인할 제출 함수를 전달한다.
                onSubmit={onSubmit}
                // 전송 중이 아님을 전달한다.
                isSending={false}
                // 입력 사용 가능 상태를 전달한다.
                isDisabled={false}
                // 오류가 없는 상태를 전달한다.
                errorMessage=""
            />,
        );
        // 실제 label로 textarea를 찾는다.
        const textarea = screen.getByLabelText("질문");
        // Shift와 Enter를 함께 누르는 키보드 이벤트를 보낸다.
        fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
        // 제출 함수가 한 번도 실행되지 않았는지 확인한다.
        expect(onSubmit).not.toHaveBeenCalled();
    });

    // 전송 중 Enter와 버튼이 두 번째 요청을 만들지 않는지 확인한다.
    it("blocks duplicate submits while sending", () => {
        // 호출되지 않아야 할 제출 mock을 만든다.
        const onSubmit = vi.fn();
        // 전송 중인 composer를 화면에 그린다.
        render(
            <QuestionComposer
                // 현재 질문 값을 전달한다.
                value="중복되면 안 되는 질문"
                // 현재 테스트에서는 입력 상태 변경이 필요하지 않다.
                onChange={vi.fn()}
                // 호출 여부를 확인할 제출 함수를 전달한다.
                onSubmit={onSubmit}
                // 서버 응답을 기다리는 상태를 전달한다.
                isSending
                // 별도 오류로 잠긴 상태는 아님을 전달한다.
                isDisabled={false}
                // 오류가 없는 상태를 전달한다.
                errorMessage=""
            />,
        );
        // 실제 label로 비활성 textarea를 찾는다.
        const textarea = screen.getByLabelText("질문");
        // Enter를 반복해도 제출되지 않는지 확인하기 위해 이벤트를 보낸다.
        fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
        // 전송 버튼도 실제로 비활성 상태인지 확인한다.
        expect(screen.getByRole("button", { name: "답변을 기다리는 중" })).toBeDisabled();
        // 제출 함수가 한 번도 실행되지 않았는지 확인한다.
        expect(onSubmit).not.toHaveBeenCalled();
    });

    // 공백 질문도 부모 검증으로 전달해 인라인 오류를 표시하는지 확인한다.
    it("passes blank input to the parent validation handler", () => {
        // 호출 횟수를 확인할 제출 mock을 만든다.
        const onSubmit = vi.fn();
        // 공백 질문이 입력된 composer를 화면에 그린다.
        render(
            <QuestionComposer
                // 공백만 있는 값을 전달한다.
                value="   "
                // 현재 테스트에서는 입력 상태 변경이 필요하지 않다.
                onChange={vi.fn()}
                // 호출 여부를 확인할 제출 함수를 전달한다.
                onSubmit={onSubmit}
                // 전송 중이 아님을 전달한다.
                isSending={false}
                // 입력 사용 가능 상태를 전달한다.
                isDisabled={false}
                // 오류가 없는 상태를 전달한다.
                errorMessage=""
            />,
        );
        // 실제 label로 textarea를 찾는다.
        const textarea = screen.getByLabelText("질문");
        // Enter 키보드 이벤트를 보낸다.
        fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
        // 부모 검증 함수가 정확히 한 번 실행됐는지 확인한다.
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });
});
