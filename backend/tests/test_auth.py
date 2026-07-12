"""The fake sign-in flow. There is no password to test: PL-4 authenticates
nobody. What these cover is that a session is established, survives across
requests, identifies the right user, and can be ended.
"""

from app.config import SESSION_COOKIE


def test_login_creates_user_and_sets_session_cookie(client):
    response = client.post("/api/auth/login", json={"email": "ada@example.com"})

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "ada@example.com"
    assert body["id"] > 0
    assert client.cookies[SESSION_COOKIE] == str(body["id"])


def test_login_twice_reuses_the_same_user(client):
    first = client.post("/api/auth/login", json={"email": "ada@example.com"}).json()
    second = client.post("/api/auth/login", json={"email": "ada@example.com"}).json()

    assert first["id"] == second["id"]


def test_login_rejects_a_malformed_email(client):
    response = client.post("/api/auth/login", json={"email": "not-an-email"})

    assert response.status_code == 422


def test_me_returns_the_signed_in_user(client):
    login = client.post("/api/auth/login", json={"email": "ada@example.com"}).json()

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["id"] == login["id"]
    assert response.json()["email"] == "ada@example.com"


def test_me_is_unauthorized_without_a_session(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_me_is_unauthorized_when_the_session_is_not_a_user_id(client):
    client.cookies.set(SESSION_COOKIE, "not-a-number")

    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_me_is_unauthorized_when_the_session_points_at_no_user(client):
    client.cookies.set(SESSION_COOKIE, "999")

    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_logout_clears_the_session(client):
    client.post("/api/auth/login", json={"email": "ada@example.com"})

    response = client.post("/api/auth/logout")

    assert response.status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_the_database_is_empty_on_a_fresh_start(client):
    """PL-4's database is temporary: a new start begins with no users, so the
    first sign-in always mints id 1."""
    body = client.post("/api/auth/login", json={"email": "first@example.com"}).json()

    assert body["id"] == 1
