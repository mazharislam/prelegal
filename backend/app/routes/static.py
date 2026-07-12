"""Serves the statically exported Next.js frontend at /.

The mount is registered after the API routers so that /api/* is matched first.
When the export is absent — backend-only local development — the app runs as a
plain API and this mount is skipped.
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import static_dir


def mount_frontend(app: FastAPI) -> None:
    directory = static_dir()
    if not directory.is_dir():
        return
    app.mount("/", StaticFiles(directory=directory, html=True), name="frontend")
