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
- Jinja2
- vanilla JavaScript
- OpenRouter (free tier only)

## Repository Structure

```
app/
  main.py, config.py, database.py, dependencies.py   — app wiring (Agent 1)
  models/, schemas/, routers/, services/              — backend logic (Agent 1)
  templates/, static/                                 — frontend (Agent 2)
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

**Phase 0 (repository bootstrap) only.** This repository currently
contains the project directory skeleton and coordination documentation
(branch strategy, ownership, API contract, architecture plan, task list).
No backend, frontend, or test implementation exists yet. Implementation
work begins on the three feature branches listed above.
