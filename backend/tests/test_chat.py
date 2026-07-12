"""The AI chat: choosing an agreement, and filling it in.

Every test here mocks the subprocess: the suite must not depend on a signed-in
claude CLI, and must never spend a live model call. The one thing not covered is
whether the real model answers sensibly, which no unit test can assert.
"""

import json
import re
import subprocess

import pytest

from app import ai
from app.routes.chat import response_schema, updates_schema

NDA_ANSWER = {
    "reply": "Got it — Delaware law. Who are the two parties?",
    "documentType": "mutual-nda",
    "unsupported": None,
    "updates": {"governingLaw": "Delaware", "party1": {"company": "Acme"}},
}


def fake_cli(monkeypatch, answer=None, *, stdout=None, error=None):
    calls = {}

    def run(command, **kwargs):
        calls["command"] = command
        calls["kwargs"] = kwargs
        if error is not None:
            raise error
        payload = json.dumps({"structured_output": answer or NDA_ANSWER})
        return subprocess.CompletedProcess(
            command, 0, stdout=stdout if stdout is not None else payload, stderr=""
        )

    monkeypatch.setattr(ai.subprocess, "run", run)
    return calls


def sign_in(client):
    client.post("/api/auth/login", json={"email": "ada@example.com"})


def post_chat(client, content="Delaware law", document_type=None, values=None):
    return client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": content}],
            "values": values or {},
            "documentType": document_type,
        },
    )


def test_chat_requires_a_session(client, monkeypatch):
    fake_cli(monkeypatch)

    assert post_chat(client).status_code == 401


def test_the_nda_still_answers_with_its_typed_patch(client, monkeypatch):
    fake_cli(monkeypatch)
    sign_in(client)

    response = post_chat(client, document_type="mutual-nda")

    assert response.status_code == 200
    body = response.json()
    assert body["documentType"] == "mutual-nda"
    assert body["updates"]["governingLaw"] == "Delaware"
    assert body["updates"]["party1"]["company"] == "Acme"


def test_another_agreement_answers_with_its_own_fields(client, monkeypatch):
    fake_cli(
        monkeypatch,
        {
            "reply": "Got it.",
            "documentType": "csa",
            "unsupported": None,
            "updates": {"Customer": "Acme", "Subscription Period": "12 months"},
        },
    )
    sign_in(client)

    response = post_chat(client, document_type="csa")

    assert response.status_code == 200
    assert response.json()["updates"] == {
        "Customer": "Acme",
        "Subscription Period": "12 months",
    }


def test_a_field_the_agreement_does_not_have_is_dropped(client, monkeypatch):
    """Nothing could render it, so it must not reach the document."""
    fake_cli(
        monkeypatch,
        {
            "reply": "Got it.",
            "documentType": "sla",
            "unsupported": None,
            "updates": {"Target Uptime": "99.9%", "Favourite Colour": "blue"},
        },
    )
    sign_in(client)

    response = post_chat(client, document_type="sla")

    assert response.json()["updates"] == {"Target Uptime": "99.9%"}


def test_an_agreement_we_cannot_draft_is_reported_with_the_closest_one(client, monkeypatch):
    fake_cli(
        monkeypatch,
        {
            "reply": "I cannot draft an employment contract. The closest I can do is a Professional Services Agreement — shall I?",
            "documentType": None,
            "unsupported": {"requested": "employment contract", "closest": "psa"},
            "updates": {},
        },
    )
    sign_in(client)

    response = post_chat(client, content="I need an employment contract")

    body = response.json()
    assert body["unsupported"] == {"requested": "employment contract", "closest": "psa"}
    # Nothing is drafted until the user agrees to the alternative.
    assert body["documentType"] is None


def test_choosing_an_agreement_keeps_the_values_named_in_the_same_breath(
    client, monkeypatch
):
    """"A CSA for Acme, 12 months" names the agreement and two values at once.

    The first call is answered with a schema that has no fields — we did not yet
    know which agreement. So the turn is asked again once we do, or those values
    would be acknowledged in the reply and then quietly dropped.
    """
    answers = [
        {"reply": "Sure.", "documentType": "csa", "unsupported": None, "updates": {}},
        {
            "reply": "Drafting a Cloud Service Agreement for Acme.",
            "documentType": "csa",
            "unsupported": None,
            "updates": {"Customer": "Acme", "Subscription Period": "12 months"},
        },
    ]
    schemas = []

    def run(command, **kwargs):
        schemas.append(json.loads(command[command.index("--json-schema") + 1]))
        payload = json.dumps({"structured_output": answers[len(schemas) - 1]})
        return subprocess.CompletedProcess(command, 0, stdout=payload, stderr="")

    monkeypatch.setattr(ai.subprocess, "run", run)
    sign_in(client)

    response = post_chat(client, content="A CSA for Acme, 12 months", document_type=None)

    assert len(schemas) == 2
    # The first ask had no fields to offer; the second had the CSA's.
    assert schemas[0]["properties"]["updates"]["properties"] == {}
    assert "Subscription Period" in schemas[1]["properties"]["updates"]["properties"]

    body = response.json()
    assert body["documentType"] == "csa"
    assert body["updates"] == {"Customer": "Acme", "Subscription Period": "12 months"}


