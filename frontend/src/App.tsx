// URL에 따라 화면을 나누는 React Router 기능을 불러온다.
import { Navigate, Route, Routes } from "react-router-dom";
// 서버 인증 상태를 앱 전체에 제공하는 Provider를 불러온다.
import { AuthProvider } from "./auth/AuthContext";
// 로그인 사용자만 통과시키는 경로 보호 컴포넌트를 불러온다.
import { ProtectedRoute } from "./components/ProtectedRoute";
// 각 URL에서 보여줄 화면 컴포넌트를 불러온다.
import { LandingPage } from "./pages/LandingPage";
// 로그인 화면 컴포넌트를 불러온다.
import { LoginPage } from "./pages/LoginPage";
// 회원가입 화면 컴포넌트를 불러온다.
import { RegisterPage } from "./pages/RegisterPage";
// 인증 사용자용 채팅 화면 컴포넌트를 불러온다.
import { ChatPage } from "./pages/ChatPage";
// 관리자 전용 SQLite 데이터 화면 컴포넌트를 불러온다.
import { AdminPage } from "./pages/AdminPage";

// EVERYTHING의 전체 URL 구조를 정의한다.
export default function App() {
    // 모든 경로가 같은 서버 인증 상태를 공유하도록 감싼다.
    return (
        <AuthProvider>
            {/* 키보드 사용자가 반복 메뉴를 건너뛸 수 있는 링크다. */}
            <a className="skip-link" href="#main-content">
                {/* 링크 목적을 구체적으로 설명한다. */}
                본문으로 바로가기
            </a>
            {/* 현재 브라우저 주소에 맞는 화면 하나를 렌더링한다. */}
            <Routes>
                {/* 누구나 볼 수 있는 질문 중심 랜딩 화면이다. */}
                <Route path="/" element={<LandingPage />} />
                {/* 서버 세션을 만드는 로그인 화면이다. */}
                <Route path="/login" element={<LoginPage />} />
                {/* 새 계정을 만드는 회원가입 화면이다. */}
                <Route path="/register" element={<RegisterPage />} />
                {/* 서버가 인증한 사용자만 채팅 화면에 접근하게 한다. */}
                <Route
                    // 요구사항이 정한 채팅 URL을 사용한다.
                    path="/chat"
                    // 경로 보호 안에 실제 채팅 화면을 넣는다.
                    element={
                        <ProtectedRoute>
                            {/* 인증이 확인된 경우에만 채팅 UI를 만든다. */}
                            <ChatPage />
                        </ProtectedRoute>
                    }
                />
                {/* 로그인 사용자의 관리자 API 권한을 다시 확인할 운영 화면이다. */}
                <Route
                    // 관리자 전용 내부 URL을 사용한다.
                    path="/admin"
                    // 먼저 로그인 상태를 확인한 뒤 관리자 화면을 렌더링한다.
                    element={
                        <ProtectedRoute>
                            {/* 실제 관리자 여부는 AdminPage의 서버 API가 검증한다. */}
                            <AdminPage />
                        </ProtectedRoute>
                    }
                />
                {/* 알 수 없는 내부 URL은 안전하게 랜딩으로 돌려보낸다. */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AuthProvider>
    );
}
