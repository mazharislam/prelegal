"""SQLite access. Plain sqlite3 from the standard library — the schema is one
table, so an ORM would cost more than it saves."""

import sqlite3
from pathlib import Path

from app.config import database_path

SCHEMA = """
CREATE TABLE users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def connect(path: Path | None = None) -> sqlite3.Connection:
    connection = sqlite3.connect(path or database_path())
    connection.row_factory = sqlite3.Row
    return connection


def init_db(path: Path | None = None) -> None:
    """Recreate the database from scratch.

    PL-4 calls for a temporary database, so the file is deleted rather than
    migrated. Persistence across restarts arrives with PL-7.
    """
    path = path or database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    with connect(path) as connection:
        connection.executescript(SCHEMA)


def upsert_user(connection: sqlite3.Connection, email: str) -> sqlite3.Row:
    """Return the user with this email, creating the row on first sight."""
    connection.execute("INSERT OR IGNORE INTO users (email) VALUES (?)", (email,))
    connection.commit()
    return get_user_by_email(connection, email)


def get_user_by_email(connection: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    cursor = connection.execute(
        "SELECT id, email, created_at FROM users WHERE email = ?", (email,)
    )
    return cursor.fetchone()


def get_user_by_id(connection: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    cursor = connection.execute(
        "SELECT id, email, created_at FROM users WHERE id = ?", (user_id,)
    )
    return cursor.fetchone()
