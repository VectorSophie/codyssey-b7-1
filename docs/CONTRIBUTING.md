# Contributing — EVERYTHING

## Branching

Never commit feature work directly to `main`. Feature branches originate
from `develop`:

```
main
  ^
develop
  ^
  +-- feature/core-backend-ai
  +-- feature/frontend-experience
  +-- feature/qa-ops-docs
```

Before starting significant work, sync your branch with `develop`.

## Commit Convention

```
feat(scope): ...
fix(scope): ...
test(scope): ...
docs(scope): ...
refactor(scope): ...
chore(scope): ...
style(scope): ...
ci(scope): ...
```

Examples:

```
feat(auth): implement login endpoint
feat(chat-ui): add question composer
test(ai): handle mocked OpenRouter timeout
docs(setup): document environment variables
```

Avoid vague messages: `fix`, `update`, `final`, `final2`, `stuff`, `changes`.

## Pull Requests

All feature PRs target `develop`. PR description should include:

- What changed
- Why
- Related tasks/issues
- How to test
- Screenshots for UI changes
- API examples for API changes
- Known limitations

Request at least one review where practical.

## Merge Strategy

Prefer preserving meaningful contributor commit history. Do not squash
everything solely for cosmetic reasons — evaluators may need to inspect
individual contribution history.

## Conflict Rules

Do not resolve merge conflicts by blindly choosing "ours" or "theirs".
Understand both changes before merging.

## Scope Rules

Avoid unrelated refactors. If you need to touch a file outside your
ownership area (see [TEAM.md](TEAM.md)), keep the change narrow and explain
why in the PR description. If a shared file's interface must change
(notably `docs/API_CONTRACT.md`), document the reason clearly in the PR
and update the contract doc in the same PR.
