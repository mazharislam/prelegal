"""Sign up, sign in, sign out — and the session that carries it.

PL-4's login was a fake. These are the tests that say it no longer is: a password
is required, it is checked, it is never stored in the clear, and the cookie
cannot be edited into somebody else's session.
"""

from app import security
from app.config import SESSION_COOKIE

ADA = {"email": "ada@example.com", "password": "correct-horse"}


def signup(client, **overrides):
    return client.post("/api/auth/signup", json={**ADA, **overrides})


def test_signup_creates_an_account_and_signs_the_user_in(client):
    response = signup(client)

    assert response.status_code == 201
    assert response.json()["email"] == "ada@example.com"
    assert client.get("/api/auth/me").status_code == 200


def test_signup_never_hands_back_the_password(client):
    body = signup(client).json()

    assert "password" not in body
    assert "password_hash" not in body


def test_the_password_is_not_stored_in_the_clear(client):
    signup(client)

    stored = client.get("/api/auth/me").json()
    assert stored["email"] == "ada@example.com"
    # The hash is what the database keeps, and it is not the password.
    assert security.verify_password("correct-horse", hashed(client))
    assert hashed(client) != "correct-horse"


def hashed(client) -> str:
    from app.database import connect, get_user_by_email

    with connect() as connection:
        return get_user_by_email(connection, "ada@example.com")["password_hash"]


def test_an_email_can_only_have_one_account(client):
    signup(client)

    response = signup(client, password="different-password")

    assert response.status_code == 409


def test_an_email_is_the_same_account_whatever_its_case(client):
    signup(client)

    assert signup(client, email="ADA@example.com").status_code == 409


def test_a_short_password_is_refused(client):
    assert signup(client, password="short").status_code == 422


def test_a_password_too_long_for_bcrypt_is_refused_rather_than_crashing(client):
    """bcrypt's limit is 72 bytes, not 72 characters.

    Seventy-two accented characters are 144 bytes. Counting characters would wave
    that through, and bcrypt would then refuse it — a 500, and an account the user
    could never create and never be told why.
    """
    password = "é" * 72
    assert len(password) == 72
    assert len(password.encode("utf-8")) == 144

    response = signup(client, password=password)

    assert response.status_code == 422


def test_a_long_password_that_does_fit_is_accepted(client):
    assert signup(client, password="a" * 72).status_code == 201


def test_signin_returns_the_user(client):
    signup(client)
    client.post("/api/auth/signout")

    response = client.post("/api/auth/signin", json=ADA)

    assert response.status_code == 200
    assert response.json()["email"] == "ada@example.com"
    assert client.get("/api/auth/me").status_code == 200


def test_the_wrong_password_does_not_sign_you_in(client):
    signup(client)
    client.post("/api/auth/signout")

    response = client.post("/api/auth/signin", json={**ADA, "password": "guessing!!"})

    assert response.status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_an_unknown_email_fails_the_same_way_as_a_wrong_password(client):
    """Saying which half was wrong would tell a stranger who has an account here."""
    signup(client)
    client.post("/api/auth/signout")

    wrong_password = client.post(
        "/api/auth/signin", json={**ADA, "password": "guessing!!"}
    )
    no_account = client.post(
        "/api/auth/signin", json={"email": "nobody@example.com", "password": "guessing!!"}
    )

    assert wrong_password.status_code == no_account.status_code == 401
    assert wrong_password.json()["detail"] == no_account.json()["detail"]


def test_a_session_cannot_be_edited_into_someone_elses(client):
    """The whole point of signing the cookie."""
    signup(client)
    signed = client.cookies[SESSION_COOKIE]

    # A bare user id, as PL-4's fake session used to carry.
    client.cookies.set(SESSION_COOKIE, "1")
    assert client.get("/api/auth/me").status_code == 401

    # The real cookie, with its payload tampered with.
    client.cookies.set(SESSION_COOKIE, signed[:-1] + ("a" if signed[-1] != "a" else "b"))
    assert client.get("/api/auth/me").status_code == 401

    client.cookies.set(SESSION_COOKIE, signed)
    assert client.get("/api/auth/me").status_code == 200


def test_a_session_signed_with_another_key_is_not_ours(client, monkeypatch):
    from itsdangerous import URLSafeSerializer

    forged = URLSafeSerializer("not-our-secret", salt="session").dumps(1)
    client.cookies.set(SESSION_COOKIE, forged)

    assert client.get("/api/auth/me").status_code == 401


def test_signout_ends_the_session(client):
    signup(client)

    assert client.post("/api/auth/signout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_me_is_unauthorized_without_a_session(client):
    assert client.get("/api/auth/me").status_code == 401
