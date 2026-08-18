# API Contract — EVERYTHING

> Initial coordination contract — implementation may refine details through
> documented changes. Agent 1 must update this document if the backend
> implementation deliberately changes the contract. Agent 2 should treat
> this as the initial frontend integration contract.

## Routes

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

POST   /api/chat
GET    /api/chats
GET    /api/chats/{session_id}
DELETE /api/chats/{session_id}

GET    /api/admin/logs
GET    /api/admin/database

GET    /health
```

## Chat request

```json
{
  "session_id": null,
  "message": "블랙홀이 뭐야?"
}
```

`session_id: null` starts a new conversation; a non-null id continues an
existing one.

## Chat response (implemented)

Every `POST /api/chat` response, including authentication and validation
failures, includes an `X-Request-ID` header. Successful requests persist the
same id on both the user and assistant messages so an evaluator can correlate
the HTTP request, operational logs, and database rows.

```json
{
  "success": true,
  "session_id": 1,
  "message": {
    "id": 42,
    "role": "assistant",
    "content": "...",
    "created_at": "2026-08-08T12:00:00Z"
  }
}
```

## History responses (implemented)

`GET /api/chats`:

```json
{ "success": true, "sessions": [ { "id": 1, "title": "...", "created_at": "...", "updated_at": "..." } ] }
```

`GET /api/chats/{session_id}`:

```json
{
  "success": true,
  "session": { "id": 1, "title": "...", "created_at": "...", "updated_at": "..." },
  "messages": [ { "id": 1, "role": "user", "content": "...", "created_at": "..." } ]
}
```

`DELETE /api/chats/{session_id}` -> `{ "success": true }`

## Error response shape (implemented)

Every error (validation, auth, ownership, AI failure, DB failure) returns:

```json
{ "success": false, "error_code": "AUTH_REQUIRED", "message": "human-readable detail" }
```

## Error codes

Original contract codes:

```
EMPTY_INPUT       400
INPUT_TOO_LONG    400
AUTH_REQUIRED     401
AI_TIMEOUT        504
AI_RATE_LIMIT     429
AI_API_ERROR      502
DB_SAVE_ERROR     500
INTERNAL_ERROR    500  (uncaught/unexpected exceptions)
```

### Extensions (documented deviations, added by Agent 1)

The original 8 codes didn't cover registration conflicts, bad login, or
accessing another user's conversation. Added, following the same
`{success, error_code, message}` shape:

```
USERNAME_TAKEN      400  — register: username already exists
EMAIL_TAKEN         400  — register: email already exists
INVALID_CREDENTIALS 401  — login: unknown username or wrong password
NOT_FOUND           404  — chat session doesn't exist or isn't owned by
                            the requesting user (both cases return the
                            same response so existence isn't leaked)
TOO_MANY_REQUESTS   429  — more than 20 chat requests from one user within
                            60 seconds (see "Per-user chat rate limit" below)
ADMIN_REQUIRED      403  — authenticated, but not listed in ADMIN_USERNAMES
                            (see "Admin log access" below)
```

## Input constraints

- blank messages are rejected (`EMPTY_INPUT`)
- maximum user question length: 2000 characters (`INPUT_TOO_LONG`)
- username: 3-50 chars; password: min 8 chars (registration)

## OpenRouter cost guard

The AI boundary fails closed unless `OPENROUTER_MODEL` is exactly
`openrouter/free`. A missing API key or any other model value produces the
controlled `AI_API_ERROR` path without opening a network connection. There is
no retry loop and no paid fallback.

## Per-user chat rate limit

`AI_RATE_LIMIT` (429) only fires once OpenRouter's shared free-tier quota is
already exhausted -- it protects OpenRouter, not the other users of this
app. A separate application-level guard rejects a single user's 21st chat
request within a rolling 60-second window with `TOO_MANY_REQUESTS` (429),
before an OpenRouter call is made, so one careless or scripted client can't
burn the shared quota for everyone else. The window (not a flat per-message
cooldown) is deliberate: a real follow-up question seconds after the last
one is normal and must not be throttled. Implemented as an in-process
dict in `app/services/chat.py`; correct for this project's single-instance
deployment (see `docs/ARCHITECTURE.md`), and would need a shared store
(e.g. Redis) only if ever run with more than one worker process.

## Admin database access

`GET /api/admin/logs` returns every message joined with its session and user.
`GET /api/admin/database` returns every row from `users`, `chat_sessions`, and
`messages`, preserving primary and foreign keys so the `/admin` page can show
the relationships directly. Both responses deliberately exclude
`users.password_hash`: a password hash is an authentication secret, not
administrator-facing personal information. Both routes also send
`Cache-Control: no-store, private` and `Pragma: no-cache` so browsers and
intermediate caches do not retain the private response.

Both routes are gated by
`require_admin` (`app/dependencies.py`), which checks the requesting
user's username against `ADMIN_USERNAMES`. No `is_admin` database column:
this project has no migration tooling (`Base.metadata.create_all()` only
creates missing tables, it never alters an existing one), so a new column
wouldn't retroactively apply to an already-deployed database without a
manual `ALTER TABLE`. A config-driven allowlist works immediately and needs
no schema change; it doesn't scale past "a small, fixed set of trusted
operators," which is what this project actually has.

Authentication responses include `user.is_admin` so the frontend can show the
administrator navigation only when useful. That value is only a display hint;
the server does not trust it and repeats the `require_admin` check for every
administrator API request.

## Auth model

Server-side session handling via a signed, httponly cookie
(`SESSION_COOKIE_NAME`, default `everything_session`) containing the user id
and an expiry, HMAC-signed with `SECRET_KEY` — no server-side session table.
`register` and `login` both set the cookie. `GET /api/auth/me` returns the
current authenticated user, or `AUTH_REQUIRED` if unauthenticated/expired.
Chat and history endpoints all require authentication and are ownership
scoped: a user can never read or delete another user's session (returns
`NOT_FOUND`, not a permission-specific error, to avoid leaking existence).
