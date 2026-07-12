"""The AI chat endpoint.

Every test here mocks the subprocess: the suite must not depend on a signed-in
claude CLI, and must never spend a live model call. The one thing not covered
is whether the real model answers sensibly, which no unit test can assert.
"""

import json
import subprocess

import pytest

from app import ai

EMPTY_VALUES = {"purpose": "", "governingLaw": "", "jurisdiction": ""}

MODEL_ANSWER = {
    "reply": "Got it — Delaware law. Who are the two parties?",
    "updates": {"governingLaw": "Delaware", "party1": {"company": "Acme"}},
}


def fake_cli(monkeypatch, *, stdout=None, error=None):
    """Stand in for the claude CLI, capturing the command it was called with."""
    calls = {}

    def run(command, **kwargs):
        calls["command"] = command
        calls["kwargs"] = kwargs
        if error is not None:
            raise error
        payload = json.dumps({"structured_output": MODEL_ANSWER})
        return subprocess.CompletedProcess(
            command, 0, stdout=stdout if stdout is not None else payload, stderr=""
        )

    monkeypatch.setattr(ai.subprocess, "run", run)
    return calls


def sign_in(client):
    client.post("/api/auth/login", json={"email": "ada@example.com"})


def post_chat(client, content="Delaware law please"):
    return client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": content}],
            "values": EMPTY_VALUES,
        },
    )


def test_chat_returns_the_reply_and_a_patch(client, monkeypatch):
    fake_cli(monkeypatch)
    sign_in(client)

    response = post_chat(client)

    assert response.status_code == 200
    body = response.json()
    assert body["reply"].startswith("Got it")
    assert body["updates"]["governingLaw"] == "Delaware"
    assert body["updates"]["party1"]["company"] == "Acme"
    # A patch, not a whole document: untouched fields come back null, so the
    # frontend merge cannot clobber a value the user already settled.
    assert body["updates"]["purpose"] is None


def test_chat_calls_the_model_with_the_schema_and_conversation(client, monkeypatch):
    calls = fake_cli(monkeypatch)
    sign_in(client)

    post_chat(client, content="Governed by Delaware")

    command = calls["command"]
    assert command[0] == "claude"
    assert "claude-opus-4-8" in command
    assert "--json-schema" in command
    schema = json.loads(command[command.index("--json-schema") + 1])
    assert set(schema["properties"]) == {"reply", "updates"}
    prompt = command[-1]
    assert "Governed by Delaware" in prompt
    # The CLI speaks UTF-8; decoding it as anything else mangles every em-dash.
    assert calls["kwargs"]["encoding"] == "utf-8"


def test_chat_requires_a_session(client, monkeypatch):
    fake_cli(monkeypatch)

    response = post_chat(client)

    assert response.status_code == 401


def test_chat_reports_a_missing_cli(client, monkeypatch):
    fake_cli(monkeypatch, error=FileNotFoundError())
    sign_in(client)

    response = post_chat(client)

    assert response.status_code == 503
    assert "claude CLI was not found" in response.json()["detail"]


def test_chat_reports_a_timeout(client, monkeypatch):
    fake_cli(monkeypatch, error=subprocess.TimeoutExpired("claude", 120))
    sign_in(client)

    response = post_chat(client)

    assert response.status_code == 504


def test_chat_reports_a_failing_cli(client, monkeypatch):
    fake_cli(
        monkeypatch,
        error=subprocess.CalledProcessError(1, "claude", stderr="not signed in"),
    )
    sign_in(client)

    response = post_chat(client)

    assert response.status_code == 502
    assert "not signed in" in response.json()["detail"]


def test_chat_reports_output_that_is_not_json(client, monkeypatch):
    fake_cli(monkeypatch, stdout="this is not json")
    sign_in(client)

    response = post_chat(client)

    assert response.status_code == 502


def test_chat_reports_a_response_with_no_structured_output(client, monkeypatch):
    fake_cli(monkeypatch, stdout=json.dumps({"result": "oops"}))
    sign_in(client)

    response = post_chat(client)

    assert response.status_code == 502


def test_chat_reports_a_response_it_cannot_merge(client, monkeypatch):
    fake_cli(
        monkeypatch,
        stdout=json.dumps({"structured_output": {"reply": "hi", "updates": {"mndaTermKind": "nonsense"}}}),
    )
    sign_in(client)

    response = post_chat(client)

    assert response.status_code == 502


@pytest.mark.parametrize("content", ["", " "])
def test_chat_still_answers_an_empty_message(client, monkeypatch, content):
    """The frontend can send an empty turn to get the opening question."""
    fake_cli(monkeypatch)
    sign_in(client)

    assert post_chat(client, content=content).status_code == 200
