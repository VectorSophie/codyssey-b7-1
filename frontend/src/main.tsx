// 개발 중 잠재적인 React 문제를 더 빨리 찾는 StrictMode를 불러온다.
import { StrictMode } from "react";
// React 화면을 실제 HTML 문서에 연결하는 함수를 불러온다.
import { createRoot } from "react-dom/client";
// 브라우저 주소를 React 경로와 연결하는 Router를 불러온다.
import { BrowserRouter } from "react-router-dom";
// URL별 화면과 인증 상태를 정의한 앱을 불러온다.
import App from "./App";
// 모든 화면이 공유할 디자인 시스템 CSS를 불러온다.
import "./styles.css";

// index.html에 준비한 React 시작 요소를 찾는다.
const rootElement = document.getElementById("root");

// 시작 요소가 없으면 잘못된 HTML 구성을 즉시 알린다.
if (rootElement === null) {
    // 비밀값이 없는 고정 개발 오류만 던진다.
    throw new Error("React root element was not found");
}

// 찾은 요소에 React 앱 전체를 연결한다.
createRoot(rootElement).render(
    // 개발 환경에서 안전하지 않은 생명주기 사용을 점검한다.
    <StrictMode>
        {/* 대화 URL과 API session 번호가 어긋나지 않도록 URL을 동기 반영한다. */}
        <BrowserRouter useTransitions={false}>
            {/* EVERYTHING의 실제 화면 트리를 렌더링한다. */}
            <App />
        </BrowserRouter>
    </StrictMode>,
);
