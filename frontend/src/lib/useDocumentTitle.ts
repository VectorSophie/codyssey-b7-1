// 브라우저 문서 제목을 화면 생명주기에 맞춰 바꾸는 기능을 불러온다.
import { useEffect } from "react";

// 각 화면의 의미가 브라우저 탭과 보조기술에 표시되게 한다.
export function useDocumentTitle(pageTitle: string): void {
    // 화면 이름이 바뀔 때 실제 문서 제목을 갱신한다.
    useEffect(() => {
        // 화면 이름과 서비스 이름을 함께 표시한다.
        document.title = `${pageTitle} — EVERYTHING`;
    }, [pageTitle]);
}
