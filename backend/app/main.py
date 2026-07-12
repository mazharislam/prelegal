"""Prelegal API. Serves the exported frontend and the JSON API on one origin."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import DEV_ORIGINS
from app.database import init_db
from app.routes import auth, chat, documents
from app.routes.static import mount_frontend


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Prelegal", lifespan=lifespan)

# In production the frontend is served from this same origin and CORS is unused.
# It exists for `next dev` on :3000, which must be allowed to send the session cookie.
app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(documents.router)

# Last: this claims "/", so every API route must already be registered.
mount_frontend(app)
