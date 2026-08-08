# Evaluator demo checklist

This sequence is designed for a short, reproducible demonstration. Keep the
server terminal visible so the structured lifecycle events can be shown.

## Before the demo

```bash
source .venv/bin/activate
pytest -q
git status --short --branch
git branch -a
git check-ignore -v .env
uvicorn app.main:app --reload
```

The test run must pass without a real OpenRouter request. The test fixture
blocks external network sockets and supplies only a fake test key.

## Browser flow

- [ ] Open `/register` and create an account.
- [ ] Log in if the registration flow does not leave the browser signed in.
- [ ] Open `/chat`.
- [ ] Submit a blank or whitespace-only message; show `EMPTY_INPUT`.
- [ ] Ask `판 구조론이 뭐야?`.
- [ ] Ask the follow-up `그럼 지진이랑 무슨 관계야?`.
- [ ] Show that the answer uses the previous turn as context.
- [ ] Reload the page and reopen the saved conversation from history.
- [ ] Log out.
- [ ] Attempt `POST /api/chat` or revisit protected chat history; show
  `AUTH_REQUIRED`.

The final UI is owned by Agent 2. If it has not yet been integrated, perform
the same flow with the API examples in the README or FastAPI's `/docs` page.

## Database and logs

Stop the server only if SQLite is locked, then run:

```bash
sqlite3 -header -column app.db < scripts/check_logs.sql
```

- [ ] Correlate the response `X-Request-ID`, lifecycle log, and message rows.
- [ ] Show `request_received`, `ai_call_start`, `ai_call_success`, and
  `db_save_success` in the server terminal.
- [ ] Confirm the query does not select password hashes.

## Safe failure demonstration

Do not consume OpenRouter quota merely to demonstrate a failure. Use the
mocked tests instead:

```bash
pytest -q tests/test_ai.py tests/test_operations.py
```

- [ ] Point out timeout, 429, upstream 500, malformed-response, missing-key,
  and paid-model rejection tests.
- [ ] Show that client responses contain controlled error codes and no raw
  exception text.
- [ ] Show that tests block external sockets.

## Git and secret handling

```bash
git log --oneline --decorate --graph --all
git ls-files | grep -E '(^|/)\.env$' || true
git grep -n -E 'sk-or-|OPENROUTER_API_KEY=.+'
```

- [ ] Show feature branches and PR/commit history.
- [ ] Confirm `.env` is ignored and not committed.
- [ ] Confirm `.env.example` contains no real secret.
- [ ] Confirm the only permitted model is `openrouter/free`.
