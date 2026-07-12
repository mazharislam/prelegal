"""Environment-driven configuration and constants.

The paths are read on each call rather than captured at import so that tests can
point the app at a throwaway database without reloading modules.
"""

import os
import secrets
from functools import lru_cache
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

# The agreement templates and their catalogue. These ship inside the image: the
# backend cannot ask the user for a value it does not know the document needs.
TEMPLATES_DIR = Path(os.environ.get("PRELEGAL_TEMPLATES_DIR", PROJECT_ROOT / "templates"))
CATALOG_PATH = Path(os.environ.get("PRELEGAL_CATALOG_PATH", PROJECT_ROOT / "catalog.json"))

# The fake session cookie. PL-4 has no authentication: this carries a user id,
# not a credential. PL-7 replaces the value with a signed token.
SESSION_COOKIE = "prelegal_session"

# The Next.js dev server, which runs on a different origin than the API and so
# needs to be allowed to send the session cookie.
DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]


@lru_cache(maxsize=1)
def secret_key() -> str:
    """The key that signs session cookies.

    Generated at startup when unset, which is the right default here: the
    database is rebuilt on every start, so there are no accounts for a session to
    outlive. A deployment that kept its data would set PRELEGAL_SECRET_KEY, or
    every restart would sign everyone out.
    """
    return os.environ.get("PRELEGAL_SECRET_KEY") or secrets.token_urlsafe(32)


def database_path() -> Path:
    """The SQLite file. Temporary by design: PL-4 specifies a database rebuilt
    from scratch on every start, so nothing here survives a restart."""
    return Path(os.environ.get("PRELEGAL_DB_PATH", BACKEND_DIR / "data" / "prelegal.db"))


def static_dir() -> Path:
    """The directory holding the statically exported frontend. Absent during
    backend-only development, in which case the app serves the API alone."""
    return Path(os.environ.get("PRELEGAL_STATIC_DIR", BACKEND_DIR / "static"))
