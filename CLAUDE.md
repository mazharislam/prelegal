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

The interface uses this palette. The **document** does not: it is paper — cream, serif, red blanks — because a contract should not look like the tool that drafted it. See `frontend/src/app/globals.css`, where the two are separated deliberately.

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

### Completed (PL-6)

- All 11 agreements in `catalog.json` can be drafted, not just the NDA. The assistant works out which one the user needs, and says so.
- Asked for an agreement we have no template for, it declines, names the closest one it *can* draft and why, and offers to go ahead with that — it never quietly drafts something else.
- Fields are **derived from the templates**, not hand-listed: each Common Paper template marks the values it needs with `coverpage_link` / `keyterms_link` / `orderform_link` spans, and `app/templates.py` reads them. This reproduces the NDA's six known fields exactly, which is the check the approach rests on.
- Two rendering paths, on purpose. The Mutual NDA keeps its bespoke document (cover page, checkbox options, transcribed clauses). The other ten share one data-driven renderer: a cover page generated from the collected values, then the standard terms, with each referenced term cross-referencing the cover page.

### Completed (PL-7)

- Real accounts. Sign up and sign in with an email and password; passwords hashed with bcrypt. The session cookie is now **signed**, so it cannot be edited into someone else's — which is why PL-4 put the session behind a cookie rather than localStorage.
- Drafts are saved after every turn, with no Save button to forget. Reopening one restores the agreement, its values, **and the conversation** — without the history the assistant would re-ask what it already knows.
- Every query is scoped to the owner. Another user's draft answers 404, not 403: whether it exists is not theirs to learn.
- The interface adopts the blue palette above. The **document stays paper** — a contract should not look like a web app. The cross-reference highlight is a pale-blue wash rather than the old marker yellow.
- A "draft, not legal advice" disclaimer on every agreement, and it **prints**: the PDF is the copy that leaves the building.

### Not yet built

- Nothing outstanding from PL-2 through PL-7.

## Current API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Health check |
| `POST /api/auth/signup` | Create an account (email + password) |
| `POST /api/auth/signin` | Sign in |
| `POST /api/auth/signout` | Clear the session cookie |
| `GET /api/auth/me` | The signed-in user, or 401 |
| `GET/POST /api/drafts` | The user's saved drafts |
| `GET/PUT/DELETE /api/drafts/{id}` | One draft, scoped to its owner |
| `POST /api/chat` | One turn of the interview: conversation in, reply plus a field patch out |
| `GET /api/documents` | The 11 agreements we can draft, and the values each needs |
| `GET /api/documents/{id}/template` | One agreement's text, parsed into lines |

## Implementation notes

### Layout

| Path | What |
|---|---|
| `backend/app/main.py` | App, lifespan (recreates the DB), CORS, `/api/health` |
| `backend/app/ai.py` | The `claude` CLI subprocess call (structured output) |
| `backend/app/templates.py` | Parses the templates; derives each agreement's fields |
| `backend/app/nda.py` | The NDA's hand-written field model |
| `backend/app/routes/chat.py` | `/api/chat`: the prompt, the per-turn schema, one turn |
| `backend/app/routes/documents.py` | `/api/documents`: what we can draft, and its text |
| `backend/app/config.py` | Paths read lazily from the environment, so tests can redirect them |
| `backend/app/database.py` | Plain `sqlite3`; one table, so no ORM |
| `backend/app/dependencies.py` | `get_db` (one connection per request), `get_current_user` (cookie) |
| `backend/app/models.py` | Request and response models |
| `backend/app/security.py` | Password hashing, and the signed session |
| `backend/app/routes/auth.py` | Sign up, sign in, sign out |
| `backend/app/routes/drafts.py` | `/api/drafts`: the user's saved work |
| `backend/app/routes/static.py` | Mounts the frontend export at `/` |
| `frontend/src/lib/api.ts` | API client; `ApiError` carries the HTTP status |
| `frontend/src/lib/nda.ts` | The NDA's values, how they read, and `applyUpdates` |
| `frontend/src/lib/documents.ts` | Every other agreement: a flat field map and its merge |
| `frontend/src/lib/useDocument.ts` | The desk: the agreement, its values, the conversation, and the autosave |
| `frontend/src/components/ChatPanel.tsx` | The interview |
| `frontend/src/components/NdaDocument.tsx` | The NDA, drafted by hand |
| `frontend/src/components/TemplateDocument.tsx` | The other ten, rendered from the template |
| `frontend/src/components/Disclaimer.tsx` | The draft warning, on both documents; it prints |
| `frontend/src/components/AuthScreen.tsx` | Sign in and sign up |
| `frontend/src/components/DraftList.tsx` | The user's saved drafts |
| `frontend/src/app/page.tsx` | Session gate; the rail, the chat, and the document |

