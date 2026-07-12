"""The document catalogue and the fields derived from the templates."""

from app.templates import (
    MUTUAL_NDA_ID,
    derive_fields,
    document_types,
    get_document_type,
    normalize_term,
    parse_line,
    parse_template,
)


def test_every_catalogued_agreement_loads():
    types = document_types()

    # Twelve catalogue entries, but the NDA's cover page is a form, not an
    # agreement to choose between.
    assert len(types) == 11
    assert MUTUAL_NDA_ID in types
    assert "csa" in types
    assert "Mutual-NDA-coverpage" not in types


def test_the_nda_derives_the_fields_we_already_knew_it_had():
    """The fields we modelled by hand in PL-3, recovered from the template alone.

    This is the check that the whole approach rests on: if deriving fields from
    the markup could not reproduce the one document we know the answer for, it
    could not be trusted for the ten we do not.
    """
    assert get_document_type(MUTUAL_NDA_ID).fields == [
        "Purpose",
        "Effective Date",
        "MNDA Term",
        "Term of Confidentiality",
        "Governing Law",
        "Jurisdiction",
    ]


def test_a_term_keeps_its_name_when_prose_makes_it_possessive():
    assert normalize_term("Customer’s") == "Customer"
    assert normalize_term("Customer's") == "Customer"
    assert normalize_term("Provider") == "Provider"


def test_a_plural_and_its_singular_are_one_field():
    text = (
        '<span class="orderform_link">Subscription Period</span> '
        '<span class="orderform_link">Subscription Periods</span>'
    )

    assert derive_fields(text) == ["Subscription Period"]


def test_a_term_that_merely_ends_in_s_keeps_its_last_letter():
    # "Increased Claims" is a term in its own right: there is no "Increased Claim"
    # anywhere in the agreement to fold it into.
    text = '<span class="coverpage_link">Increased Claims</span>'

    assert derive_fields(text) == ["Increased Claims"]


def test_fields_come_in_the_order_the_agreement_needs_them():
    fields = get_document_type("sla").fields

    assert fields[0] == "Target Uptime"
    assert "Scheduled Downtime" in fields


def test_a_clause_parses_into_prose_and_references():
    line = parse_line(
        '    1. <span class="header_3" id="1.1">Target Uptime.</span>  If there is a '
        '<span class="orderform_link">Target Uptime</span>, '
        '<span class="coverpage_link">Provider</span> will try.'
    )

    assert line.depth == 1
    assert line.marker == "1."
    assert [(segment.kind, segment.value) for segment in line.segments] == [
        ("heading", "Target Uptime."),
        ("text", "If there is a"),
        ("ref", "Target Uptime"),
        ("text", ","),
        ("ref", "Provider"),
        ("text", "will try."),
    ]


def test_a_blank_line_is_not_a_clause():
    assert parse_line("   ") is None


def test_a_template_keeps_its_title_out_of_its_clauses():
    title, lines = parse_template("# Service Level Agreement\n\n1. <span class=\"header_2\">Uptime</span>\n")

    assert title == "Service Level Agreement"
    assert len(lines) == 1
    assert lines[0].segments[0].value == "Uptime"
