# EVERYTHING

"궁금한 건 무엇이든."

## Overview

EVERYTHING is a Korean-first conversational AI encyclopedia. Authenticated
users ask general-knowledge questions in natural language, receive concise
AI-generated explanations, continue with contextual follow-up questions, and
revisit their previous conversations. Built with FastAPI, SQLite, and
OpenRouter's free-tier models.

Design references (not clones): Wikipedia's readable, knowledge-oriented
typography; Perplexity's question-first interaction; Kagi's minimal,
restrained interface.

## Core Features

Planned (see [docs/TASKS.md](docs/TASKS.md) for current status — nothing
listed below is implemented yet, this repository currently contains only
the Phase 0 project scaffold):

- user registration/login
- authenticated chatbot access
- AI-generated general knowledge answers
- conversational context (recent-message window)
- saved personal conversation history
- structured operational logging
- graceful handling of AI API failures/unavailability
- evaluator-visible DB records

## Tech Stack

- Python
- FastAPI
- SQLite
- SQLAlchemy
- OpenRouter (free tier only)
- React + Vite + TypeScript (frontend — see "Deviation" note below)

> **Deviation from the original plan:** the project was initially scoped for
> server-rendered Jinja2 templates + vanilla JavaScript, with no Node build
> pipeline. Agent 2 built the frontend as a React/Vite/TypeScript SPA
> (`frontend/`) that talks to the backend purely over the JSON API instead.
> This was reviewed and accepted rather than rebuilt, to avoid discarding
> working, tested UI code. `app/templates/` and `app/static/` remain in the
> repo as minimal placeholders from Agent 1's backend bootstrap and are not
> the served frontend.

## Repository Structure

```
app/
  main.py, config.py, database.py, dependencies.py   — app wiring (Agent 1)
  models/, schemas/, routers/, services/              — backend logic (Agent 1)
  templates/, static/                                 — placeholder pages, superseded by frontend/ (see Deviation note)
frontend/                                              — React + Vite + TypeScript SPA (Agent 2)
tests/                                                 — automated tests (Agent 3)
scripts/                                               — ops/QA scripts (Agent 3)
docs/                                                  — coordination docs (all agents)
```

## Branch Strategy

```
main
  ^
develop
  ^
  +-- feature/core-backend-ai       (Agent 1: backend / AI / architecture)
  +-- feature/frontend-experience   (Agent 2: frontend / UX / visual design)
  +-- feature/qa-ops-docs           (Agent 3: QA / operations / documentation)
```

`main` is production-stable; nobody commits to it directly. `develop` is the
shared integration branch. Feature branches originate from `develop` and
merge back into it via PR. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Team Roles

See [docs/TEAM.md](docs/TEAM.md) for full ownership details.

- **Agent 1** — Backend / AI / Architecture (`feature/core-backend-ai`)
- **Agent 2** — Frontend / UX / Visual Design (`feature/frontend-experience`)
- **Agent 3** — QA / Operations / Documentation (`feature/qa-ops-docs`)

## Development Workflow

Issue/task → branch from `develop` → small coherent commits → PR into
`develop` → review → merge → integration testing on `develop` →
`develop`-to-`main` release PR when stable. See
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for commit conventions and PR
expectations.

## Environment

Copy `.env.example` to `.env` and fill in real values locally. Never commit
`.env`. Required for AI calls:

```
OPENROUTER_API_KEY=<your key>
OPENROUTER_MODEL=openrouter/free
```

The application must never call a paid OpenRouter model — only the free
tier (`openrouter/free`) is used, with no automatic fallback to paid models.

## Status

- **Backend (Agent 1):** implemented and merged into `develop` — auth,
  chat, history APIs, OpenRouter integration, structured logging. See
  `docs/API_CONTRACT.md`.
- **Frontend (Agent 2):** implemented on `feature/frontend-experience` as a
  React/Vite SPA under `frontend/` (see the Deviation note above); not yet
  merged into `develop`.
- **QA/Ops/Docs (Agent 3):** test suite and evaluator/deployment docs
  implemented on `feature/qa-ops-docs`; PR open, pending final review.
