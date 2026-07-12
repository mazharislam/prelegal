"""Passwords and sessions.

PL-4 shipped a fake login: the cookie carried a bare user id and nothing was
checked. This is where that becomes real. The cookie is the same cookie — it now
carries a *signed* user id, so a user cannot simply edit it and become someone
else — which is why PL-4 put the session behind a cookie in the first place.
"""

import bcrypt
from itsdangerous import BadSignature, URLSafeSerializer

from app.config import secret_key

# bcrypt hashes at most 72 bytes and, since 5.0, refuses anything longer rather
# than truncating it. Bytes, not characters: 72 accented characters are 144 bytes.
BCRYPT_MAX_BYTES = 72


# The password is hashed, never stored. bcrypt salts each hash itself, and its
# cost factor is what makes a stolen database slow to attack.
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Whether the password matches. Always costs a full bcrypt check."""
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        # A malformed hash cannot match anything; it must not raise past here.
        return False


# A real hash of nothing in particular, to check against when the email has no
# account. Computed once: hashing on demand would make the no-such-user path cost
# two bcrypt rounds to a real user's one, which is the timing signal all over
# again, just quieter.
DUMMY_HASH = hash_password("prelegal-has-no-such-user")


def sign_session(user_id: int) -> str:
    return URLSafeSerializer(secret_key(), salt="session").dumps(user_id)


def read_session(token: str) -> int | None:
    """The user id inside a session cookie, or None if it was not one of ours."""
    try:
        user_id = URLSafeSerializer(secret_key(), salt="session").loads(token)
    except BadSignature:
        return None
    return user_id if isinstance(user_id, int) else None
