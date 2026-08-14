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

## 2. Provide the one secret Render can't infer

`render.yaml` marks `OPENROUTER_API_KEY` as `sync: false`, so Render
prompts for it during Blueprint setup — paste your real key there. Every
other env var (`SECRET_KEY`, `OPENROUTER_MODEL`, etc.) is already set in
`render.yaml`.

## 3. Deploy

Click **Apply** — Render builds the Docker image (~1-2 min based on a
local build/run test: `npm ci && npm run build` for the frontend, then
`pip install` for the backend) and starts the service.

## 4. Optional: enable the admin log view

`GET /api/admin/logs` is gated by `ADMIN_USERNAMES`, which `render.yaml`
sets to an empty string by default (no admin routes reachable). To use it,
set `ADMIN_USERNAMES` on the Render dashboard to your own username
(comma-separated for more than one) and redeploy. See "Admin log access"
in `docs/API_CONTRACT.md`.

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
