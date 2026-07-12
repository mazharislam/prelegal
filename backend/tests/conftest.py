import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    """A client backed by a throwaway database, one per test.

    Entering the TestClient context runs the lifespan, which creates the schema
    at the path this fixture just pointed the app at.
    """
    monkeypatch.setenv("PRELEGAL_DB_PATH", str(tmp_path / "test.db"))
    with TestClient(app) as test_client:
        yield test_client
