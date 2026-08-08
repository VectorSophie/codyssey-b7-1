// 보호된 경로에서 화면 이동과 자식 렌더링 기능을 불러온다.
import { Navigate, useLocation } from "react-router-dom";
// 화면 자식 타입만 별도로 불러온다.
import type { ReactNode } from "react";
// 서버 기준 인증 상태를 읽는 Hook을 불러온다.
import { useAuth } from "../auth/AuthContext";

// 인증이 필요한 화면을 서버 세션 상태에 따라 보호한다.
export function ProtectedRoute({ children }: { children: ReactNode }) {
    // 현재 인증 확인 상태를 읽는다.
    const { authError, retryAuthentication, status } = useAuth();
    // 로그인 후 원래 위치로 돌아가기 위해 현재 경로를 읽는다.
    const location = useLocation();

    // 서버 세션 확인이 끝나기 전에는 빈 화면 대신 상태를 보여준다.
    if (status === "checking") {
        // 보조기술에도 인증 확인 상태가 전달되는 화면을 반환한다.
        return (
            // 전체 화면 중앙에 조용한 상태 문구를 배치한다.
            <main id="main-content" className="route-status" aria-live="polite">
                {/* 서비스 정체성을 유지하는 작은 제목을 표시한다. */}
                <p className="route-status__brand">EVERYTHING</p>
                {/* 실제로 수행 중인 인증 확인만 정확하게 설명한다. */}
                <p>로그인 상태를 확인하는 중…</p>
            </main>
        );
    }

    // 서버 연결 문제는 로그아웃으로 오인하지 않고 재확인 수단을 제공한다.
    if (status === "error") {
        // 원시 서버 정보 없이 안전한 오류와 버튼을 반환한다.
        return (
            <main id="main-content" className="route-status" aria-live="polite">
                {/* 서비스 정체성을 유지하는 작은 제목을 표시한다. */}
                <p className="route-status__brand">EVERYTHING</p>
                {/* API 계층이 정리한 안전한 연결 오류만 표시한다. */}
                <p>{authError}</p>
                {/* 사용자가 원할 때만 인증 GET 요청을 다시 실행한다. */}
                <button className="button" type="button" onClick={() => void retryAuthentication()}>
                    다시 확인
                </button>
            </main>
        );
    }

    // 로그인하지 않은 사용자는 채팅 화면을 열 수 없다.
    if (status === "unauthenticated") {
        // 외부 URL을 허용하지 않는 고정 로그인 경로로 이동한다.
        return (
            <Navigate
                // 로그인 완료 뒤 채팅으로만 돌아가도록 안전한 내부 경로를 쓴다.
                to="/login?next=/chat"
                // 뒤로가기로 보호 화면에 반복 진입하지 않게 기록을 교체한다.
                replace
                // 로그인 화면이 필요한 경우 참고할 이전 위치만 전달한다.
                state={{ from: location.pathname }}
            />
        );
    }

    // 서버가 인증한 사용자에게만 실제 채팅 화면을 보여준다.
    return children;
}
