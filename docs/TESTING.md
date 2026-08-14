# Testing — EVERYTHING

## Backend (`pytest -q` from the repo root)

Every test mocks the AI call and blocks external sockets
(`tests/conftest.py::block_external_network`) — no test run ever spends
real OpenRouter quota.

### What each file owns

| File | Verifies |
|---|---|
| `test_health.py` | `/health` is public and makes zero AI calls |
| `test_auth.py` | register/duplicate/login/logout, the registration race condition, username charset |
| `test_chat.py` | input validation, one AI call per question, follow-up context, list/get/delete ownership, per-user rate limit |
| `test_ai.py` | the OpenRouter request body, the free-model fallback list, timeout/429/5xx/malformed responses, paid-model and missing-key guards |
| `test_admin.py` | `/api/admin/logs` auth (401) / authorization (403) / response shape (200) |
| `test_operations.py` | logs carry lifecycle events and `request_id`/`user_id`/`latency_ms` but never question/answer text, passwords, or API keys |
| `test_config.py` | production refuses to start with the default `SECRET_KEY` (subprocess, since import-time behavior can't be tested via a normal import) |
| `test_spa.py` | `/api/*` 404s as JSON vs. non-API paths falling back to the SPA — skips if `frontend/dist` isn't built |

### Deliberately not tested here

- **Real OpenRouter calls.** Every AI interaction is mocked. Free-tier
  quota isn't a thing to spend on CI runs.
- **Frontend E2E / browser automation.** `frontend/`'s vitest suite covers
  component behavior; this suite covers the API contract. A browser-driven
  E2E layer connecting the two would be speculative infrastructure for a
  project this size — add it if a bug ever slips through the seam between
  them, not before.
- **Concurrency/load.** The app assumes one process, one SQLite file, low
  concurrency (see `docs/DEPLOYMENT_CHECKLIST.md`); the rate limiter's
  in-process state makes the same assumption. Nothing here tests behavior
  under real concurrent load.

### Removed: `tests/test_smoke.py`

Was Agent 1's own pre-QA-suite self-check (predated `test_auth.py` /
`test_chat.py` / `test_ai.py` / `test_health.py`, kept afterward only to
satisfy an old Definition-of-Done checkbox). By the time it was removed,
all 10 of its tests were fully superseded by an equivalent or stronger
test elsewhere — kept only as maintenance burden and an "why do these two
suites overlap" question waiting to happen:

| test_smoke.py test | Superseded by |
|---|---|
| `test_health` | `test_health.py` (also asserts zero AI calls) |
| `test_register_login_me_logout` | `test_auth.py` (register+session, logout blocks `/me`, login) |
| `test_duplicate_registration_rejected` | `test_auth.py` (covers username *and* email conflicts) |
| `test_chat_requires_auth` | `test_auth.py` (covers chat, chats, chats/id, delete) |
| `test_chat_rejects_empty_and_too_long_input` | `test_chat.py` (also asserts the AI mock is never called) |
| `test_chat_success_creates_session_and_followup_uses_context` | `test_chat.py` (split into focused tests) |
| `test_user_cannot_access_or_delete_another_users_session` | `test_chat.py` |
| `test_ai_timeout_is_translated_and_does_not_crash` | `test_ai.py` (parametrized, also checks no secret leak) |
| `test_ai_rate_limit_is_translated` | `test_ai.py` (same parametrized test) |
| `test_ai_generic_error_is_translated` | `test_ai.py` (same parametrized test) |

The `registered_user` fixture in `tests/conftest.py` was only used by that
file and was removed with it.

## Frontend (`npm test` / `npx vitest run` from `frontend/`)

35 tests across 9 files, reviewed for the same "is this redundant or
unclear" question the backend suite got — nothing removed here, each file
covers a distinct concern with no overlap found:

| File | Verifies |
|---|---|
| `api/client.test.ts` | every API function sends the exact request contract (fields, `credentials: "include"`, method) and maps server/network errors to safe codes/messages without leaking raw server text |
| `auth/AuthContext.test.tsx` | session-check vs. mutation errors stay distinct, a stale initial `/me` response can't overwrite a newer login, and login+register can't run concurrently |
| `components/QuestionComposer.test.tsx` | Enter submits, Shift+Enter doesn't, submit is blocked while sending |
| `components/ConversationView.test.tsx` | AI answer content is rendered as escaped text, not HTML (XSS) |
| `pages/AuthPages.test.tsx` | navigating away during login/register doesn't let a late success redirect the user back |
| `pages/ChatPage.test.tsx` | the request-version/mount-guard logic in `ChatPage.tsx`: stale session-switch responses, a late POST after unmount, a submitted question surviving a mid-flight auth expiry, no duplicate GETs on state transitions |
| `lib/dateTime.test.ts` | server timestamps without a timezone offset are treated as UTC, not local time |
| `lib/errorMessages.test.ts` | the exact required Korean error strings, and that unknown codes fall back to a generic message instead of leaking the code |
| `lib/navigationState.test.ts` | pending-question length cap, and that a `next=` redirect query can't point off-site (open-redirect guard) |

The `ChatPage.test.tsx` and `AuthContext.test.tsx` tests look elaborate
for what they assert, but each one is pinned to a specific race the
component's ref-guard code (`isMountedRef`, `*RequestVersionRef`,
`chatSubmitLockRef`) exists to prevent — removing the "elaborate" setup
would just mean the race stops being tested, not that the test is
over-engineered.
