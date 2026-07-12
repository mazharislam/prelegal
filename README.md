# Prelegal

Draft legal agreements from the Common Paper templates in `templates/`.

## Run it

Everything is packaged in one Docker container: FastAPI serves the API and the
statically exported Next.js frontend on the same origin.

```bash
scripts/start-mac.sh        # or start-linux.sh, or start-windows.ps1
```

Then open http://localhost:8000. Sign in with any email — there is no password
yet, and the account is created on the spot.

```bash
scripts/stop-mac.sh         # or stop-linux.sh, or stop-windows.ps1
```

The SQLite database is temporary: it is rebuilt from scratch every time the
container starts, so users do not survive a restart.

## Develop

The frontend and backend can also run separately, on two ports.

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
