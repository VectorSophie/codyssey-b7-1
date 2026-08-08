// 확인창 focus와 Escape 처리를 위한 React 기능을 불러온다.
import { useEffect, useRef } from "react";

// 대화 삭제 확인창이 부모 화면과 주고받을 값을 정의한다.
interface ConfirmDialogProps {
    // 사용자가 확인할 대화 제목이다.
    title: string;
    // 삭제 API를 기다리는 중인지 나타낸다.
    isDeleting: boolean;
    // 삭제 실패 시 확인창 안에 표시할 안전한 문장이다.
    errorMessage: string;
    // 삭제하지 않고 확인창을 닫는 함수다.
    onCancel: () => void;
    // 사용자가 명시적으로 삭제를 확정하는 함수다.
    onConfirm: () => void;
}

// 실제 삭제 전에 한 번 더 확인하는 가벼운 접근성 확인창을 만든다.
export function ConfirmDialog({
    title,
    isDeleting,
    errorMessage,
    onCancel,
    onConfirm,
}: ConfirmDialogProps) {
    // 확인창이 열리면 취소 버튼에 focus를 주기 위한 참조다.
    const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
    // Tab 이동을 확인창 안에 가두기 위한 삭제 버튼 참조다.
    const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
    // 확인창이 닫힌 뒤 원래 버튼으로 focus를 돌릴 참조다.
    const previousFocusRef = useRef<HTMLElement | null>(null);
    // 삭제 중 두 버튼이 잠기면 focus를 유지할 dialog 참조다.
    const dialogRef = useRef<HTMLElement | null>(null);

    // 확인창이 처음 열리고 마지막으로 닫힐 때 focus를 관리한다.
    useEffect(() => {
        // 확인창을 열기 직전 조작한 요소를 안전하게 기억한다.
        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        // 파괴적인 삭제보다 안전한 취소 버튼을 먼저 선택한다.
        cancelButtonRef.current?.focus();

        // 확인창이 사라질 때 원래 조작 요소로 focus를 복원한다.
        return () => {
            // 원래 요소가 아직 문서에 있을 때만 focus를 되돌린다.
            if (previousFocusRef.current?.isConnected) {
                // 확인창을 열었던 실제 버튼으로 focus를 되돌린다.
                previousFocusRef.current.focus();
            }
        };
    }, []);

    // 삭제 요청 중에는 비활성 버튼 대신 dialog 자체에 focus를 유지한다.
    useEffect(() => {
        // DELETE 요청이 시작된 경우에만 focus 위치를 바꾼다.
        if (isDeleting) {
            // 상태 문구를 포함한 dialog 전체로 focus를 옮긴다.
            dialogRef.current?.focus();
            // 삭제 중 focus 처리를 끝낸다.
            return;
        }

        // 실패로 버튼이 다시 활성화되면 안전한 취소 버튼으로 focus를 되돌린다.
        cancelButtonRef.current?.focus();
    }, [isDeleting]);

    // 확인창이 열린 동안 Tab과 Escape 키를 dialog 안에서 처리한다.
    useEffect(() => {
        // 키보드 사용자가 Escape로 확인창을 닫게 한다.
        function handleKeyDown(event: KeyboardEvent): void {
            // 삭제 중에는 비활성 버튼에서 focus가 뒤 화면으로 빠지지 않게 한다.
            if (isDeleting && event.key === "Tab") {
                // 서버 응답 전에는 현재 focus 위치를 유지한다.
                event.preventDefault();
                // 다른 키 처리 없이 함수를 끝낸다.
                return;
            }

            // Tab 키는 확인창 안의 두 버튼 사이에서만 이동하게 한다.
            if (event.key === "Tab" && !isDeleting) {
                // 현재 focus가 dialog 자체이거나 dialog 밖인지 확인한다.
                if (
                    document.activeElement === dialogRef.current
                    || !dialogRef.current?.contains(document.activeElement)
                ) {
                    // 배경 화면으로 focus가 빠지지 않게 기본 이동을 막는다.
                    event.preventDefault();
                    // 이동 방향에 맞춰 첫 버튼 또는 마지막 버튼으로 보낸다.
                    if (event.shiftKey) {
                        // 역방향 이동은 마지막 삭제 버튼에서 시작한다.
                        confirmButtonRef.current?.focus();
                    } else {
                        // 정방향 이동은 첫 취소 버튼에서 시작한다.
                        cancelButtonRef.current?.focus();
                    }
                    // 다른 Tab 분기와 겹치지 않게 함수를 끝낸다.
                    return;
                }

                // Shift+Tab으로 취소 앞을 벗어나려는지 확인한다.
                if (event.shiftKey && document.activeElement === cancelButtonRef.current) {
                    // 뒤 화면으로 focus가 이동하지 않게 기본 동작을 막는다.
                    event.preventDefault();
                    // 마지막 삭제 버튼으로 focus를 순환시킨다.
                    confirmButtonRef.current?.focus();
                    // Escape 처리와 겹치지 않게 함수를 끝낸다.
                    return;
                }

                // Tab으로 삭제 뒤를 벗어나려는지 확인한다.
                if (!event.shiftKey && document.activeElement === confirmButtonRef.current) {
                    // 뒤 화면으로 focus가 이동하지 않게 기본 동작을 막는다.
                    event.preventDefault();
                    // 첫 취소 버튼으로 focus를 순환시킨다.
                    cancelButtonRef.current?.focus();
                    // Escape 처리와 겹치지 않게 함수를 끝낸다.
                    return;
                }
            }

            // 삭제 요청 중에는 응답 전 상태가 사라지지 않게 한다.
            if (isDeleting) {
                // Escape를 포함한 닫기 동작을 잠시 막는다.
                return;
            }

            // Escape 키만 취소 동작으로 사용한다.
            if (event.key === "Escape") {
                // 페이지의 다른 Escape 동작과 겹치지 않게 한다.
                event.preventDefault();
                // 실제 삭제 없이 확인창을 닫는다.
                onCancel();
            }
        }

        // 현재 문서에 키보드 이벤트를 등록한다.
        document.addEventListener("keydown", handleKeyDown);

        // 확인창이 사라질 때 이벤트를 정리한다.
        return () => {
            // 중복 이벤트 실행을 막기 위해 같은 함수를 제거한다.
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isDeleting, onCancel]);

    // 배경과 확인 내용을 포함한 alertdialog를 반환한다.
    return (
        // 화면 뒤 내용을 가리고 확인창에 주의를 모으는 배경이다.
        <div className="dialog-backdrop">
            {/* 삭제 영향을 명확히 알리는 접근성 대화상자다. */}
            <section
                // 삭제 요청 중 focus를 유지할 실제 dialog 참조다.
                ref={dialogRef}
                // 경고가 필요한 확인창임을 보조기술에 알린다.
                role="alertdialog"
                // 뒤 화면을 현재 대화 중 조작하지 않게 알린다.
                aria-modal="true"
                // 확인창 제목과 설명을 연결한다.
                aria-labelledby="delete-dialog-title"
                // 상세 설명과 오류 영역을 연결한다.
                aria-describedby="delete-dialog-description delete-dialog-error"
                // 확인창 전용 시각 스타일을 적용한다.
                className="confirm-dialog"
                // 프로그램 focus는 허용하되 일반 Tab 순서에는 넣지 않는다.
                tabIndex={-1}
            >
                {/* 사용자가 무엇을 결정하는지 질문한다. */}
                <h2 id="delete-dialog-title">대화를 삭제할까요?</h2>
                {/* 삭제 대상과 복구 불가 사실을 문장으로 설명한다. */}
                <p id="delete-dialog-description">
                    <strong>“{title}”</strong> 기록이 삭제되며 되돌릴 수 없습니다.
                </p>
                {/* 삭제 실패는 원시 응답 없이 안전한 문장으로 표시한다. */}
                <p id="delete-dialog-error" className="form-error" role="alert">
                    {errorMessage || " "}
                </p>
                {/* 취소와 삭제를 명확히 분리한 버튼 영역이다. */}
                <div className="confirm-dialog__actions">
                    {/* 안전한 취소 동작을 첫 번째로 제공한다. */}
                    <button
                        // 열릴 때 먼저 focus할 실제 버튼 참조다.
                        ref={cancelButtonRef}
                        // form과 무관한 일반 버튼이다.
                        type="button"
                        // 테두리 버튼 스타일을 적용한다.
                        className="button"
                        // 삭제 없이 확인창을 닫는다.
                        onClick={onCancel}
                        // 요청 중에는 결과가 올 때까지 상태를 고정한다.
                        disabled={isDeleting}
                    >
                        취소
                    </button>
                    {/* 파괴적인 삭제를 명시적으로 확정하는 버튼이다. */}
                    <button
                        // 확인창 focus 순환의 마지막 버튼 참조다.
                        ref={confirmButtonRef}
                        // form과 무관한 일반 버튼이다.
                        type="button"
                        // 위험 동작을 텍스트와 색상으로 함께 구분한다.
                        className="button button--danger"
                        // 부모의 DELETE 요청을 정확히 한 번 실행한다.
                        onClick={onConfirm}
                        // 요청 중 더블클릭으로 중복 삭제되지 않게 한다.
                        disabled={isDeleting}
                    >
                        {/* 삭제 진행 상태를 사용자에게 바로 알린다. */}
                        {isDeleting ? "삭제하는 중…" : "삭제"}
                    </button>
                </div>
            </section>
        </div>
    );
}
