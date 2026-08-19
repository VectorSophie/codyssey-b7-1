# Deploying to Render

One Docker image serves both the FastAPI backend and the built React
frontend (same-origin, no CORS needed — see `docs/ARCHITECTURE.md`).
Config lives in `Dockerfile` + `render.yaml`. Verified locally with
`docker build` + `docker run`: health check, the real React app at `/`,
and `/api/*` all work correctly through the container.

**No persistent disk for now** — `DATABASE_URL` stays the default
`sqlite:///./app.db`, which resets on every redeploy/restart. Fine for a
short evaluation window; revisit if the DB needs to survive longer (see
the disk note in `docs/DEPLOYMENT_CHECKLIST.md`).

## 1. One-time manual step (needs your Render account — can't be scripted)

Go to the Render dashboard → **New** → **Blueprint** → connect this GitHub
repo. Render reads `render.yaml` automatically and creates the service.

Pick the branch to deploy: `main` if the `develop`→`main` release PR is
already merged, or `develop` directly if you want it live before that.

## 2. Provide the values Render can't infer

`render.yaml` marks `OPENROUTER_API_KEY` and `ADMIN_USERNAMES` as
`sync: false`, so Render prompts for both during Blueprint setup. Paste
your real OpenRouter key for the first. For `ADMIN_USERNAMES`, pick the
exact username you (the operator) will register on the live site — see
step 4. Every other env var (`SECRET_KEY`, `OPENROUTER_MODEL`, etc.) is
already set in `render.yaml`.

**Why `ADMIN_USERNAMES` isn't a literal value in `render.yaml`:** this
repo is public. Registration is self-service — anyone can `POST
/api/auth/register` with any unclaimed username. If the admin username
were committed to `render.yaml` in plain text, anyone reading the repo
could see it and race to register that exact username before the real
operator does, instantly getting admin access. Keeping it `sync: false`
means the value only ever exists in the Render dashboard, never in git
history.

## 3. Deploy

Click **Apply** — Render builds the Docker image (~1-2 min based on a
local build/run test: `npm ci && npm run build` for the frontend, then
`pip install` for the backend) and starts the service.

## 4. Enable the admin console (`/admin`, `GET /api/admin/*`)

`ADMIN_USERNAMES` (set in step 2, dashboard-only) gates both admin routes
— if left blank when prompted, no admin routes are reachable. To use it:

1. Set `ADMIN_USERNAMES` on the Render dashboard to the exact username you
   will register (comma-separated for more than one operator).
2. Register that same username through the live site's normal sign-up
   flow (`/register`) — setting the env var does not create the account.
3. Log in as that user; the `/admin` link becomes visible, and
   `require_admin` re-checks the username against `ADMIN_USERNAMES` on
   every admin request server-side.

**No persistent disk (see above) means the SQLite file resets on every
redeploy/restart** — that includes this admin account. After any
redeploy, re-register the same username before it's available again.

See "Admin database access" in `docs/API_CONTRACT.md` for what the two
routes expose.

## 5. Verify

- `GET /health` → `{"status":"ok"}`
- `/` loads the real React app
- register → login → ask a question → real OpenRouter answer
- refreshing on a client-side route like `/chat` still works (SPA fallback)
- free tier spins down after ~15 min idle — first request after that has
  a cold-start delay (~30s); not a bug, just Render's free tier behavior

## If persistence becomes necessary later

Upgrade the service to a paid plan with a disk, mount it (e.g. `/data`),
and change `DATABASE_URL` to `sqlite:////data/app.db` (four slashes —
absolute path). Everything else stays the same.
