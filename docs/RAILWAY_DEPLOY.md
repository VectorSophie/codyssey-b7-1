# Deploying to Railway

One service serves both the FastAPI backend and the built React frontend
(`app/main.py` mounts `frontend/dist` and falls back to `index.html` for
client-side routes — see `docs/ARCHITECTURE.md`). Build/deploy config lives
in `nixpacks.toml` (build) and `railway.json` (deploy/health check).

## 1. One-time manual steps (need your own Railway account — can't be scripted)

```
! npm i -g @railway/cli
! railway login
```

`railway login` opens a browser for OAuth. Do this once.

## 2. Create and link the project

Either click through the Railway dashboard ("New Project" → "Deploy from
GitHub repo" → pick this repo/branch), or from the CLI:

```
! railway init
! railway link
```

## 3. Add a persistent volume for the SQLite file

The DB must survive restarts/redeploys — Railway's ephemeral filesystem
does not, without a volume attached.

```
! railway volume add --mount-path /data
```

(Flag names occasionally change between CLI versions — run
`railway volume --help` if this errors, and adjust.)

## 4. Set environment variables

```
! railway variables set APP_ENV=production
! railway variables set SECRET_KEY="$(openssl rand -hex 32)"
! railway variables set DATABASE_URL=sqlite:////data/app.db
! railway variables set OPENROUTER_API_KEY=<your real key>
! railway variables set OPENROUTER_MODEL=openrouter/free
! railway variables set AI_TIMEOUT_SECONDS=20
! railway variables set SESSION_COOKIE_NAME=everything_session
! railway variables set SESSION_HTTPS_ONLY=true
! railway variables set LOG_LEVEL=INFO
```

`DATABASE_URL` points at the volume mounted in step 3 — four slashes
(`sqlite:////...`) because the path after them is absolute (`/data/app.db`).

## 5. Deploy

```
! railway up
```

Or just push to the branch Railway is watching (if deployed via GitHub
integration) — it rebuilds automatically using `nixpacks.toml`.

## 6. Verify

```
! railway open
```

Then check:

- `GET /health` → `{"status":"ok"}`
- `/` loads the real React app, not a 404 or the Jinja2 placeholder
- register → login → ask a question → real OpenRouter answer comes back
- refreshing on a client-side route like `/chat` still works (not a 404)

## Notes

- Free trial credit (~$5) likely covers a week of light evaluation
  traffic for an app this small — see the cost discussion in project chat.
- No cold-start/spin-down on Railway's paid tiers, unlike Render's free
  tier, which matters for not looking broken mid-demo.
- If moving off Railway later, `docs/DEPLOYMENT_CHECKLIST.md` has the
  provider-agnostic preflight checklist.
