# Task List — EVERYTHING

## Agent 1 — `feature/core-backend-ai`

- FastAPI app initialization
- configuration management
- DB models (`users`, `chat_sessions`, `messages`)
- authentication backend (register/login/logout/me)
- authorization (session-based, per-user isolation)
- OpenRouter client (free-tier only, no paid fallback)
- context builder (recent ~10 messages, bounded size)
- chat API (`POST /api/chat`)
- persistence (message save, request_id, status, latency)
- history API (`GET /api/chats`, `GET /api/chats/{id}`, `DELETE /api/chats/{id}`)
- backend integration / contract stability (`docs/API_CONTRACT.md`)

## Agent 2 — `feature/frontend-experience`

- design system (typography, spacing, color — Wikipedia/Perplexity/Kagi inspired, not cloned)
- landing page (`/`)
- login page (`/login`)
- register page (`/register`)
- chat empty state
- chat conversation state
- composer (question input, submit, follow-up)
- history rail (list/revisit previous conversations)
- loading/error states (mapped to `docs/API_CONTRACT.md` error codes)
- responsive layout
- backend integration (fetch calls against Agent 1's API)

*Depends on Agent 1 stabilizing the auth + chat API shape before final
wiring, though UI work (markup/CSS/static states) can start immediately.*

## Agent 3 — `feature/qa-ops-docs`

- environment safety audit (`.env` never committed, no hard-coded keys)
- health test (`GET /health`)
- auth tests (register/login/logout/me, session handling)
- chat validation tests (`EMPTY_INPUT`, `INPUT_TOO_LONG`, `AUTH_REQUIRED`)
- mocked AI success/failure tests (timeout, rate limit, API error — never
  hitting the real OpenRouter API)
- user isolation tests (one user cannot read/delete another's sessions)
- logs verification (operational events present, no sensitive data logged)
- DB inspection script(s) under `scripts/`
- evaluator checklist
- README verification (claims match actual implemented state)
- deployment/setup documentation

*Depends on Agent 1's models/routes existing before most tests can be
written meaningfully; test scaffolding and mocking harness can start
immediately.*
