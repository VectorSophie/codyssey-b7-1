// Vitest의 테스트 묶음과 검증 함수를 불러온다.
import { describe, expect, it } from "vitest";
// 질문 초안과 다음 경로를 안전하게 읽는 함수를 불러온다.
import { readPendingQuestion, readSafeNextPath } from "./navigationState";

// 화면 이동 state와 query의 보안 경계를 검사한다.
describe("navigation state helpers", () => {
    // 유효한 질문 초안이 그대로 읽히는지 확인한다.
    it("reads a pending question without sending it", () => {
        // state의 문자열은 입력 초안으로만 반환되어야 한다.
        expect(readPendingQuestion({ pendingQuestion: "블랙홀이 뭐야?" })).toBe("블랙홀이 뭐야?");
    });

    // 지나치게 긴 state가 서버 제한 안으로 잘리는지 확인한다.
    it("caps pending questions at 2000 characters", () => {
        // 2,001자 입력을 준비한다.
        const longQuestion = "가".repeat(2001);
        // 화면 초안에는 최대 2,000자만 남아야 한다.
        expect(readPendingQuestion({ pendingQuestion: longQuestion })).toHaveLength(2000);
    });

    // 외부 URL을 로그인 후 이동 경로로 허용하지 않는지 확인한다.
    it("blocks external redirect targets", () => {
        // 외부 URL query는 고정 내부 채팅 경로로 대체되어야 한다.
        expect(readSafeNextPath("?next=https://example.com/steal")).toBe("/chat");
    });
});
