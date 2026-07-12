"""SQLite access. Plain sqlite3 from the standard library — the schema is two
tables, so an ORM would cost more than it saves."""

import json
import sqlite3
from pathlib import Path
from typing import Any

from app.config import database_path

SCHEMA = """
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE drafts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    -- The agreement's values and the conversation that produced them. Both are
    -- shaped by the document type, so they are stored as JSON rather than
    -- given a column each: the 11 agreements have no columns in common.
    values_json   TEXT NOT NULL DEFAULT '{}',
    messages_json TEXT NOT NULL DEFAULT '[]',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX drafts_by_user ON drafts (user_id, updated_at DESC);
"""


def connect(path: Path | None = None) -> sqlite3.Connection:
    connection = sqlite3.connect(path or database_path())
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(path: Path | None = None) -> None:
    """Recreate the database from scratch.

    The database is temporary by design, so the file is deleted rather than
    migrated: PL-7's own ticket says it may reset on every restart.
    """
    path = path or database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    with connect(path) as connection:
        connection.executescript(SCHEMA)


# ------------------------------------------------------------------- users


def create_user(
    connection: sqlite3.Connection, email: str, password_hash: str
) -> sqlite3.Row | None:
    """The new user, or None if that email is already taken."""
    try:
        cursor = connection.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, password_hash),
        )
    except sqlite3.IntegrityError:
        return None
    connection.commit()
    return get_user_by_id(connection, cursor.lastrowid)


def get_user_by_email(connection: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    cursor = connection.execute(
        "SELECT id, email, password_hash, created_at FROM users WHERE email = ?",
        (email,),
    )
    return cursor.fetchone()


def get_user_by_id(connection: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    cursor = connection.execute(
        "SELECT id, email, password_hash, created_at FROM users WHERE id = ?",
        (user_id,),
    )
    return cursor.fetchone()


# ------------------------------------------------------------------ drafts


def create_draft(
    connection: sqlite3.Connection,
    user_id: int,
    document_type: str,
    values: dict[str, Any],
    messages: list[dict[str, str]],
) -> sqlite3.Row:
    cursor = connection.execute(
        """
        INSERT INTO drafts (user_id, document_type, values_json, messages_json)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, document_type, json.dumps(values), json.dumps(messages)),
    )
    connection.commit()
    return get_draft(connection, user_id, cursor.lastrowid)


def update_draft(
    connection: sqlite3.Connection,
    user_id: int,
    draft_id: int,
    document_type: str,
    values: dict[str, Any],
    messages: list[dict[str, str]],
) -> sqlite3.Row | None:
    """The updated draft, or None if this user has no draft with that id."""
    connection.execute(
        """
        UPDATE drafts
           SET document_type = ?, values_json = ?, messages_json = ?,
               updated_at = datetime('now')
         WHERE id = ? AND user_id = ?
        """,
        (document_type, json.dumps(values), json.dumps(messages), draft_id, user_id),
    )
    connection.commit()
    return get_draft(connection, user_id, draft_id)


def get_draft(
    connection: sqlite3.Connection, user_id: int, draft_id: int
) -> sqlite3.Row | None:
    """Scoped to the owner: another user's draft simply does not exist."""
    cursor = connection.execute(
        "SELECT * FROM drafts WHERE id = ? AND user_id = ?", (draft_id, user_id)
    )
    return cursor.fetchone()


def list_drafts(connection: sqlite3.Connection, user_id: int) -> list[sqlite3.Row]:
    cursor = connection.execute(
        "SELECT * FROM drafts WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
        (user_id,),
    )
    return cursor.fetchall()


def delete_draft(connection: sqlite3.Connection, user_id: int, draft_id: int) -> bool:
    cursor = connection.execute(
        "DELETE FROM drafts WHERE id = ? AND user_id = ?", (draft_id, user_id)
    )
    connection.commit()
    return cursor.rowcount > 0
