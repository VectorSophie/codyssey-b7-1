// 채팅 화면의 비동기 상태, 참조, 이벤트를 관리하는 React 기능을 불러온다.
import { useCallback, useEffect, useRef, useState } from "react";
// URL query와 화면 이동을 다루는 React Router 기능을 불러온다.
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
// 인증, 채팅, 기록 API 함수를 불러온다.
import {
    ApiRequestError,
    deleteChatSession,
    getChatSession,
    getChatSessions,
    sendChatMessage,
} from "../api/client";
// 서버 기준 인증 상태와 로그아웃 함수를 불러온다.
import { useAuth } from "../auth/AuthContext";
// 대화 읽기 영역 컴포넌트를 불러온다.
import { ConversationView } from "../components/ConversationView";
// 대화 삭제 전 확인창 컴포넌트를 불러온다.
import { ConfirmDialog } from "../components/ConfirmDialog";
// 날짜별 기록 레일 컴포넌트를 불러온다.
import { HistoryRail } from "../components/HistoryRail";
// Enter와 Shift+Enter를 처리하는 질문 입력기를 불러온다.
import { QuestionComposer } from "../components/QuestionComposer";
// 랜딩이나 로그인에서 전달한 질문 초안을 안전하게 읽는 함수를 불러온다.
import { readPendingQuestion } from "../lib/navigationState";
// 브라우저 탭 제목을 바꾸는 Hook을 불러온다.
import { useDocumentTitle } from "../lib/useDocumentTitle";
// 대화, 메시지 타입을 불러온다.
import type { ChatMessage, ChatSession } from "../types";

// query string의 대화 번호를 안전한 양의 정수로 바꾼다.
function parseSessionId(value: string | null): number | null {
    // query가 없으면 새 대화 상태를 뜻한다.
    if (value === null) {
        // 선택한 대화가 없음을 null로 반환한다.
        return null;
    }

    // 문자열을 JavaScript 숫자로 변환한다.
    const parsedValue = Number(value);

    // 양의 안전한 정수만 서버 대화 번호로 인정한다.
    if (Number.isSafeInteger(parsedValue) && parsedValue > 0) {
        // 검증된 대화 번호를 반환한다.
        return parsedValue;
    }

    // 변조되거나 잘못된 query는 대화 번호로 사용하지 않는다.
    return null;
}

