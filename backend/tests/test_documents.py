"""The endpoints that tell the frontend what we can draft, and how it reads."""


def test_lists_every_agreement_with_the_values_it_needs(client):
    response = client.get("/api/documents")

    assert response.status_code == 200
    documents = response.json()
    assert len(documents) == 11

    csa = next(document for document in documents if document["id"] == "csa")
    assert csa["name"] == "Cloud Service Agreement"
    assert "Subscription Period" in csa["fields"]
    assert csa["description"]


def test_serves_an_agreement_as_lines_a_renderer_can_lay_out(client):
    response = client.get("/api/documents/sla/template")

    assert response.status_code == 200
    template = response.json()
    assert template["title"] == "Service Level Agreement"
    assert template["fields"][0] == "Target Uptime"

    first = template["lines"][0]
    assert first["depth"] == 0
    assert first["marker"] == "1."
    assert first["segments"][0] == {"kind": "heading", "value": "Uptime"}

    # The values the agreement refers to are marked, so the document can
    # cross-reference them to the cover page instead of printing them inline.
    kinds = {segment["kind"] for line in template["lines"] for segment in line["segments"]}
    assert kinds == {"text", "ref", "heading"}


def test_an_agreement_we_do_not_have_is_a_404(client):
    response = client.get("/api/documents/employment-contract/template")

    assert response.status_code == 404


def test_the_catalogue_needs_no_session(client):
    """The document list is not private, and the login screen has no use for one."""
    assert client.get("/api/documents").status_code == 200
