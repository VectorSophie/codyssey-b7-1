# Architecture — EVERYTHING

## Flow

```
Browser (React SPA)
  -> FastAPI JSON API
       -> Authentication (server-side session)
       -> Chat Router
            -> Context Service (recent-message window)
            -> OpenRouter (openrouter/free)
            -> Persistence
                 -> SQLite (via SQLAlchemy)
  -> Response back to Browser
```

## Frontend

**Deviation from the original plan, reviewed and accepted:** the project
was originally scoped for Jinja2 server-rendered templates + vanilla
JavaScript, explicitly ruling out React/Vue/Next.js and a Node build
pipeline, to keep the stack simple and evaluable. Agent 2 built the
frontend as a React 19 + Vite + TypeScript single-page app under
`frontend/`, calling the backend purely as a JSON API (see
`frontend/src/api/client.ts`), rather than using `app/templates/` +
`app/static/`. This was accepted after review rather than rebuilt, since
it was already working, tested UI code and a full rewrite would have
discarded that work for a stylistic-only gain. `app/templates/` and
`app/static/` remain in the repo as the minimal placeholder pages from
Agent 1's backend bootstrap; they are not the served frontend.

## Backend

FastAPI. Server-side session/auth handling (no client-side token
management beyond a session cookie).

## Persistence

SQLite via SQLAlchemy. Core tables: `users`, `chat_sessions`, `messages`.
See `docs/API_CONTRACT.md` for the request/response shapes these back.

## AI Integration

OpenRouter only, via `https://openrouter.ai/api/v1/chat/completions`,
using the `openrouter/free` model exclusively. One AI call per user
question — no AI calls for titles, summaries, classification, moderation,
or background/prefetch work. At most one controlled retry on transient
network failure (preferably none). The app must remain usable if
OpenRouter is unavailable or rate-limited (return `AI_TIMEOUT` /
`AI_RATE_LIMIT` / `AI_API_ERROR` and preserve the user's question).

## Context Strategy

Approximately the most recent 10 messages of a conversation, subject to a
bounded character/token cap, sent as context on each new question.

## Conversation Titles

Derived directly from the first user question in a session (no AI call
involved).

## Operational Logging

Structured events per chat request, all tagged with a `request_id`:

```
request_received
ai_call_start
ai_call_success
ai_call_failed
db_save_success
db_save_failed
```

Never log passwords, API keys, session cookies, or full auth headers.
Avoid logging full conversation content unless explicitly needed for
debugging a specific issue.

## Future Extensibility (not built now)

Retrieval/grounding (e.g. Wikipedia API integration) is explicitly out of
scope for the MVP. The context/service layering should not preclude adding
it later, but no groundwork beyond that should be built speculatively now.

## Design decisions (evaluator Q&A)

Questions raised during review, answered here rather than only verbally,
since undocumented reasoning reads as luck rather than intent.

**Why is `handle_chat` `async` when only one line (`await
call_openrouter(...)`) actually awaits anything?** That single await is the
only I/O in the request that can take a meaningful amount of wall-clock
time — up to `AI_TIMEOUT_SECONDS` (20s) waiting on OpenRouter. Everything
else in the function is synchronous SQLite work, which is fast enough that
making it async too would add complexity (an async DB driver, an async
session lifecycle) without a measurable benefit at this project's scale —
one FastAPI process, one SQLite file, low concurrency. The point of the
`await` is that while it's waiting on the network, the event loop is free
to run other requests; a fully synchronous handler could not do that. It's
not "async because the language allows it everywhere" — it's async at
exactly the one point where yielding control is worth something. This
tradeoff is also called out as a known limit in
`docs/DEPLOYMENT_CHECKLIST.md` (the sync session is still held open across
that await); the fix if this ever needs to scale further is a fully async
DB session, not sprinkling more `await` in.

**Why no streaming?** Streaming is the SSE/WebSocket-shaped version of a
much bigger scope: partial-response persistence, mid-stream failure
handling, and a client that can resume or discard a half-received answer.
The project's hard constraint is "exactly one OpenRouter call per
question, at most one controlled retry" — getting *that* reliable already
took real debugging work (see the `openrouter/free` auto-router incident
in `app/services/ai.py` and PR #8/#9). Streaming would multiply the
failure surface of an already fragile free-tier dependency for a UX gain
that isn't part of the evaluated spec. It's a reasonable next step, not an
oversight — the response shape (`session_id` + one `message`) doesn't
preclude adding it later.

**Why `raise AppError(...)` instead of returning an error value?**
(`app/dependencies.py::require_auth`, `app/services/chat.py::get_owned_session`,
and every validation check in `handle_chat`.) Domain errors here are
translated to HTTP responses by one central handler
(`app.errors.AppError` -> caught in `app/main.py`), not by the caller.
Returning error values instead would mean every router function has to
remember to check and translate them — easy to forget, and each miss is a
silent 200 with a wrong body. Raising makes "this request cannot
continue" impossible to accidentally ignore: it either gets deliberately
caught, or it propagates to the one place that turns it into the correct
status code and `error_code`. Return values are still used everywhere the
result is genuinely optional data, not an error — e.g. `get_current_user`
returns `User | None` because "not logged in" is a normal state a caller
is expected to branch on, not a failure to short-circuit.

**Why no CSRF token, given cookies are used for auth?** The session cookie
is `SameSite=Lax` (`app/routers/auth.py::_set_session_cookie`), which
browsers already withhold on cross-site POST/PUT/DELETE requests (it's only
sent on top-level navigation, i.e. plain GET-by-link) -- that blocks the
classic auto-submitting-form CSRF attack without a token. Combined with
there being no CORS middleware (the SPA and API are same-origin, per
`app/main.py`), a cross-site `fetch`/XHR can't attach the cookie either. A
CSRF token would be redundant defense-in-depth here, not a missing control.

**What stops a duplicate `POST /api/chat` (double-click, flaky network
retry) from creating two AI calls and two messages for one question?**
The frontend (`ChatPage.tsx`'s `chatSubmitLockRef` plus `isSending`)
prevents this from the UI, but that's a client-side convenience, not a
guarantee -- a raw duplicate HTTP request (curl, a retrying proxy) isn't
stopped by it. There is no server-side idempotency key. This is a real,
accepted gap for the MVP: true idempotency (client-generated request key,
server dedupes by it) is the correct fix if this becomes a problem, but
wasn't built speculatively without a concrete failure driving it. The
per-user rate limit below is a different, coarser guard: it caps sustained
abuse, not a single accidental double-submit.

**Why did `app/routers/chat.py` used to have DB queries directly in two
routes (`list_chats`, `delete_chat`) while `post_chat`/`get_chat` went
through `app/services/chat.py`?** It shouldn't have — that was a real
inconsistency, not an intentional layering choice, caught in review. Fixed
by moving the query and the delete into `list_sessions()` /
`delete_session()` in `app/services/chat.py`, so routers now only do HTTP
wiring (parse the request, call one service function, shape the response)
and every DB access lives in the service layer.
