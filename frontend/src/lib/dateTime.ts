// ISO 문자열 끝에 UTC 또는 숫자 시간대가 있는지 확인한다.
const TIMEZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

// 서버가 시간대 없는 UTC 문자열을 보내도 같은 실제 시각으로 해석한다.
export function parseServerDate(value: string): Date {
    // 실수로 포함된 앞뒤 공백을 날짜 해석 전에 제거한다.
    const normalizedValue = value.trim();
    // 시각까지 있는 ISO 문자열인지 확인한다.
    const hasTimePart = /^\d{4}-\d{2}-\d{2}T/.test(normalizedValue);
    // 시각은 있지만 시간대가 없으면 백엔드 저장 기준인 UTC 표시를 보완한다.
    const safeValue = hasTimePart && !TIMEZONE_SUFFIX_PATTERN.test(normalizedValue)
        ? `${normalizedValue}Z`
        : normalizedValue;

    // 보완한 문자열을 브라우저 Date 객체로 변환해 반환한다.
    return new Date(safeValue);
}
