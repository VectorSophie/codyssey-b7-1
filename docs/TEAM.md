# Team Ownership — EVERYTHING

## Agent 1

**Role:** Backend / AI / Architecture
**Branch:** `feature/core-backend-ai`

**Owns:**
- `app/main.py`, `app/config.py`, `app/database.py`, `app/dependencies.py`
- `app/models/**`, `app/schemas/**`, `app/routers/**`, `app/services/**`

**Responsibilities:**
- FastAPI application architecture
- SQLite/SQLAlchemy database models
- server-side authentication/session handling
- OpenRouter free-tier AI integration
- conversational context building
- chat and history persistence/APIs
- backend integration and contract stability

Agent 1 may create minimal placeholders required for other agents to
integrate against, but should not redesign Agent 2's final UI.

## Agent 2

**Role:** Frontend / UX / Visual Design
**Branch:** `feature/frontend-experience`

**Owns:**
- `app/templates/**`
- `app/static/**`

**Responsibilities:**
- design system (typography, layout, spacing, color)
- landing page
- login / register UI
- chat interface (empty state, conversation state, composer)
- history navigation
- responsive layout, accessibility
- frontend API integration against `docs/API_CONTRACT.md`
- loading/error states

Agent 2 must not independently rewrite backend architecture. If a backend
interface change is required, document the requested change (see
[CONTRIBUTING.md](CONTRIBUTING.md)) rather than editing Agent 1's files
directly.

## Agent 3

**Role:** QA / Operations / Documentation
**Branch:** `feature/qa-ops-docs`

**Owns:**
- `tests/**`
- `scripts/**`
- README.md sections related to testing/setup/evaluation
- `.env.example`
- CI/testing configuration where applicable
- evaluation/checklist documentation

**Responsibilities:**
- pytest coverage
- mocking OpenRouter (tests must never hit the real API)
- input validation verification
- authentication and user-isolation verification
- health checks
- logging verification (operational events, no sensitive data logged)
- DB inspection tooling
- environment-variable documentation
- deployment/evaluator instructions

Agent 3 should not rebuild Agent 1 or Agent 2's work simply because a test
fails. First identify the defect, then make the smallest appropriate fix
or report it to the owning agent.

## Ownership Matrix

| Area | Primary | Review |
|---|---|---|
| Backend architecture | Agent 1 | Agent 3 |
| DB | Agent 1 | Agent 3 |
| AI integration | Agent 1 | Agent 3 |
| Frontend | Agent 2 | Agent 1 |
| UX | Agent 2 | Agent 1 |
| Tests | Agent 3 | Agent 1 |
| Documentation | Agent 3 | All |
| Final integration | Agent 1 | All |
