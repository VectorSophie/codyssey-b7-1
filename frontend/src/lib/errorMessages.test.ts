// Vitest의 테스트 묶음과 검증 함수를 불러온다.
import { describe, expect, it } from "vitest";
// 서버 오류 코드를 안전한 한국어 문장으로 바꾸는 함수를 불러온다.
import { getErrorMessage } from "./errorMessages";

// 요구사항이 정한 오류 문구가 바뀌지 않는지 검사한다.
describe("getErrorMessage", () => {
    // 공백 질문 오류를 정확한 문장으로 변환하는지 확인한다.
    it("maps EMPTY_INPUT to the required Korean message", () => {
        // 요구사항 원문의 문장과 실제 결과가 같은지 비교한다.
        expect(getErrorMessage("EMPTY_INPUT")).toBe("질문을 입력해주세요.");
    });

    // 길이 제한 오류를 정확한 문장으로 변환하는지 확인한다.
    it("maps INPUT_TOO_LONG to the required Korean message", () => {
        // 2,000자 제한이 사용자에게 그대로 전달되는지 비교한다.
        expect(getErrorMessage("INPUT_TOO_LONG")).toBe("질문은 2,000자 이하로 입력해주세요.");
    });

    // 알 수 없는 내부 오류가 원시 문자열로 노출되지 않는지 확인한다.
    it("hides unknown server error codes", () => {
        // 알 수 없는 코드는 안전한 일반 오류 문장으로 대체되어야 한다.
        expect(getErrorMessage("SECRET_STACK_TRACE")).toBe(
            "예상하지 못한 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        );
    });
});
