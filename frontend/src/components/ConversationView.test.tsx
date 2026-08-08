// React 컴포넌트를 DOM에 그리고 결과를 찾는 도구를 불러온다.
import { render, screen } from "@testing-library/react";
// 테스트 함수와 검증 함수를 불러온다.
import { describe, expect, it } from "vitest";
// 실제 대화 읽기 컴포넌트를 불러온다.
import { ConversationView } from "./ConversationView";

// AI 답변이 HTML이 아닌 안전한 텍스트로 표시되는지 검사한다.
describe("ConversationView", () => {
    // 악성 HTML처럼 보이는 문자열도 실제 요소로 만들지 않는지 확인한다.
    it("renders answer content as escaped text", () => {
        // 스크립트 실행을 시도하는 것처럼 보이는 테스트 문자열을 준비한다.
        const unsafeLookingText = '<img src=x onerror="alert(1)">';
        // 문자열을 AI 답변으로 가진 대화 화면을 그린다.
        const { container } = render(
            <ConversationView
                // 악성 문자열처럼 보이는 AI 답변 한 건을 전달한다.
                messages={[
                    {
                        // 테스트 메시지 번호다.
                        id: 1,
                        // AI 답변 역할을 지정한다.
                        role: "assistant",
                        // HTML로 해석되면 안 되는 원문이다.
                        content: unsafeLookingText,
                        // 유효한 테스트 생성 시각이다.
                        createdAt: "2026-08-08T10:00:00",
                    },
                ]}
                // 저장 대화를 읽는 중이 아님을 전달한다.
                isLoading={false}
                // AI 답변을 기다리는 중이 아님을 전달한다.
                isSending={false}
                // 저장 기록 조회이므로 새 답변 발표를 전달하지 않는다.
                announcement=""
            />,
        );
        // 문자열 전체가 사용자에게 텍스트로 보이는지 확인한다.
        expect(screen.getByText(unsafeLookingText)).toBeInTheDocument();
        // 실제 img 요소가 만들어지지 않았는지 확인한다.
        expect(container.querySelector("img")).toBeNull();
    });
});
