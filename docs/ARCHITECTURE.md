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
