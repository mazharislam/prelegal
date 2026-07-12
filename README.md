# Prelegal

Draft legal agreements from the Common Paper templates in `templates/`. Tell the
assistant about your deal; it works out which of the 11 agreements you need and
fills it in as you talk.

Ask for something we have no template for — an employment contract, a lease — and
it says so, and offers the closest agreement it can actually draft.

## AI chat needs the backend on your host

Inference goes through the local Claude Code CLI, which the backend calls as a
subprocess. There is no API key. That CLI lives on your machine, not in the
container, so **AI chat does not work inside Docker** — `/api/chat` returns a 503
saying so. Everything else (the app, sign-in, the document, the PDF) works in the
container either way.

To use the chat, install and sign in to Claude Code, then run the backend on the
host — see [Develop](#develop) below.

```bash
claude auth status --text     # should show your account
```

## Run it

Everything is packaged in one Docker container: FastAPI serves the API and the
statically exported Next.js frontend on the same origin.

```bash
scripts/start-mac.sh        # or start-linux.sh, or start-windows.ps1
```

Then open http://localhost:8000 and create an account.

Your drafts are saved as you talk — there is no Save button — and reopening one
brings back the conversation as well as the document. Every agreement carries a
"draft, not legal advice" notice, and it prints with the PDF.

```bash
scripts/stop-mac.sh         # or stop-linux.sh, or stop-windows.ps1
```

The SQLite database is temporary: it is rebuilt from scratch every time the app
starts, so **accounts and drafts do not survive a restart**. That is deliberate
for now. A deployment that kept its data would also need to set
`PRELEGAL_SECRET_KEY`, or every restart would sign everyone out.

## Develop

Run the backend on the host and it can reach the `claude` CLI, so AI chat works.

```bash
# Build the frontend once, then let the backend serve it on http://localhost:8000
cd frontend && npm run build
cd ../backend && PRELEGAL_STATIC_DIR=../frontend/out uv run uvicorn app.main:app --reload
```

Or run the two separately, on two ports, for frontend hot reload:

```bash
# Backend on http://localhost:8000
cd backend
uv run uvicorn app.main:app --reload

# Frontend on http://localhost:3000, talking to the backend above
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

`NEXT_PUBLIC_API_BASE_URL` is only needed in this split setup. In the container
the frontend is served by the backend, so requests are same-origin and the
variable is left empty.

## Test

```bash
cd backend  && uv run pytest              # API and database
cd frontend && npm test                   # components and API client
cd frontend && npm run lint && npm run typecheck
```

## Layout

| Path | What |
|---|---|
| `backend/` | FastAPI app (uv project), SQLite, serves the built frontend |
| `frontend/` | Next.js app, statically exported to `out/` |
| `templates/` | Common Paper agreement templates (PL-2) |
| `catalog.json` | Index of those templates |
| `scripts/` | Start and stop, per platform |

The templates are the source of truth for what each agreement asks you. They mark
the values they need in the text, and the backend reads those marks — so a
template change becomes a question the assistant asks, with nothing else to edit.
