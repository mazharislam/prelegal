# Prelegal

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the `templates` directory. The user can carry out AI chat in order to establish what document they want and how to fill in the fields. The available documents are covered in the `catalog.json` file in the project root:

@catalog.json

## Development process

When instructed to build a feature:

1. Use your Atlassian tools to read the feature instructions from Jira.
2. Develop the feature - do not skip any step from the feature-dev 7 step process.
3. Thoroughly test the feature with unit tests and integration tests and fix any issues.
4. Submit a PR using your github tools.

## AI design

When writing code to make calls to LLMs, use your claudecoder skill to use `claude-opus-4-8` as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

## Technical design

- The entire project is packaged into a Docker container.
- The backend is in `backend/` and is a uv project, using FastAPI.
- The frontend is in `frontend/`.
- The database uses SQLite and is created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.
- The frontend is statically exported and served by FastAPI.
- Scripts in `scripts/`:

```
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```

Backend available at http://localhost:8000

## Color Scheme

The prototype's NDA screens use a dark "desk" palette (see `frontend/src/app/globals.css`). The palette below is the target for the product polish pass in PL-7.

| Token | Hex | Use |
|-------|-----|-----|
| Light Blue | `#92BBE6` | accent text on dark, cover subtitle |
| Blue primary | `#3C66CE` | supporting / kickers / icon circles |
| Dark Blue | `#173793` | headings |
| Gray Text | `#888888` | text |
| Soft Blue secondary | `#639BD5` | submit buttons |
| Pale Blue | `#D6E4F2` | soft fills |
| Card border | `#D8E2F2` | card outline |
| Card | `#FFFFFF` | card fill (light theme) |
| Body text | `#404040` | body copy on light |

## Implementation status

### Completed (PL-2)

- Common Paper legal agreement templates curated into `templates/`, indexed by `catalog.json`.

### Completed (PL-3)

- Mutual NDA creator: a form drives a live document preview; "Download PDF" prints the rendered sheet.

### Completed (PL-4)

- Docker multi-stage build (Node exports the frontend, Python serves it).
- FastAPI backend in `backend/`, a uv project, with SQLite rebuilt from scratch on every container start.
- Next.js static export served by FastAPI at http://localhost:8000.
- Fake sign-in: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. There is **no authentication** — an email identifies a user, the account is created on first sight, and the session cookie carries a bare user id. Real credentials arrive with PL-7.
- Start/stop scripts for Mac, Linux, and Windows.

### Not yet built

- **PL-5** — AI chat replacing the manual NDA form.
- **PL-6** — support for all 11 document types in `catalog.json`.
- **PL-7** — real sign-up/sign-in, document persistence and history, and the visual polish pass.

## Current API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Health check |
| `POST /api/auth/login` | Fake sign-in; creates the user on first sight |
| `POST /api/auth/logout` | Clear the session cookie |
| `GET /api/auth/me` | The signed-in user, or 401 |
