# Stage 1: export the frontend to static files.
FROM node:22-alpine AS frontend

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# Stage 2: the FastAPI app, serving that export alongside the API.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.0 /uv /usr/local/bin/uv

WORKDIR /app

# Dependencies only, and first: this layer is cached until the manifests change.
# The app itself is imported from the working directory below, not installed.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/app ./app
COPY templates ./templates
COPY catalog.json ./catalog.json
COPY --from=frontend /frontend/out ./static

ENV PATH="/app/.venv/bin:$PATH" \
    PRELEGAL_DB_PATH=/app/data/prelegal.db \
    PRELEGAL_STATIC_DIR=/app/static \
    PRELEGAL_TEMPLATES_DIR=/app/templates \
    PRELEGAL_CATALOG_PATH=/app/catalog.json

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
