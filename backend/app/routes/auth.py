"""Fake sign-in.

PL-4 asks for a login screen with no authentication, so there is no password and
nothing is verified: an email identifies a user, and the user is created on first
sight. The session cookie carries the resulting user id. PL-7 turns this into
real authentication by adding credentials and signing the cookie.
"""

from fastapi import APIRouter, Response

from app import database
from app.config import SESSION_COOKIE
from app.dependencies import CurrentUser, DbConnection
from app.models import LoginRequest, MessageResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, response: Response, db: DbConnection):
    user = database.upsert_user(db, payload.email)
    response.set_cookie(
        SESSION_COOKIE,
        str(user["id"]),
        httponly=True,
        samesite="lax",
        path="/",
    )
    return dict(user)


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"message": "Signed out"}


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser):
    return dict(user)
