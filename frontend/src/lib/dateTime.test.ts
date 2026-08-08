// 날짜 변환 결과를 검사할 Vitest 기능을 불러온다.
import { describe, expect, it } from "vitest";
// 서버 날짜를 안전하게 해석하는 실제 함수를 불러온다.
import { parseServerDate } from "./dateTime";

// SQLite에서 시간대가 사라진 UTC 문자열의 해석을 검사한다.
describe("parseServerDate", () => {
    // offset 없는 서버 시각을 브라우저 현지시각으로 오인하지 않는지 확인한다.
    it("treats an offset-free server timestamp as UTC", () => {
        // 시간대 표기가 없는 백엔드 예시를 날짜로 변환한다.
        const parsedDate = parseServerDate("2026-08-08T12:00:00");
        // 실제 UTC 정오로 유지되는지 표준 문자열로 확인한다.
        expect(parsedDate.toISOString()).toBe("2026-08-08T12:00:00.000Z");
    });

    // 이미 명시된 숫자 offset은 그대로 존중하는지 확인한다.
    it("preserves an explicit timezone offset", () => {
        // 서울 시간대가 포함된 문자열을 날짜로 변환한다.
        const parsedDate = parseServerDate("2026-08-08T21:00:00+09:00");
        // 같은 실제 시각인 UTC 정오로 변환되는지 확인한다.
        expect(parsedDate.toISOString()).toBe("2026-08-08T12:00:00.000Z");
    });

    // 잘못된 서버 문자열이 화면 오류를 만들지 않고 invalid date가 되는지 확인한다.
    it("keeps an invalid timestamp detectable", () => {
        // 날짜가 아닌 문자열을 안전 변환 함수에 전달한다.
        const parsedDate = parseServerDate("not-a-date");
        // 호출한 화면이 날짜 미상으로 처리할 수 있게 NaN인지 확인한다.
        expect(Number.isNaN(parsedDate.getTime())).toBe(true);
    });
});