### Things worth knowing before you change them

- **Route order.** `routes/static.py` mounts `StaticFiles` at `/`, which is a catch-all. It is mounted last, after every API router. Register new API routes *before* that call in `main.py` or they will be shadowed.
- **The session cookie is signed** (`app/security.py`). An edited cookie fails its signature and is not a session. The signing key is generated at startup unless `PRELEGAL_SECRET_KEY` is set — fine while the database is disposable, since there are no accounts for a session to outlive.
- **The database is still disposable.** `init_db()` deletes the file and recreates the schema on every start; PL-7's own ticket allows this. Accounts and drafts do not survive a restart. Anything that needs them to will have to change `init_db` first.
- **Drafts are scoped in the query, not checked afterwards.** `database.py` takes `user_id` on every draft read and write, so another user's draft is absent rather than forbidden. Keep it that way: a 403 tells a stranger the draft exists.
- **The frontend is a static export.** There is no Node runtime in the image and no Next.js server, so no server components, route handlers, or SSR. Everything is client-side.
- **Two origins in development.** `next dev` on `:3000` sets `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`; the container leaves it empty and is same-origin. `credentials: "include"` is what carries the cookie across the dev origin, and `DEV_ORIGINS` in `config.py` is what CORS allows.
- **The AI answers with a patch, never the whole document.** `NdaUpdates` carries only the fields it learned this turn, and `applyUpdates` in `nda.ts` merges them. A model asked to restate every value each turn is a model that can silently overwrite one the user already settled. Keep it that way.
- **Inference needs the host.** `app/ai.py` shells out to `claude`. Tests always mock the subprocess: the suite must never depend on a signed-in CLI or spend a live model call.
- **The NDA field model is written twice**, in `backend/app/nda.py` and `frontend/src/lib/nda.ts`. There is no shared codegen, so a field added to one and not the other is silently dropped in the merge. This applies to the NDA only: the other ten agreements derive their fields from the template, so there is nothing to keep in step.
- **The chat schema is built per turn**, from the agreement in play (`response_schema` in `routes/chat.py`). A schema carrying only that document's fields is what stops the model inventing them. Two consequences worth knowing:
  - **`$ref`s must be hoisted.** The NDA nests a party, which Pydantic writes as `$ref` into `$defs`. A `$ref` resolves from the *root* of the schema sent to the CLI, so those defs are lifted out of `updates`. Leave them buried and the CLI rejects the whole schema and the NDA simply will not draft. Mocked tests cannot catch this — only the real CLI resolves refs.
  - **The turn that chooses an agreement is asked twice.** The first ask is answered with a schema that has no fields, because we did not yet know the document. Without the re-ask, "a CSA for Acme, 12 months" would be acknowledged in the reply and then silently dropped.
- **Templates ship in the image.** `.dockerignore` deliberately does not exclude `templates/` or `catalog.json`: the backend cannot ask for a value it does not know the document needs.

### Commands

```bash
cd backend  && uv run pytest              # API, database, and the mocked AI chat
cd frontend && npm test                   # vitest: components and pure logic
cd frontend && npm run lint && npm run typecheck && npm run build
```

Component tests opt into a DOM with a `// @vitest-environment jsdom` docblock; the default environment stays `node`.
