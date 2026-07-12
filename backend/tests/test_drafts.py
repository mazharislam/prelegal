"""Saved drafts, and the wall between one user's and another's."""

import pytest

CSA = {
    "documentType": "csa",
    "values": {"Customer": "Acme", "Provider": "Globex"},
    "messages": [{"role": "user", "content": "I need a CSA"}],
}


def sign_up(client, email="ada@example.com"):
    client.post("/api/auth/signup", json={"email": email, "password": "correct-horse"})


def test_a_draft_needs_a_session(client):
    assert client.get("/api/drafts").status_code == 401
    assert client.post("/api/drafts", json=CSA).status_code == 401


def test_a_new_user_has_no_drafts(client):
    sign_up(client)

    assert client.get("/api/drafts").json() == []


def test_a_draft_keeps_the_agreement_and_the_conversation(client):
    sign_up(client)

    created = client.post("/api/drafts", json=CSA)

    assert created.status_code == 201
    draft = created.json()
    assert draft["documentType"] == "csa"
    assert draft["name"] == "Cloud Service Agreement"
    assert draft["values"] == {"Customer": "Acme", "Provider": "Globex"}
    # The conversation comes back too, or the assistant would resume a draft with
    # no memory of what it had already asked.
    assert draft["messages"] == [{"role": "user", "content": "I need a CSA"}]


def test_a_draft_is_saved_over_as_the_conversation_goes_on(client):
    sign_up(client)
    draft_id = client.post("/api/drafts", json=CSA).json()["id"]

    response = client.put(
        f"/api/drafts/{draft_id}",
        json={**CSA, "values": {**CSA["values"], "Subscription Period": "12 months"}},
    )

    assert response.status_code == 200
    assert response.json()["values"]["Subscription Period"] == "12 months"
    # Saved over, not saved again.
    assert len(client.get("/api/drafts").json()) == 1


def test_the_list_says_how_much_of_each_agreement_is_still_owed(client):
    sign_up(client)
    client.post("/api/drafts", json=CSA)

    summary = client.get("/api/drafts").json()[0]

    assert summary["name"] == "Cloud Service Agreement"
    # 19 fields, two of them filled in.
    assert summary["blanks"] == 17


def test_the_nda_counts_its_own_blanks(client):
    sign_up(client)
    client.post(
        "/api/drafts",
        json={
            "documentType": "mutual-nda",
            "values": {"purpose": "Evaluating a deal", "governingLaw": "Delaware"},
            "messages": [],
        },
    )

    summary = client.get("/api/drafts").json()[0]

    # Effective Date and Jurisdiction are still owed.
    assert summary["blanks"] == 2


def test_the_newest_draft_is_listed_first(client):
    sign_up(client)
    first = client.post("/api/drafts", json=CSA).json()["id"]
    second = client.post("/api/drafts", json={**CSA, "documentType": "sla"}).json()["id"]

    listed = [draft["id"] for draft in client.get("/api/drafts").json()]

    assert listed[0] == second
    assert set(listed) == {first, second}


def test_a_draft_can_be_deleted(client):
    sign_up(client)
    draft_id = client.post("/api/drafts", json=CSA).json()["id"]

    assert client.delete(f"/api/drafts/{draft_id}").status_code == 204
    assert client.get("/api/drafts").json() == []
    assert client.get(f"/api/drafts/{draft_id}").status_code == 404


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_a_draft_that_does_not_exist_is_a_404(client, method):
    sign_up(client)

    call = getattr(client, method)
    response = call("/api/drafts/999", json=CSA) if method == "put" else call("/api/drafts/999")

    assert response.status_code == 404


def test_one_user_cannot_reach_anothers_draft(client):
    """Not forbidden — absent. Whether it exists is not theirs to learn."""
    sign_up(client, "ada@example.com")
    draft_id = client.post("/api/drafts", json=CSA).json()["id"]
    client.post("/api/auth/signout")

    sign_up(client, "eve@example.com")

    assert client.get("/api/drafts").json() == []
    assert client.get(f"/api/drafts/{draft_id}").status_code == 404
    assert client.put(f"/api/drafts/{draft_id}", json=CSA).status_code == 404
    assert client.delete(f"/api/drafts/{draft_id}").status_code == 404

    # And it is still there for the user it belongs to.
    client.post("/api/auth/signout")
    client.post(
        "/api/auth/signin",
        json={"email": "ada@example.com", "password": "correct-horse"},
    )
    assert client.get(f"/api/drafts/{draft_id}").status_code == 200