def test_an_agreement_that_does_not_change_is_asked_for_once(client, monkeypatch):
    calls = fake_cli(monkeypatch)
    sign_in(client)

    post_chat(client, document_type="mutual-nda")

    # The NDA was already in play, so there is nothing to re-ask.
    assert calls["command"].count("--json-schema") == 1


def test_an_agreement_in_play_is_not_un_chosen_by_the_model_going_quiet(
    client, monkeypatch
):
    """The model failing to restate the agreement must not discard it.

    The prompt itself invites this: when the user asks about an agreement we
    cannot draft, the model is told to leave documentType unset until they agree
    to the alternative. If that null were echoed back, the frontend would read it
    as a change of document and wipe every value the user had given — losing the
    draft, silently, with no error.
    """
    fake_cli(
        monkeypatch,
        {
            "reply": "I cannot draft a lease. Shall I carry on with the CSA?",
            "documentType": None,
            "unsupported": {"requested": "lease", "closest": None},
            "updates": {},
        },
    )
    sign_in(client)

    response = post_chat(client, content="Can you do a lease too?", document_type="csa")

    assert response.json()["documentType"] == "csa"


def test_the_schema_offers_no_fields_before_an_agreement_is_chosen(client):
    """The only job on the first turn is to find out what the user needs."""
    assert updates_schema(None)["properties"] == {}


def test_the_schema_carries_the_fields_of_the_agreement_in_play():
    sla = updates_schema("sla")

    assert "Target Uptime" in sla["properties"]
    # ... and nothing from any other agreement.
    assert "Categories of Personal Data" not in sla["properties"]

    nda = updates_schema("mutual-nda")
    assert "mndaTermKind" in nda["properties"]


def test_every_reference_in_the_schema_resolves_from_its_root():
    """The NDA nests a party, which Pydantic writes as a $ref into $defs.

    A $ref resolves from the root of the schema it is sent in, so if those defs
    stay buried under `updates` the reference dangles and the CLI rejects the
    whole schema — which is exactly what it did, with the NDA simply refusing to
    draft. Mocking the CLI cannot catch this: only the real one resolves the refs.
    """
    schema = response_schema("mutual-nda")

    refs = re.findall(r'"\$ref":\s*"#/\$defs/(\w+)"', json.dumps(schema))
    assert refs, "the NDA schema should still nest a party by reference"
    assert set(refs) <= set(schema.get("$defs", {}))


def test_the_schema_only_lets_the_model_choose_an_agreement_we_have():
    schema = response_schema(None)

    choices = schema["properties"]["documentType"]["enum"]
    assert "csa" in choices
    assert None in choices
    assert "employment-contract" not in choices


def test_chat_sends_the_conversation_and_the_schema(client, monkeypatch):
    calls = fake_cli(monkeypatch)
    sign_in(client)

    post_chat(client, content="Governed by Delaware", document_type="mutual-nda")

    command = calls["command"]
    assert "claude-opus-4-8" in command
    schema = json.loads(command[command.index("--json-schema") + 1])
    assert set(schema["properties"]) == {"reply", "documentType", "unsupported", "updates"}
    prompt = command[-1]
    assert "Governed by Delaware" in prompt
    # The assistant cannot offer an agreement it has not been told about.
    assert "Cloud Service Agreement" in prompt
    assert calls["kwargs"]["encoding"] == "utf-8"


def test_chat_reports_a_missing_cli(client, monkeypatch):
    fake_cli(monkeypatch, error=FileNotFoundError())
    sign_in(client)

    response = post_chat(client)

    assert response.status_code == 503
    assert "claude CLI was not found" in response.json()["detail"]


def test_chat_reports_a_timeout(client, monkeypatch):
    fake_cli(monkeypatch, error=subprocess.TimeoutExpired("claude", 120))
    sign_in(client)

    assert post_chat(client).status_code == 504


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

    assert post_chat(client).status_code == 502


def test_chat_reports_a_response_with_no_structured_output(client, monkeypatch):
    fake_cli(monkeypatch, stdout=json.dumps({"result": "oops"}))
    sign_in(client)

    assert post_chat(client).status_code == 502


def test_chat_reports_a_response_it_cannot_read(client, monkeypatch):
    fake_cli(monkeypatch, {"documentType": None, "unsupported": None, "updates": {}})
    sign_in(client)

    # No reply at all: there is nothing to show the user.
    assert post_chat(client).status_code == 502


def test_chat_reports_an_nda_patch_it_cannot_merge(client, monkeypatch):
    fake_cli(
        monkeypatch,
        {
            "reply": "hi",
            "documentType": "mutual-nda",
            "unsupported": None,
            "updates": {"mndaTermKind": "nonsense"},
        },
    )
    sign_in(client)

    assert post_chat(client, document_type="mutual-nda").status_code == 502


@pytest.mark.parametrize("content", ["", " "])
def test_chat_still_answers_an_empty_message(client, monkeypatch, content):
    fake_cli(monkeypatch)
    sign_in(client)

    assert post_chat(client, content=content).status_code == 200