// 알 수 없는 오류를 내부 정보 없는 사용자 문장으로 바꾼다.
function getSafeErrorMessage(error: unknown): string {
    // API 계층이 이미 정리한 오류면 그 안전한 문장을 사용한다.
    if (error instanceof ApiRequestError) {
        // 원시 서버 message가 아닌 준비된 한국어 문장만 반환한다.
        return error.message;
    }

    // 예상 밖 오류는 공통 일반 문장으로 감춘다.
    return "예상하지 못한 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

// 로그인 사용자가 질문, 답변, 기록을 한 화면에서 다루는 주 화면이다.
export function ChatPage() {
    // 서버에서 불러온 사용자의 대화 목록을 보관한다.
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    // 기록 목록의 첫 로딩 상태를 보관한다.
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    // 기록 조회 실패의 안전한 문장을 보관한다.
    const [historyError, setHistoryError] = useState("");
    // 현재 화면에 실제로 불러온 대화 번호를 보관한다.
    const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
    // 현재 읽는 대화의 질문과 답변 목록을 보관한다.
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // 저장된 대화 한 건을 읽는 상태를 보관한다.
    const [isConversationLoading, setIsConversationLoading] = useState(false);
    // React Router가 선택 대화 URL을 반영하는 짧은 전환 상태를 보관한다.
    const [isSessionTransitionPending, setIsSessionTransitionPending] = useState(false);
    // 선택한 대화 조회 실패의 안전한 문장을 보관한다.
    const [conversationError, setConversationError] = useState("");
    // 첫 렌더에서만 이전 화면의 질문 초안을 입력값으로 사용한다.
    const location = useLocation();
    // 사용자가 아직 보내지 않은 질문 초안을 보관한다.
    const [draft, setDraft] = useState(() => readPendingQuestion(location.state));
    // AI 답변 요청이 진행 중인지 보관한다.
    const [isSending, setIsSending] = useState(false);
    // 질문 검증 또는 AI 요청 실패 문장을 보관한다.
    const [sendError, setSendError] = useState("");
    // 모바일 기록 drawer의 열림 상태를 보관한다.
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    // 삭제 확인창에 표시할 대화 또는 닫힌 상태를 보관한다.
    const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);
    // 대화 삭제 API가 진행 중인지 보관한다.
    const [isDeleting, setIsDeleting] = useState(false);
    // 삭제 확인창 안에 표시할 안전한 실패 문장을 보관한다.
    const [deleteError, setDeleteError] = useState("");
    // 로그아웃 요청의 중복 실행을 막는 상태를 보관한다.
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    // 로그아웃 실패 문장을 상단에 표시하기 위해 보관한다.
    const [accountError, setAccountError] = useState("");
    // 실제 새 AI 답변 도착을 보조기술에 한 번 알릴 문장이다.
    const [answerAnnouncement, setAnswerAnnouncement] = useState("");
    // textarea에 새 질문 때 focus하기 위한 참조다.
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    // 모바일 drawer 버튼으로 focus를 되돌리기 위한 참조다.
    const historyButtonRef = useRef<HTMLButtonElement | null>(null);
    // 기록 선택 뒤 주 대화 영역으로 focus를 옮길 참조다.
    const chatMainRef = useRef<HTMLElement | null>(null);
    // 최신 기록 GET 요청만 화면을 바꾸게 할 번호 참조다.
    const historyRequestVersionRef = useRef(0);
    // 최신 대화 GET 요청만 화면을 바꾸게 할 번호 참조다.
    const conversationRequestVersionRef = useRef(0);
    // 같은 렌더 안의 빠른 중복 제출까지 즉시 막는 잠금 참조다.
    const chatSubmitLockRef = useRef(false);
    // 전송 중 입력칸에서 지운 질문을 인증 만료 이동까지 안전하게 보존한다.
    const inFlightQuestionRef = useRef("");
    // 화면을 떠난 뒤 늦은 응답이 URL이나 상태를 바꾸지 못하게 생존 여부를 보관한다.
    const isMountedRef = useRef(true);
    // 새 대화 URL이 실제 반영될 때 함께 적용할 성공 메시지를 잠시 보관한다.
    const pendingConversationResultRef = useRef<{
        // 서버가 새로 만든 대화 번호다.
        sessionId: number;
        // 요청 시작 대화와 새 질문, 답변을 합친 완성 목록이다.
        messages: ChatMessage[];
    } | null>(null);
    // 인증 만료 이동 때 현재 질문 초안을 보존할 참조다.
    const draftRef = useRef(draft);
    // 렌더마다 질문 참조를 가장 최신 입력값으로 갱신한다.
    draftRef.current = draft;
    // URL query의 선택 대화 번호를 읽고 바꾸는 기능이다.
    const [searchParams, setSearchParams] = useSearchParams();
    // 로그인 페이지와 랜딩으로 이동할 함수를 준비한다.
    const navigate = useNavigate();
    // 현재 사용자, 세션 만료 처리, 로그아웃 함수를 읽는다.
    const { user, expireSession, signOut } = useAuth();
    // 현재 query 문자열에서 대화 번호 원문을 읽는다.
    const sessionParam = searchParams.get("session");
    // 원문을 검증한 숫자 또는 null로 바꾼다.
    const selectedSessionId = parseSessionId(sessionParam);
    // 비동기 응답 시점의 실제 선택 대화를 확인할 참조를 만든다.
    const selectedSessionIdRef = useRef<number | null>(selectedSessionId);
    // 렌더마다 참조를 가장 최신 URL 선택값으로 갱신한다.
    selectedSessionIdRef.current = selectedSessionId;
    // 현재 대화 제목을 브라우저 탭에 표시하기 위해 찾는다.
    const selectedSession = sessions.find((session) => session.id === activeSessionId);
    // 선택된 제목이 없으면 공통 대화 제목을 사용한다.
    const pageTitle = selectedSession?.title || "대화";
    // 현재 대화에 맞는 브라우저 탭 제목을 설정한다.
    useDocumentTitle(pageTitle);

    // 채팅 화면이 사라질 때 모든 늦은 비동기 UI 처리를 무효화한다.
    useEffect(() => {
        // 개발 환경의 effect 재실행에서도 현재 화면이 살아 있음을 기록한다.
        isMountedRef.current = true;

        // 다른 경로로 이동하면 더 이상 이 화면의 상태와 URL을 바꾸지 않는다.
        return () => {
            // 이후 도착한 POST, GET, DELETE 응답이 화면 처리를 하지 못하게 한다.
            isMountedRef.current = false;
            // 진행 중인 기록 GET을 오래된 요청으로 만든다.
            historyRequestVersionRef.current += 1;
            // 진행 중인 대화 GET을 오래된 요청으로 만든다.
            conversationRequestVersionRef.current += 1;
            // 아직 URL에 반영되지 않은 새 대화 성공 결과도 함께 지운다.
            pendingConversationResultRef.current = null;
        };
    }, []);

    // 랜딩에서 전달된 질문 초안이 history state에 계속 남지 않게 지운다.
    useEffect(() => {
        // 실제 전달된 질문이 있을 때만 history state를 교체한다.
        if (readPendingQuestion(location.state).length > 0) {
            // 현재 URL과 query는 유지하고 state만 비운다.
            navigate(
                { pathname: "/chat", search: location.search },
                { replace: true, state: null },
            );
        }
    }, []);

    // API가 세션 만료를 알리면 클라이언트 인증도 지우고 로그인으로 이동한다.
    const handleExpiredAuthentication = useCallback((
        error: unknown,
        pendingQuestion: string = inFlightQuestionRef.current || draftRef.current,
    ): boolean => {
        // 이미 다른 화면으로 이동했다면 이 요청이 현재 URL을 바꾸지 못하게 한다.
        if (!isMountedRef.current) {
            // 현재 화면에서 처리하지 않은 오류임을 반환한다.
            return false;
        }

        // AUTH_REQUIRED 이외의 오류는 호출한 기능이 처리하게 둔다.
        if (!(error instanceof ApiRequestError) || error.code !== "AUTH_REQUIRED") {
            // 인증 만료를 처리하지 않았음을 반환한다.
            return false;
        }

        // 더 이상 유효하지 않은 전역 사용자 상태를 지운다.
        expireSession();
        // 외부 URL이 아닌 고정 로그인 경로로 이동한다.
        navigate("/login?next=/chat", {
            // 만료 직전 질문은 URL이 아닌 이동 state로만 보존한다.
            state: { pendingQuestion: pendingQuestion.slice(0, 2000) },
            // 뒤로가기로 만료 화면에 반복 진입하지 않게 한다.
            replace: true,
        });
        // 인증 만료를 이미 처리했음을 반환한다.
        return true;
    }, [expireSession, navigate]);

    // 기록 목록을 불러오되 AI 요청은 만들지 않는다.
    const loadHistory = useCallback(async (preferredSessionId: number | null = null): Promise<void> => {
        // 이번 기록 GET이 최신인지 구분할 번호를 발급한다.
        const requestVersion = historyRequestVersionRef.current + 1;
        // 이후 요청이 이전 응답을 무효화할 수 있게 번호를 저장한다.
        historyRequestVersionRef.current = requestVersion;
        // 기존 오류를 지우고 로딩 상태를 표시한다.
        setHistoryError("");
        // 첫 로딩이나 수동 재시도 상태를 시작한다.
        setIsHistoryLoading(true);

        // 서버의 사용 사용자 기록 조회를 시도한다.
        try {
            // GET /api/chats만 호출하며 AI API는 호출하지 않는다.
            const loadedSessions = await getChatSessions();

            // 더 최신 기록 조회나 삭제가 시작됐다면 오래된 결과를 버린다.
            if (!isMountedRef.current || historyRequestVersionRef.current !== requestVersion) {
                // 현재 기록 상태를 바꾸지 않고 함수를 끝낸다.
                return;
            }

            // 방금 답변받은 대화를 로컬 화면에서 가장 위로 보완한다.
            if (preferredSessionId !== null) {
                // 서버 목록에서 방금 사용한 대화를 찾는다.
                const preferredSession = loadedSessions.find((session) => session.id === preferredSessionId);

                // 새 대화가 서버 목록에 있으면 첫 위치로 옮긴다.
                if (preferredSession) {
                    // 선택 대화를 제외한 나머지 기록을 원래 순서로 보관한다.
                    const remainingSessions = loadedSessions.filter((session) => session.id !== preferredSessionId);
                    // 방금 사용한 대화를 맨 앞에 놓는다.
                    setSessions([preferredSession, ...remainingSessions]);
                    // 아래의 기본 setSessions 실행을 막고 함수를 끝낸다.
                    return;
                }
            }

            // 서버가 반환한 최신순 대화 목록을 그대로 저장한다.
            setSessions(loadedSessions);
        } catch (error: unknown) {
            // 더 최신 기록 조회나 삭제가 시작됐다면 오래된 오류를 버린다.
            if (!isMountedRef.current || historyRequestVersionRef.current !== requestVersion) {
                // 현재 기록 오류를 바꾸지 않고 함수를 끝낸다.
                return;
            }

            // 최신 요청의 인증 만료만 로그인 이동까지 처리한다.
            if (handleExpiredAuthentication(error)) {
                // 현재 채팅 화면의 추가 처리를 끝낸다.
                return;
            }

            // 나머지 오류는 기록 영역 안에 안전한 문장으로 표시한다.
            setHistoryError(getSafeErrorMessage(error));
        } finally {
            // 성공과 실패 모두에서 기록 로딩 상태를 끝낸다.
            if (isMountedRef.current && historyRequestVersionRef.current === requestVersion) {
                // 최신 요청이 끝났을 때만 기록 로딩 상태를 해제한다.
                setIsHistoryLoading(false);
            }
        }
    }, [handleExpiredAuthentication]);

    // 보호 화면이 처음 열릴 때 사용자 대화 목록을 조회한다.
    useEffect(() => {
        // 자동 AI 요청 없이 기록 GET 요청만 실행한다.
        void loadHistory();
    }, [loadHistory]);

    // 선택한 대화 내용을 서버에서 다시 읽는 함수를 준비한다.
    const loadConversation = useCallback(async (sessionId: number): Promise<void> => {
        // 이번 대화 GET이 최신인지 구분할 번호를 발급한다.
        const requestVersion = conversationRequestVersionRef.current + 1;
        // 이후 대화 선택이 이전 응답을 무효화할 수 있게 번호를 저장한다.
        conversationRequestVersionRef.current = requestVersion;
        // 이전 대화 오류를 지운다.
        setConversationError("");
        // 저장 기록 조회는 새 AI 답변 도착으로 발표하지 않는다.
        setAnswerAnnouncement("");
        // 대화 읽기 영역에 정확한 로딩 상태를 표시한다.
        setIsConversationLoading(true);

        // 저장된 대화의 질문과 답변 조회를 시도한다.
        try {
            // GET 요청만 보내며 AI 응답 생성은 요청하지 않는다.
            const detail = await getChatSession(sessionId);

            // 더 최신 대화가 선택됐거나 URL이 바뀌면 오래된 결과를 버린다.
            if (
                !isMountedRef.current
                || conversationRequestVersionRef.current !== requestVersion
                || selectedSessionIdRef.current !== sessionId
            ) {
                // 현재 읽기 화면을 바꾸지 않고 함수를 끝낸다.
                return;
            }
            // 서버가 반환한 실제 대화 번호를 현재 번호로 저장한다.
            setActiveSessionId(detail.session.id);
            // 저장된 질문과 답변을 원래 순서로 표시한다.
            setMessages(detail.messages);
        } catch (error: unknown) {
            // 더 최신 대화가 선택됐거나 URL이 바뀌면 오래된 오류를 버린다.
            if (
                !isMountedRef.current
                || conversationRequestVersionRef.current !== requestVersion
                || selectedSessionIdRef.current !== sessionId
            ) {
                // 현재 읽기 오류를 바꾸지 않고 함수를 끝낸다.
                return;
            }

            // 최신 요청의 인증 만료만 로그인 이동까지 처리한다.
            if (handleExpiredAuthentication(error)) {
                // 현재 채팅 화면의 추가 처리를 끝낸다.
                return;
            }

            // 이 대화 조회는 끝났음을 기록해 사용자 동작 없는 자동 재시도를 막는다.
            setActiveSessionId(sessionId);
            // 이전 대화 내용과 오류 화면이 섞이지 않게 지운다.
            setMessages([]);
            // 원시 응답 없이 안전한 문장만 표시한다.
            setConversationError(getSafeErrorMessage(error));
        } finally {
            // 성공과 실패 모두에서 대화 로딩 상태를 끝낸다.
            if (isMountedRef.current && conversationRequestVersionRef.current === requestVersion) {
                // 최신 대화 요청이 끝났을 때만 로딩 상태를 해제한다.
                setIsConversationLoading(false);
            }
        }
    }, [handleExpiredAuthentication]);

    // URL query가 바뀌면 해당 저장 대화를 읽거나 새 대화 상태를 만든다.
    useEffect(() => {
        // 실제 새 URL 렌더에 도착했으므로 전환 중 입력 잠금을 해제한다.
        setIsSessionTransitionPending(false);

        // query가 있는데 유효한 양의 정수가 아니면 API를 호출하지 않는다.
        if (sessionParam !== null && selectedSessionId === null) {
            // 잘못된 URL이 새 대화 성공 결과를 나중에 잘못 적용하지 않게 지운다.
            pendingConversationResultRef.current = null;
            // 진행 중인 이전 대화 GET을 오래된 것으로 만든다.
            conversationRequestVersionRef.current += 1;
            // 이전 대화 로딩 상태를 즉시 끝낸다.
            setIsConversationLoading(false);
            // 잘못된 query와 이전 대화 번호를 분리한다.
            setActiveSessionId(null);
            // 이전 대화 내용이 오류 화면과 섞이지 않게 지운다.
            setMessages([]);
            // 사용자에게 대화 번호가 올바르지 않음을 알린다.
            setConversationError("대화를 찾을 수 없습니다.");
            // 잘못된 번호로 API를 호출하지 않고 함수를 끝낸다.
            return;
        }

        // query가 없으면 새 질문 상태로 전환한다.
        if (selectedSessionId === null) {
            // 새 질문 URL에서는 아직 반영하지 못한 대화 결과를 사용하지 않는다.
            pendingConversationResultRef.current = null;
            // 진행 중인 이전 대화 GET을 오래된 것으로 만든다.
            conversationRequestVersionRef.current += 1;
            // 이전 대화 로딩 상태를 즉시 끝낸다.
            setIsConversationLoading(false);
            // 현재 서버 대화 번호를 비운다.
            setActiveSessionId(null);
            // 이전 질문과 답변을 읽기 영역에서 지운다.
            setMessages([]);
            // 새 질문 상태에서는 대화 조회 오류를 지운다.
            setConversationError("");
            // 새 질문 상태에서는 이전 답변 도착 발표를 지운다.
            setAnswerAnnouncement("");
            // 서버 GET 요청 없이 함수를 끝낸다.
            return;
        }

        // 첫 질문 성공 뒤 새 대화 URL에 도착했는지 확인한다.
        const pendingConversationResult = pendingConversationResultRef.current;

        // 현재 URL과 서버가 만든 새 대화 번호가 같으면 성공 결과를 바로 적용한다.
        if (pendingConversationResult?.sessionId === selectedSessionId) {
            // 이 결과를 다시 적용하지 않도록 먼저 참조에서 지운다.
            pendingConversationResultRef.current = null;
            // 브라우저 이동 중 시작된 대화 GET을 모두 오래된 것으로 만든다.
            conversationRequestVersionRef.current += 1;
            // POST 성공 결과를 표시하므로 기록 GET 로딩은 끝낸다.
            setIsConversationLoading(false);
            // 서버가 반환한 대화 번호를 현재 대화로 저장한다.
            setActiveSessionId(pendingConversationResult.sessionId);
            // 사용자 질문과 AI 답변을 한 번에 같은 화면에 표시한다.
            setMessages(pendingConversationResult.messages);
            // 실제 POST 성공으로 새 답변이 도착했음을 한 번만 알린다.
            setAnswerAnnouncement("새 답변이 도착했습니다.");
            // 추가 대화 GET 없이 현재 effect를 끝낸다.
            return;
        }

        // 다른 기록으로 이동했다면 이전 새 대화 결과는 현재 화면에 적용하지 않는다.
        if (pendingConversationResult !== null) {
            // 해당 대화는 서버에 저장됐으므로 나중에 기록 GET으로 다시 열 수 있다.
            pendingConversationResultRef.current = null;
        }

        // 이미 화면에 불러온 같은 대화는 중복 조회하지 않는다.
        if (selectedSessionId === activeSessionId) {
            // 다른 대화에서 진행 중인 느린 GET이 현재 화면을 계속 잠그지 못하게 한다.
            conversationRequestVersionRef.current += 1;
            // 메모리에 남은 현재 대화를 즉시 다시 읽을 수 있게 로딩을 끝낸다.
            setIsConversationLoading(false);
            // 현재 메시지를 유지하고 추가 GET 없이 함수를 끝낸다.
            return;
        }

        // 선택한 저장 대화의 질문과 답변을 GET으로 조회한다.
        void loadConversation(selectedSessionId);
    }, [activeSessionId, loadConversation, selectedSessionId, sessionParam]);

    // 모바일 drawer가 열린 채 데스크톱 폭으로 바뀌면 모달 상태를 해제한다.
    useEffect(() => {
        // CSS breakpoint와 같은 900px 기준을 브라우저에서 감시한다.
        const desktopQuery = window.matchMedia("(min-width: 900px)");

        // 데스크톱 폭이 되면 drawer 전용 열린 상태를 지운다.
        function closeDrawerOnDesktop(event: MediaQueryListEvent | MediaQueryList): void {
            // 900px 이상으로 바뀐 경우에만 상태를 닫는다.
            if (event.matches) {
                // 일반 데스크톱 레일이 dialog로 발표되지 않게 한다.
                setIsHistoryOpen(false);
            }
        }

        // 첫 실행 시 이미 데스크톱인지 확인한다.
        closeDrawerOnDesktop(desktopQuery);
        // 이후 viewport 변화도 같은 함수로 처리한다.
        desktopQuery.addEventListener("change", closeDrawerOnDesktop);

        // 채팅 화면이 사라질 때 media query 이벤트를 제거한다.
        return () => {
            // 중복 viewport 처리와 메모리 누수를 막는다.
            desktopQuery.removeEventListener("change", closeDrawerOnDesktop);
        };
    }, []);

    // 모바일 drawer가 열렸을 때 Escape 키로 닫게 한다.
    useEffect(() => {
        // drawer가 닫혀 있으면 문서 이벤트를 만들지 않는다.
        if (!isHistoryOpen) {
            // 정리 함수 없이 현재 effect를 끝낸다.
            return undefined;
        }

        // Escape 키를 기록 drawer 닫기로 연결한다.
        function handleEscape(event: KeyboardEvent): void {
            // Tab 키는 열린 기록 drawer 안에서만 순환하게 한다.
            if (event.key === "Tab") {
                // 현재 열린 drawer 요소를 찾는다.
                const drawer = document.querySelector<HTMLElement>(".history-rail.is-open");
                // 비활성 요소를 제외한 조작 가능한 항목을 순서대로 찾는다.
                const focusableElements = drawer
                    ? Array.from(
                        drawer.querySelectorAll<HTMLElement>(
                            "button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled)",
                        ),
                    )
                    : [];
                // 첫 번째 조작 요소를 읽는다.
                const firstElement = focusableElements[0];
                // 마지막 조작 요소를 읽는다.
                const lastElement = focusableElements[focusableElements.length - 1];

                // drawer 안에 조작 요소가 없으면 Tab 기본 동작을 막는다.
                if (!firstElement || !lastElement) {
                    // focus가 뒤 화면으로 빠지지 않게 한다.
                    event.preventDefault();
                    // 추가 키 처리를 끝낸다.
                    return;
                }

                // Shift+Tab으로 첫 요소 앞을 벗어나려는지 확인한다.
                if (event.shiftKey && document.activeElement === firstElement) {
                    // 뒤 화면으로 focus가 이동하지 않게 한다.
                    event.preventDefault();
                    // 마지막 기록 조작 요소로 focus를 순환시킨다.
                    lastElement.focus();
                    // Escape 처리와 겹치지 않게 끝낸다.
                    return;
                }

                // Tab으로 마지막 요소 뒤를 벗어나려는지 확인한다.
                if (!event.shiftKey && document.activeElement === lastElement) {
                    // 뒤 화면으로 focus가 이동하지 않게 한다.
                    event.preventDefault();
                    // 첫 기록 조작 요소로 focus를 순환시킨다.
                    firstElement.focus();
                    // Escape 처리와 겹치지 않게 끝낸다.
                    return;
                }

                // 현재 focus가 drawer 밖이라면 첫 요소로 되돌린다.
                if (drawer && !drawer.contains(document.activeElement)) {
                    // 뒤 화면의 기본 Tab 이동을 막는다.
                    event.preventDefault();
                    // 첫 기록 조작 요소로 focus를 이동한다.
                    firstElement.focus();
                }

                // Tab 처리 뒤 Escape 분기를 실행하지 않는다.
                return;
            }

            // Escape 이외의 키는 원래 동작을 유지한다.
            if (event.key !== "Escape") {
                // 다른 키에 아무 영향 없이 함수를 끝낸다.
                return;
            }

            // 열린 drawer를 닫는다.
            setIsHistoryOpen(false);
            // drawer를 열었던 버튼으로 focus를 되돌린다.
            historyButtonRef.current?.focus();
        }

        // 현재 문서에 키보드 이벤트를 등록한다.
        document.addEventListener("keydown", handleEscape);

        // drawer가 닫히거나 화면이 사라질 때 이벤트를 제거한다.
        return () => {
            // 중복 키보드 실행을 막기 위해 같은 함수를 제거한다.
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isHistoryOpen]);

    // 모바일 기록 drawer를 열고 닫기 버튼으로 focus를 옮긴다.
    function openHistory(): void {
        // drawer가 보이도록 상태를 바꾼다.
        setIsHistoryOpen(true);
        // React 렌더가 끝난 다음 실제 닫기 버튼을 찾는다.
        window.setTimeout(() => {
            // 작은 화면에 보이는 닫기 버튼으로 키보드 focus를 옮긴다.
            document.querySelector<HTMLButtonElement>(".history-close")?.focus();
        }, 0);
    }

    // 모바일 기록 drawer를 닫고 원래 버튼으로 focus를 되돌린다.
    function closeHistory(): void {
        // drawer를 화면 밖으로 닫는다.
        setIsHistoryOpen(false);
        // drawer를 열었던 기록 버튼으로 키보드 focus를 되돌린다.
        historyButtonRef.current?.focus();
    }

    // 사용자가 기록에서 선택한 대화 번호를 URL에 반영한다.
    function selectSession(sessionId: number): void {
        // AI 요청 중에는 늦은 응답이 다른 화면에 섞이지 않게 이동을 막는다.
        if (isSending || isSessionTransitionPending) {
            // URL과 화면 상태를 바꾸지 않고 함수를 끝낸다.
            return;
        }

        // 이미 선택한 같은 대화는 URL 요청과 GET을 다시 만들지 않는다.
        if (sessionId === selectedSessionId) {
            // 모바일 drawer만 닫고 현재 대화를 그대로 유지한다.
            setIsHistoryOpen(false);
            // 중복 URL 전환 없이 함수를 끝낸다.
            return;
        }

        // 다른 대화에 남은 입력 오류를 지운다.
        setSendError("");
        // 이전 선택 대화의 느린 GET이 URL 전환 잠금을 조기에 풀지 못하게 무효화한다.
        conversationRequestVersionRef.current += 1;
        // 새 URL을 기다리는 동안 이전 대화 GET 로딩 상태를 끝낸다.
        setIsConversationLoading(false);
        // URL이 실제 선택 번호로 바뀔 때까지 composer와 기록 조작을 잠근다.
        setIsSessionTransitionPending(true);
        // 선택 대화를 새 history 항목으로 남겨 뒤로가기를 지원한다.
        setSearchParams({ session: String(sessionId) });
        // 작은 화면에서는 선택 뒤 기록 drawer를 닫는다.
        setIsHistoryOpen(false);
        // 렌더 뒤 주 대화 영역으로 키보드 focus를 옮긴다.
        window.setTimeout(() => chatMainRef.current?.focus(), 0);
    }

    // AI 요청 없이 완전히 빈 새 대화 상태를 만든다.
    function startNewQuestion(): void {
        // AI 요청 중에는 현재 요청의 도착 화면을 유지한다.
        if (isSending || isSessionTransitionPending) {
            // 화면과 URL을 바꾸지 않고 함수를 끝낸다.
            return;
        }

        // 진행 중인 이전 대화 GET을 오래된 것으로 만든다.
        conversationRequestVersionRef.current += 1;
        // 이전 대화 로딩 상태를 즉시 끝낸다.
        setIsConversationLoading(false);

        // 이미 query 없는 빈 대화면 불필요한 Router 전환 없이 상태만 정리한다.
        if (sessionParam === null && selectedSessionId === null) {
            // 현재 서버 대화 번호를 새 질문 상태로 확인한다.
            setActiveSessionId(null);
            // 이전 임시 질문이나 답변이 있다면 읽기 영역에서 지운다.
            setMessages([]);
        } else {
            // URL이 실제 빈 대화 주소가 될 때까지 composer와 기록 조작을 잠근다.
            setIsSessionTransitionPending(true);
            // 선택 query를 제거해 새 대화 URL로 바꾼다.
            setSearchParams({});
        }
        // 이전 질문 초안과 오류를 함께 지운다.
        setDraft("");
        // 이전 전송 오류를 지운다.
        setSendError("");
        // 이전 대화 조회 오류를 지운다.
        setConversationError("");
        // 이전 새 답변 도착 발표를 지운다.
        setAnswerAnnouncement("");
        // 모바일 drawer가 열렸다면 닫는다.
        setIsHistoryOpen(false);
        // 렌더 뒤 질문 입력칸으로 focus를 옮긴다.
        window.setTimeout(() => textareaRef.current?.focus(), 0);
    }

    // 질문을 검증한 뒤 채팅 API를 정확히 한 번 호출한다.
    async function submitQuestion(): Promise<void> {
        // 요청 중이거나 저장 대화를 읽는 중이면 중복 실행하지 않는다.
        if (
            chatSubmitLockRef.current
            ||
            isSending
            || isSessionTransitionPending
            || isConversationLoading
            || conversationError.length > 0
            || selectedSessionId !== activeSessionId
        ) {
            // 네트워크 요청 없이 함수를 끝낸다.
            return;
        }

        // 서버와 동일하게 질문의 앞뒤 공백을 제거한다.
        const trimmedQuestion = draft.trim();

        // 공백만 있는 질문은 프론트에서 먼저 막는다.
        if (trimmedQuestion.length === 0) {
            // 요구사항이 정한 정확한 오류 문장을 표시한다.
            setSendError("질문을 입력해주세요.");
            // AI 요청 없이 함수를 끝낸다.
            return;
        }

        // 서버와 같은 2,000자 제한을 다시 확인한다.
        if (trimmedQuestion.length > 2000) {
            // 요구사항이 정한 정확한 길이 오류 문장을 표시한다.
            setSendError("질문은 2,000자 이하로 입력해주세요.");
            // AI 요청 없이 함수를 끝낸다.
            return;
        }

        // 현재 화면에서 구분할 임시 질문 식별값을 만든다.
        const optimisticId = `local-${Date.now()}-${messages.length}`;
        // 서버 응답 전에 질문을 같은 화면에 표시할 객체를 만든다.
        const optimisticMessage: ChatMessage = {
            // 성공 또는 실패 뒤 정확히 찾을 임시 식별값이다.
            id: optimisticId,
            // 사용자가 작성한 질문임을 표시한다.
            role: "user",
            // 검증하고 공백을 제거한 실제 질문이다.
            content: trimmedQuestion,
            // 현재 시각은 화면 임시 표시용이며 서버 저장값을 대체하지 않는다.
            createdAt: new Date().toISOString(),
        };
        // 요청을 시작한 실제 대화 번호를 비동기 응답까지 고정한다.
        const requestSessionId = activeSessionId;
        // 브라우저 왕복 뒤에도 요청 시작 대화를 정확히 복원할 기존 메시지를 보관한다.
        const requestMessages = messages;
        // React state 반영 전 같은 tick의 두 번째 제출도 즉시 막는다.
        chatSubmitLockRef.current = true;
        // 병행 중인 기록 GET이 먼저 인증 만료돼도 보낼 질문을 잃지 않게 보관한다.
        inFlightQuestionRef.current = trimmedQuestion;

        // 이전 전송 오류를 지운다.
        setSendError("");
        // 새 요청이 시작되면 이전 답변 도착 발표를 지운다.
        setAnswerAnnouncement("");
        // 입력칸을 비우되 실패하면 원문을 다시 복구한다.
        setDraft("");
        // 기존 대화 뒤에 사용자 질문을 먼저 표시한다.
        setMessages((currentMessages) => [...currentMessages, optimisticMessage]);
        // 입력과 전송 버튼을 잠가 요청을 한 번으로 제한한다.
        setIsSending(true);

        // 백엔드 채팅 처리와 AI 답변 생성을 시도한다.
        try {
            // 현재 대화 번호와 질문을 POST /api/chat에 한 번 보낸다.
            const result = await sendChatMessage(requestSessionId, trimmedQuestion);

            // 사용자가 이미 채팅 화면을 떠났다면 서버 결과만 유지하고 UI 처리를 끝낸다.
            if (!isMountedRef.current) {
                // 다른 화면의 URL이나 상태를 바꾸지 않는다.
                return;
            }

            // 응답 도착 때도 사용자가 요청 시작 화면을 보고 있는지 확인한다.
            const isViewingRequestSession = selectedSessionIdRef.current === requestSessionId;

            // 같은 화면을 보고 있을 때만 현재 메시지와 URL을 바꾼다.
            if (isViewingRequestSession) {
                // 브라우저 이동 중 시작된 오래된 대화 GET을 모두 무효화한다.
                conversationRequestVersionRef.current += 1;
                // POST 성공 화면에서는 이전 GET 로딩 상태를 즉시 끝낸다.
                setIsConversationLoading(false);

                // 첫 질문에서 새 대화 번호가 생긴 경우에만 URL을 새 번호로 바꾼다.
                if (requestSessionId === null) {
                    // URL이 실제 새 번호에 도착할 때 적용할 질문과 답변을 보관한다.
                    pendingConversationResultRef.current = {
                        // 서버가 새로 만든 대화 번호다.
                        sessionId: result.sessionId,
                        // 요청 시작 대화, 사용자 질문, AI 답변을 순서대로 보관한다.
                        messages: [...requestMessages, optimisticMessage, result.message],
                    };
                    // 새 대화 번호가 URL에 반영될 때까지 두 번째 질문을 막는다.
                    setIsSessionTransitionPending(true);
                    // 새로고침 후 같은 대화를 복원할 수 있게 query에 번호를 남긴다.
                    setSearchParams(
                        { session: String(result.sessionId) },
                        { replace: true },
                    );
                } else {
                    // 기존 대화는 URL이 같으므로 현재 메시지 상태를 안전하게 갱신한다.
                    setMessages((currentMessages) => {
                        // 현재 화면에 요청 직전 임시 질문이 남아 있는지 확인한다.
                        const hasOptimisticQuestion = currentMessages.some(
                            // 같은 임시 식별값의 사용자 질문만 찾는다.
                            (message) => message.id === optimisticId,
                        );

                        // 임시 질문이 남아 있으면 그 뒤에 AI 답변만 추가한다.
                        if (hasOptimisticQuestion) {
                            // 현재 대화 흐름을 유지하며 답변을 마지막에 붙인다.
                            return [...currentMessages, result.message];
                        }

                        // URL 왕복이 화면을 덮었다면 요청 시작 대화와 새 문답을 복원한다.
                        return [...requestMessages, optimisticMessage, result.message];
                    });
                    // 실제 POST 성공 시점에만 보조기술에 새 답변을 알린다.
                    setAnswerAnnouncement("새 답변이 도착했습니다.");
                    // 기존 대화 번호를 현재 대화로 다시 확인한다.
                    setActiveSessionId(result.sessionId);
                }
            }

            // AI 호출 없는 기록 GET으로 제목과 목록을 갱신한다.
            void loadHistory(result.sessionId);
        } catch (error: unknown) {
            // 사용자가 이미 채팅 화면을 떠났다면 다른 화면을 바꾸지 않는다.
            if (!isMountedRef.current) {
                // 인증 이동과 상태 갱신 없이 서버 실패만 종료한다.
                return;
            }

            // 응답 실패 때도 사용자가 요청 시작 화면을 보고 있는지 확인한다.
            const isViewingRequestSession = selectedSessionIdRef.current === requestSessionId;

            // 같은 화면일 때만 임시 질문과 입력 초안을 되돌린다.
            if (isViewingRequestSession) {
                // 실패한 임시 질문은 읽기 영역에서 제거한다.
                setMessages((currentMessages) => currentMessages.filter((message) => message.id !== optimisticId));
                // 사용자가 직접 수정하거나 재시도할 수 있게 질문을 복구한다.
                setDraft(trimmedQuestion);
            }

            // 인증 만료는 로그인 이동까지 처리하고 일반 오류를 표시하지 않는다.
            if (handleExpiredAuthentication(error, trimmedQuestion)) {
                // 현재 채팅 화면의 추가 처리를 끝낸다.
                return;
            }

            // AI, DB, 네트워크 오류를 안전한 문장으로 표시한다.
            if (isViewingRequestSession) {
                // 현재 대화 입력기 가까이에 안전한 실패 문장만 표시한다.
                setSendError(getSafeErrorMessage(error));
            }
        } finally {
            // 같은 tick의 다음 사용자 제출을 다시 허용한다.
            chatSubmitLockRef.current = false;
            // 이 POST가 끝났으므로 인증 이동용 전송 질문 참조를 비운다.
            if (inFlightQuestionRef.current === trimmedQuestion) {
                // 다른 요청의 값은 건드리지 않고 현재 질문만 제거한다.
                inFlightQuestionRef.current = "";
            }

            // 현재 채팅 화면이 살아 있을 때만 React 상태와 focus를 바꾼다.
            if (isMountedRef.current) {
                // 성공과 실패 모두에서 전송 잠금을 해제한다.
                setIsSending(false);
                // 렌더 뒤 질문 입력칸으로 focus를 되돌린다.
                if (selectedSessionIdRef.current === requestSessionId) {
                    // 같은 질문 화면에 남아 있을 때만 textarea로 focus를 되돌린다.
                    window.setTimeout(() => textareaRef.current?.focus(), 0);
                }
            }
        }
    }

    // 사용자가 기록의 삭제 버튼을 누르면 확인 대상을 연다.
    function requestDelete(session: ChatSession): void {
        // AI 요청 중에는 현재 대화 기록을 바꾸는 삭제를 시작하지 않는다.
        if (isSending) {
            // 확인창이나 DELETE 요청 없이 함수를 끝낸다.
            return;
        }

        // 모바일 drawer에서 연 경우 모달이 두 겹이 되지 않게 먼저 닫는다.
        if (isHistoryOpen) {
            // dialog가 닫힐 때 돌아갈 보이는 상단 기록 버튼에 focus를 둔다.
            historyButtonRef.current?.focus();
            // drawer의 role=dialog와 키보드 trap을 해제한다.
            setIsHistoryOpen(false);
        }

        // 새 확인창에서는 이전 삭제 오류를 지운다.
        setDeleteError("");
        // 실제 삭제 전 제목을 확인할 수 있게 대상을 저장한다.
        setDeleteTarget(session);
    }

    // 확인창에서 취소하면 어떤 API도 호출하지 않고 닫는다.
    function cancelDelete(): void {
        // 삭제 요청 중에는 응답 전 확인창을 닫지 않는다.
        if (isDeleting) {
            // 상태 변경 없이 함수를 끝낸다.
            return;
        }

        // 확인 대상을 지워 확인창을 닫는다.
        setDeleteTarget(null);
        // 이전 오류 문장도 함께 지운다.
        setDeleteError("");
    }

    // 사용자가 확정한 대화만 DELETE API로 한 번 삭제한다.
    async function confirmDelete(): Promise<void> {
        // 대상이 없거나 이미 요청 중이면 아무 작업도 하지 않는다.
        if (deleteTarget === null || isDeleting) {
            // 중복 DELETE 요청 없이 함수를 끝낸다.
            return;
        }

        // 비동기 처리 중 대상이 바뀌지 않게 번호를 지역값으로 보관한다.
        const targetId = deleteTarget.id;
        // 이전 삭제 오류를 지운다.
        setDeleteError("");
        // 확인창 버튼을 잠가 중복 삭제를 막는다.
        setIsDeleting(true);

        // 서버 대화 삭제를 시도한다.
        try {
            // 사용자가 확인한 번호로 DELETE 요청을 한 번만 보낸다.
            await deleteChatSession(targetId);

            // 사용자가 이미 채팅 화면을 떠났다면 URL과 화면을 바꾸지 않는다.
            if (!isMountedRef.current) {
                // 서버 삭제 결과만 유지하고 이 컴포넌트의 UI 처리를 끝낸다.
                return;
            }

            // 진행 중인 이전 기록 GET이 삭제 항목을 복원하지 못하게 한다.
            historyRequestVersionRef.current += 1;
            // 삭제 뒤 기록 로딩 상태를 현재 목록 기준으로 끝낸다.
            setIsHistoryLoading(false);
            // 삭제된 대화를 현재 기록 목록에서 제거한다.
            setSessions((currentSessions) => currentSessions.filter((session) => session.id !== targetId));

            // 현재 읽던 대화를 삭제했다면 새 질문 상태로 돌아간다.
            if (selectedSessionIdRef.current === targetId) {
                // 진행 중인 삭제 대상 대화 GET을 오래된 것으로 만든다.
                conversationRequestVersionRef.current += 1;
                // 삭제 뒤 빈 URL이 반영될 때까지 기록과 composer 조작을 잠근다.
                setIsSessionTransitionPending(true);
                // 선택 query를 제거한다.
                setSearchParams({}, { replace: true });
            }

            // 성공했으므로 확인 대상을 지워 창을 닫는다.
            setDeleteTarget(null);
            // 모바일 기록 drawer도 닫아 새 상태를 명확히 보여준다.
            setIsHistoryOpen(false);
            // 렌더 뒤 남아 있는 질문 입력기로 논리적 focus를 옮긴다.
            window.setTimeout(() => textareaRef.current?.focus(), 0);
        } catch (error: unknown) {
            // 사용자가 이미 채팅 화면을 떠났다면 다른 경로를 바꾸지 않는다.
            if (!isMountedRef.current) {
                // 오류 UI나 로그인 이동 없이 처리를 끝낸다.
                return;
            }

            // 인증 만료는 로그인 이동까지 처리하고 일반 오류를 표시하지 않는다.
            if (handleExpiredAuthentication(error)) {
                // 현재 채팅 화면의 추가 처리를 끝낸다.
                return;
            }

            // 확인창 안에 안전한 실패 문장만 표시한다.
            setDeleteError(getSafeErrorMessage(error));
        } finally {
            // 현재 채팅 화면이 살아 있을 때만 삭제 잠금을 해제한다.
            if (isMountedRef.current) {
                // 성공과 실패 모두에서 삭제 잠금을 해제한다.
                setIsDeleting(false);
            }
        }
    }

    // 서버 쿠키 삭제 성공 뒤 랜딩 화면으로 이동한다.
    async function handleLogout(): Promise<void> {
        // 이미 요청 중이면 중복 로그아웃을 만들지 않는다.
        if (isLoggingOut) {
            // 두 번째 네트워크 요청 없이 함수를 끝낸다.
            return;
        }

        // 이전 계정 오류를 지운다.
        setAccountError("");
        // 로그아웃 버튼을 잠가 중복 요청을 막는다.
        setIsLoggingOut(true);

        // 서버 세션 쿠키 삭제를 시도한다.
        try {
            // POST /api/auth/logout을 한 번 호출한다.
            await signOut();
            // 사용자가 이미 다른 화면으로 이동했다면 현재 경로를 유지한다.
            if (!isMountedRef.current) {
                // 늦은 로그아웃 성공이 다른 화면 URL을 바꾸지 않게 한다.
                return;
            }
            // 인증 상태 정리 뒤 서비스 랜딩으로 이동한다.
            navigate("/", { replace: true });
        } catch (error: unknown) {
            // 현재 채팅 화면이 살아 있을 때만 오류를 표시한다.
            if (isMountedRef.current) {
                // 서버 쿠키가 남았을 수 있으므로 가짜 로그아웃 상태로 바꾸지 않는다.
                setAccountError(getSafeErrorMessage(error));
            }
        } finally {
            // 현재 채팅 화면이 살아 있을 때만 버튼 잠금을 해제한다.
            if (isMountedRef.current) {
                // 성공과 실패 모두에서 버튼 잠금을 해제한다.
                setIsLoggingOut(false);
            }
        }
    }

    // 데스크톱 2열과 모바일 drawer를 포함한 전체 채팅 화면을 반환한다.
    return (
        // 화면 높이를 채우는 채팅 앱 최상위 요소다.
        <div className="chat-app">
            {/* 서비스 정체성과 핵심 동작을 담은 고정 상단 바다. */}
            <header className="chat-topbar">
                {/* 모바일에서 기록 drawer를 여는 버튼이다. */}
                <button
                    // 닫힌 뒤 focus를 되돌릴 실제 버튼 참조다.
                    ref={historyButtonRef}
                    // form과 무관한 일반 버튼이다.
                    type="button"
                    // 데스크톱에서는 숨기고 모바일에서만 표시한다.
                    className="text-button mobile-history-button"
                    // 모바일 기록 drawer를 열고 focus를 이동한다.
                    onClick={openHistory}
                    // 보조기술에 drawer 제어 관계를 알린다.
                    aria-controls="conversation-history"
                    // drawer의 현재 열림 상태를 알린다.
                    aria-expanded={isHistoryOpen}
                >
                    기록
                </button>

                {/* 서비스 홈으로 이동하는 텍스트 정체성이다. */}
                <Link className="wordmark chat-wordmark" to="/">
                    EVERYTHING
                </Link>

                {/* 새 질문과 계정 동작을 한 줄에 배치한다. */}
                <nav className="chat-actions" aria-label="채팅 메뉴">
                    {/* 서버가 관리자라고 판정한 사용자에게만 운영 화면 링크를 표시한다. */}
                    {user?.isAdmin ? (
                        <Link className="text-button" to="/admin">관리자</Link>
                    ) : null}
                    {/* AI 요청 없이 빈 새 대화 상태를 만드는 버튼이다. */}
                    <button
                        // form과 무관한 일반 버튼이다.
                        type="button"
                        // 절제된 텍스트 버튼 스타일을 사용한다.
                        className="text-button"
                        // AI 호출 없이 빈 새 대화 상태를 만든다.
                        onClick={startNewQuestion}
                        // AI 응답 중 화면 전환으로 상태가 섞이지 않게 한다.
                        disabled={isSending || isSessionTransitionPending}
                    >
                        새 질문
                    </button>
                    {/* 현재 계정 이름은 넓은 화면에서만 보조 정보로 표시한다. */}
                    <span className="account-name">
                        {user?.username}
                    </span>
                    {/* 서버 세션 쿠키를 삭제하는 명시적 로그아웃 버튼이다. */}
                    <button
                        // form과 무관한 일반 버튼이다.
                        type="button"
                        // 텍스트 링크처럼 절제된 스타일을 사용한다.
                        className="text-button"
                        // 서버 로그아웃을 한 번 실행한다.
                        onClick={() => void handleLogout()}
                        // 요청 중 더블클릭을 막는다.
                        disabled={isLoggingOut || isSending}
                    >
                        {/* 현재 로그아웃 처리 상태를 정확히 표시한다. */}
                        {isLoggingOut ? "나가는 중…" : "로그아웃"}
                    </button>
                </nav>
            </header>

            {/* 모바일 drawer 뒤를 눌러 닫는 배경 버튼이다. */}
            {isHistoryOpen ? (
                <button
                    // form과 무관한 일반 버튼이다.
                    type="button"
                    // 화면 전체를 덮는 모바일 전용 배경 스타일이다.
                    className="history-backdrop"
                    // 배경을 누르면 drawer를 닫는다.
                    onClick={closeHistory}
                    // 보이는 텍스트 없이도 동작을 알 수 있는 이름이다.
                    aria-label="대화 기록 닫기"
                />
            ) : null}

            {/* 왼쪽 레일 또는 모바일 drawer에 날짜별 기록을 표시한다. */}
            <div id="conversation-history">
                <HistoryRail
                    // 서버에서 불러온 대화 목록이다.
                    sessions={sessions}
                    // 현재 선택한 대화 번호다.
                    selectedSessionId={selectedSessionId}
                    // 기록을 불러오는 상태다.
                    isLoading={isHistoryLoading}
                    // 기록 조회 실패의 안전한 문장이다.
                    errorMessage={historyError}
                    // 모바일 drawer의 현재 열림 상태다.
                    isOpen={isHistoryOpen}
                    // 모바일 drawer를 닫는 함수다.
                    onClose={closeHistory}
                    // 저장 대화를 선택하는 함수다.
                    onSelect={selectSession}
                    // 삭제 확인 대상을 여는 함수다.
                    onDelete={requestDelete}
                    // AI 응답을 기다리는 동안 기록 선택과 삭제를 잠근다.
                    isInteractionDisabled={isSending || isSessionTransitionPending}
                    // 기록 GET을 사용자 동작으로 다시 실행한다.
                    onRetry={() => void loadHistory()}
                />
            </div>

            {/* 키보드 바로가기의 도착점이자 주 대화 영역이다. */}
            <main
                // 키보드 바로가기와 기록 선택의 도착점 번호다.
                id="main-content"
                // 채팅 주 영역 스타일을 적용한다.
                className="chat-main"
                // 기록 선택 뒤 focus를 옮길 실제 요소 참조다.
                ref={chatMainRef}
                // 프로그램으로만 focus할 수 있고 일반 Tab 순서에는 넣지 않는다.
                tabIndex={-1}
            >
                {/* 로그아웃 실패를 계정 동작 가까이에 텍스트로 표시한다. */}
                {accountError ? (
                    <div className="account-error" role="alert">
                        {accountError}
                    </div>
                ) : null}

                {/* 질문과 답변을 스크롤할 수 있는 읽기 영역이다. */}
                <div className="conversation-scroll">
                    {/* 저장된 대화에는 문서 구조의 최상위 제목을 제공한다. */}
                    {messages.length > 0 && !isConversationLoading ? (
                        <h1 className="visually-hidden">{selectedSession?.title || "대화"}</h1>
                    ) : null}
                    {/* 대화 조회 실패 시 사용자 주도 재시도 수단을 제공한다. */}
                    {conversationError ? (
                        <div className="conversation-error" role="alert">
                            {/* 원시 서버 응답이 아닌 안전한 문장만 표시한다. */}
                            <p>{conversationError}</p>
                            {/* 유효한 선택 번호가 있을 때만 GET을 다시 실행한다. */}
                            {selectedSessionId !== null ? (
                                <button
                                    // form과 무관한 일반 버튼이다.
                                    type="button"
                                    // 절제된 텍스트 버튼 스타일을 사용한다.
                                    className="text-button"
                                    // 사용자가 원할 때만 대화 GET을 다시 보낸다.
                                    onClick={() => void loadConversation(selectedSessionId)}
                                >
                                    다시 불러오기
                                </button>
                            ) : null}
                        </div>
                    ) : null}

                    {/* 오류가 없을 때 빈 상태 또는 실제 대화를 표시한다. */}
                    {!conversationError ? (
                        <ConversationView
                            // 현재 대화의 질문과 답변 목록이다.
                            messages={messages}
                            // 저장된 대화를 읽는 중인지 나타낸다.
                            isLoading={isConversationLoading}
                            // 새 AI 답변을 기다리는 중인지 나타낸다.
                            isSending={isSending}
                            // 실제 POST 성공 시점에만 읽을 접근성 문장이다.
                            announcement={answerAnnouncement}
                        />
                    ) : null}
                </div>

                {/* 화면 하단 가까이에 항상 접근 가능한 질문 입력 영역이다. */}
                <div className="composer-shell">
                    <QuestionComposer
                        // 새 질문 때 focus할 textarea 참조다.
                        ref={textareaRef}
                        // 현재 질문 초안을 표시한다.
                        value={draft}
                        // 입력 변화를 부모 상태에 반영하고 이전 오류를 지운다.
                        onChange={(value) => {
                            // 사용자가 입력한 값을 질문 초안에 저장한다.
                            setDraft(value);
                            // 수정이 시작되면 이전 전송 오류를 지운다.
                            setSendError("");
                        }}
                        // 버튼과 Enter가 같은 질문 전송 함수를 실행한다.
                        onSubmit={() => void submitQuestion()}
                        // AI 응답을 기다리는 중인지 나타낸다.
                        isSending={isSending}
                        // 대화 로딩 또는 조회 오류 중에는 잘못된 세션 전송을 막는다.
                        isDisabled={
                            isConversationLoading
                            || isSessionTransitionPending
                            || conversationError.length > 0
                            || selectedSessionId !== activeSessionId
                        }
                        // 입력 가까이에 표시할 안전한 오류 문장이다.
                        errorMessage={sendError}
                    />
                    {/* AI 답변이 항상 완전하지 않을 수 있음을 짧게 알린다. */}
                    <p className="answer-disclaimer">AI 답변은 틀릴 수 있으므로 중요한 정보는 다시 확인하세요.</p>
                </div>
            </main>

            {/* 삭제 대상을 선택했을 때만 접근성 확인창을 연다. */}
            {deleteTarget ? (
                <ConfirmDialog
                    // 사용자가 확인할 서버 제공 대화 제목이다.
                    title={deleteTarget.title}
                    // DELETE 요청 진행 상태다.
                    isDeleting={isDeleting}
                    // 삭제 실패의 안전한 문장이다.
                    errorMessage={deleteError}
                    // API 호출 없이 확인창을 닫는 함수다.
                    onCancel={cancelDelete}
                    // 사용자가 확정한 DELETE 요청 함수다.
                    onConfirm={() => void confirmDelete()}
                />
            ) : null}
        </div>
    );
}
