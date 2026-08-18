// 로그인한 사용자의 공개 정보를 표현한다.
export interface User {
    // 데이터베이스가 부여한 사용자 번호다.
    id: number;
    // 로그인과 화면 표시에 사용하는 사용자 이름이다.
    username: string;
    // 회원가입 때 등록한 이메일 주소다.
    email: string;
    // 계정이 생성된 시각을 ISO 문자열로 보관한다.
    createdAt: string;
    // 서버가 ADMIN_USERNAMES를 기준으로 판정한 관리자 메뉴 표시값이다.
    isAdmin: boolean;
}

// 관리자 화면에서 users 테이블 한 행을 표현한다.
export interface AdminUser {
    // 사용자 DB 기본키다.
    id: number;
    // 로그인과 화면 표시에 사용하는 사용자 이름이다.
    username: string;
    // 회원가입 때 등록한 이메일 주소다.
    email: string;
    // 계정이 생성된 시각이다.
    createdAt: string;
}

// 관리자 화면에서 chat_sessions 테이블 한 행을 표현한다.
export interface AdminSession {
    // 대화방 DB 기본키다.
    id: number;
    // 대화방 소유자의 사용자 기본키다.
    userId: number;
    // 첫 질문에서 만든 대화 제목이다.
    title: string;
    // 대화방이 생성된 시각이다.
    createdAt: string;
    // 대화방이 마지막으로 갱신된 시각이다.
    updatedAt: string;
}

// 관리자 화면에서 messages 테이블 한 행을 표현한다.
export interface AdminMessage {
    // 메시지 DB 기본키다.
    id: number;
    // 메시지가 속한 대화방 기본키다.
    sessionId: number;
    // 메시지 작성 주체다.
    role: "user" | "assistant";
    // 질문 또는 AI 답변 원문이다.
    content: string;
    // 서버 운영 로그와 연결할 요청 번호다.
    requestId: string;
    // 메시지 저장 상태다.
    status: string;
    // AI 답변 지연 시간이며 사용자 질문은 null일 수 있다.
    latencyMs: number | null;
    // 메시지가 생성된 시각이다.
    createdAt: string;
}

// 관리자 화면이 한 요청으로 받을 세 SQLite 테이블을 표현한다.
export interface AdminDatabase {
    // password_hash가 제외된 users 전체 행이다.
    users: AdminUser[];
    // chat_sessions 전체 행이다.
    sessions: AdminSession[];
    // messages 전체 행이다.
    messages: AdminMessage[];
}

// 왼쪽 기록 목록에 표시할 대화 한 건을 표현한다.
export interface ChatSession {
    // 데이터베이스가 부여한 대화 번호다.
    id: number;
    // 첫 질문에서 서버가 만든 대화 제목이다.
    title: string;
    // 대화가 처음 생성된 시각이다.
    createdAt: string;
    // 대화가 마지막으로 갱신된 시각이다.
    updatedAt: string;
}

// 화면에 표시할 질문 또는 답변 한 건을 표현한다.
export interface ChatMessage {
    // 서버 메시지는 숫자이고 전송 직후 임시 메시지는 문자열이다.
    id: number | string;
    // 메시지를 작성한 주체를 사용자와 AI로 제한한다.
    role: "user" | "assistant";
    // 질문 또는 답변의 원문이다.
    content: string;
    // 메시지가 생성된 시각을 ISO 문자열로 보관한다.
    createdAt: string;
}

// 선택한 대화의 제목과 전체 메시지를 함께 표현한다.
export interface ChatDetail {
    // 선택한 대화의 요약 정보다.
    session: ChatSession;
    // 서버가 저장한 질문과 답변 목록이다.
    messages: ChatMessage[];
}

// 질문 전송 성공 뒤 필요한 결과만 표현한다.
export interface ChatSendResult {
    // 새 대화 또는 이어지는 대화의 번호다.
    sessionId: number;
    // 서버가 생성해 저장한 AI 답변이다.
    message: ChatMessage;
}

// 회원가입 API에 전달할 필드만 표현한다.
export interface RegisterInput {
    // 로그인에 사용할 사용자 이름이다.
    username: string;
    // 계정 확인에 사용할 이메일 주소다.
    email: string;
    // 서버에서 해시 처리할 원본 비밀번호다.
    password: string;
}

// 로그인 API에 전달할 필드만 표현한다.
export interface LoginInput {
    // 실제 백엔드가 지원하는 사용자 이름이다.
    username: string;
    // 입력 즉시 서버로 보내고 저장하지 않을 비밀번호다.
    password: string;
}
