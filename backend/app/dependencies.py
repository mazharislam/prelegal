"""Shared FastAPI dependencies."""

import sqlite3
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status

from app import database
from app.config import SESSION_COOKIE


def get_db():
    connection = database.connect()
    try:
        yield connection
    finally:
        connection.close()


DbConnection = Annotated[sqlite3.Connection, Depends(get_db)]


def get_current_user(
    db: DbConnection,
    prelegal_session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> sqlite3.Row:
    """Resolve the signed-in user from the session cookie.

    The cookie holds a bare user id and is not a credential: PL-4 has no
    authentication, so this identifies a session rather than proving one.
    """
    if prelegal_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in"
        )

    if not prelegal_session.isdigit():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session"
        )

    user = database.get_user_by_id(db, int(prelegal_session))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session"
        )
    return user


CurrentUser = Annotated[sqlite3.Row, Depends(get_current_user)]
