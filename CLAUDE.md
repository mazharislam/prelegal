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
- The database uses SQLite and is created from scratch each time the Docker container is brought up. It holds a users table. Real sign up and sign in are a PL-7 target; PL-4 shipped a fake login with neither.
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

### Completed (PL-5)

- AI chat replaces the NDA form. The user talks; the model asks for one missing field at a time and returns a patch of what it learned, which the frontend merges into the document. The live preview and PDF download are unchanged.
- Inference is the local `claude` CLI, called as a subprocess with `--json-schema` structured output, per the claudecoder skill. No API key, no SDK.
- **AI chat does not work inside Docker.** The CLI is installed and signed in on the developer's machine, not in the image, so `/api/chat` returns a 503 explaining exactly that. For chat, run the backend on the host. Everything else works in the container as before.

### Not yet built

- **PL-6** — support for all 11 document types in `catalog.json`.
- **PL-7** — real sign-up/sign-in, document persistence and history, and the visual polish pass.

## Current API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Health check |
| `POST /api/auth/login` | Fake sign-in; creates the user on first sight |
| `POST /api/auth/logout` | Clear the session cookie |
| `GET /api/auth/me` | The signed-in user, or 401 |
| `POST /api/chat` | One turn of the NDA interview: conversation in, reply plus a field patch out |

## Implementation notes

### Layout

| Path | What |
|---|---|
| `backend/app/main.py` | App, lifespan (recreates the DB), CORS, `/api/health` |
| `backend/app/ai.py` | The `claude` CLI subprocess call (structured output) |
| `backend/app/nda.py` | The NDA field model and the AI's response schema |
| `backend/app/routes/chat.py` | `/api/chat`: the interview prompt and one turn |
| `backend/app/config.py` | Paths read lazily from the environment, so tests can redirect them |
| `backend/app/database.py` | Plain `sqlite3`; one table, so no ORM |
| `backend/app/dependencies.py` | `get_db` (one connection per request), `get_current_user` (cookie) |
| `backend/app/models.py` | Request and response models |
| `backend/app/routes/auth.py` | The fake login |
| `backend/app/routes/static.py` | Mounts the frontend export at `/` |
| `frontend/src/lib/api.ts` | API client; `ApiError` carries the HTTP status |
| `frontend/src/lib/nda.ts` | The document values, how they read, and `applyUpdates` |
| `frontend/src/components/ChatPanel.tsx` | The interview |
| `frontend/src/components/NdaDocument.tsx` | The rendered agreement, and the PDF via print |
| `frontend/src/components/LoginScreen.tsx` | The login screen |
| `frontend/src/app/page.tsx` | Session gate; the chat and the document side by side |

### Things worth knowing before you change them

- **Route order.** `routes/static.py` mounts `StaticFiles` at `/`, which is a catch-all. It is mounted last, after every API router. Register new API routes *before* that call in `main.py` or they will be shadowed.
- **The session cookie is not a credential.** `prelegal_session` holds a bare user id. Nothing is signed and no password exists. PL-7 signs the value; do not build a second session mechanism alongside it.
- **The database is disposable.** `init_db()` deletes the file and recreates the schema on every start. Do not add anything that assumes data survives a restart until PL-7.
- **The frontend is a static export.** There is no Node runtime in the image and no Next.js server, so no server components, route handlers, or SSR. Everything is client-side.
- **Two origins in development.** `next dev` on `:3000` sets `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`; the container leaves it empty and is same-origin. `credentials: "include"` is what carries the cookie across the dev origin, and `DEV_ORIGINS` in `config.py` is what CORS allows.
- **The AI answers with a patch, never the whole document.** `NdaUpdates` carries only the fields it learned this turn, and `applyUpdates` in `nda.ts` merges them. A model asked to restate every value each turn is a model that can silently overwrite one the user already settled. Keep it that way.
- **Inference needs the host.** `app/ai.py` shells out to `claude`. Tests always mock the subprocess: the suite must never depend on a signed-in CLI or spend a live model call.
- **The field model is written twice**, in `backend/app/nda.py` and `frontend/src/lib/nda.ts`. There is no shared codegen, so a field added to one and not the other is silently dropped in the merge. Change both, and add it to the prompt in `routes/chat.py` — a field absent from the prompt is a field the AI never fills.

### Commands

```bash
cd backend  && uv run pytest              # API, database, and the mocked AI chat
cd frontend && npm test                   # vitest: components and pure logic
cd frontend && npm run lint && npm run typecheck && npm run build
```

Component tests opt into a DOM with a `// @vitest-environment jsdom` docblock; the default environment stays `node`.
