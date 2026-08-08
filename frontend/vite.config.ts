// Vite와 Vitest 설정을 함께 검사할 수 있는 설정 생성 함수를 불러온다.
import { defineConfig } from "vitest/config";
// React 코드를 Vite에서 변환하는 공식 플러그인을 불러온다.
import react from "@vitejs/plugin-react";

// 프론트엔드 개발, 빌드, 테스트 설정을 내보낸다.
export default defineConfig({
    // React Fast Refresh와 JSX 변환을 활성화한다.
    plugins: [react()],
    // 로컬 개발 서버의 백엔드 연결 방식을 정한다.
    server: {
        // 팀의 FastAPI 기본 포트로 API 요청을 전달한다.
        proxy: {
            // 인증과 채팅 API를 같은 출처처럼 전달한다.
            "/api": {
                // 로컬 FastAPI 서버 주소만 사용하며 비밀값은 포함하지 않는다.
                target: "http://127.0.0.1:8000",
                // 브라우저가 보는 요청 출처를 프록시 대상에 맞춘다.
                changeOrigin: true,
            },
            // 상태 확인 API도 FastAPI 서버로 전달한다.
            "/health": {
                // 로컬 FastAPI 서버 주소로 상태 요청을 보낸다.
                target: "http://127.0.0.1:8000",
                // 브라우저가 보는 요청 출처를 프록시 대상에 맞춘다.
                changeOrigin: true,
            },
        },
    },
    // Vitest가 브라우저와 유사한 환경에서 컴포넌트를 검사하게 한다.
    test: {
        // DOM API가 있는 jsdom 환경을 사용한다.
        environment: "jsdom",
        // 모든 테스트 전에 접근성 matcher를 등록한다.
        setupFiles: "./src/test/setup.ts",
        // 테스트마다 전역 상태와 mock을 자동으로 초기화한다.
        clearMocks: true,
        // 테스트 안에서 describe, it, expect를 전역으로 사용한다.
        globals: true,
    },
});
