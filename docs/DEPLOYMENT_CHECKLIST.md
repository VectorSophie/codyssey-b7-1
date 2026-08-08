# Deployment readiness checklist

EVERYTHING is a small SQLite/FastAPI MVP. Deploy one application instance with
a persistent writable directory for the database; multi-instance deployment
and database migrations are intentionally outside the current scope.

## Required configuration

- [ ] Create a production `.env` outside version control.
- [ ] Set `APP_ENV=production`.
- [ ] Generate a long random `SECRET_KEY`; do not reuse the development value.
- [ ] Set `OPENROUTER_API_KEY` without printing it to logs.
- [ ] Keep `OPENROUTER_MODEL=openrouter/free` exactly.
- [ ] Set `SESSION_HTTPS_ONLY=true` when TLS is enabled.
- [ ] Point `DATABASE_URL` at a persistent, backed-up SQLite file.
- [ ] Set a suitable `LOG_LEVEL`, normally `INFO`.

## Preflight

```bash
python -m pytest -q
python -m compileall -q app tests
git status --short
git check-ignore -v .env
```

- [ ] All tests pass with external network blocked.
- [ ] `/health` returns `{"status":"ok"}` without authentication or AI use.
- [ ] `.env`, database files, logs, and virtual environments are untracked.
- [ ] The database directory is writable by the application process.
- [ ] A recent SQLite backup can be restored.
- [ ] TLS terminates before the application and secure cookies are enabled.

## Start and verify

Example single-instance command behind a TLS reverse proxy:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

After startup:

- [ ] Request `/health`.
- [ ] Register a disposable user and complete one mocked/staging chat flow.
- [ ] Confirm the four success lifecycle events share one `request_id`.
- [ ] Confirm logs contain no credentials, cookies, API keys, or message text.
- [ ] Run `scripts/check_logs.sql` against the deployed database copy.

## Known operational limits

- SQLite and `Base.metadata.create_all()` are suitable for this MVP but are not
  a migration strategy.
- Session cookies are signed and time-limited; there is no server-side token
  revocation table. Logout removes the browser cookie.
- OpenRouter availability and free-tier rate limits are external dependencies.
  Controlled errors keep the application responsive, but failed AI requests do
  not create conversation rows.
- Dependency versions are not pinned yet; pin and review them before a
  long-lived production release.
