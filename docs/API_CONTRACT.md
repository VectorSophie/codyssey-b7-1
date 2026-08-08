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

## Chat response (concept)

```json
{
  "success": true,
  "session_id": 1,
  "message": {
    "role": "assistant",
    "content": "..."
  }
}
```

## Error codes

User-facing error codes the frontend should handle explicitly:

```
EMPTY_INPUT
INPUT_TOO_LONG
AUTH_REQUIRED
AI_TIMEOUT
AI_RATE_LIMIT
AI_API_ERROR
DB_SAVE_ERROR
INTERNAL_ERROR
```

## Input constraints

- blank messages are rejected (`EMPTY_INPUT`)
- maximum user question length: 2000 characters (`INPUT_TOO_LONG`)

## Auth model

Server-side session handling (cookie-based). `GET /api/auth/me` returns the
current authenticated user, or `AUTH_REQUIRED` if unauthenticated.
