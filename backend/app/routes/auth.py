"""Sign up, sign in, sign out.

PL-4's login was a fake: an email identified you and nothing was checked. This
is the real thing — a password, hashed, and a session cookie that is signed so it
cannot be edited into somebody else's.
"""

from fastapi import APIRouter, HTTPException, Response, status

from app import database, security
from app.config import SESSION_COOKIE
from app.dependencies import CurrentUser, DbConnection
from app.models import Credentials, MessageResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

# One message for both halves of a failed sign-in. Saying which half was wrong
# would tell a stranger whether an email has an account here.
BAD_CREDENTIALS = "That email and password do not match an account."


def start_session(response: Response, user_id: int) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        security.sign_session(user_id),
        httponly=True,
        samesite="lax",
        path="/",
    )


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(credentials: Credentials, response: Response, db: DbConnection):
    user = database.create_user(
        db, credentials.email, security.hash_password(credentials.password)
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists for that email.",
        )

    start_session(response, user["id"])
    return dict(user)


@router.post("/signin", response_model=UserResponse)
def signin(credentials: Credentials, response: Response, db: DbConnection):
    user = database.get_user_by_email(db, credentials.email)

    # Check the password even when there is no such user, so that a missing
    # account and a wrong one take the same work to answer. The check must run
    # before the `user is None` test, not after: short-circuiting past bcrypt is
    # exactly the timing signal this is here to remove.
    correct = security.verify_password(
        credentials.password, user["password_hash"] if user else security.DUMMY_HASH
    )
    if user is None or not correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=BAD_CREDENTIALS
        )

    start_session(response, user["id"])
    return dict(user)


@router.post("/signout", response_model=MessageResponse)
def signout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"message": "Signed out"}


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser):
    return dict(user)
