"""The document catalogue: what we can draft, and what each one needs to know.

The Common Paper templates are standard terms, not forms. They mark every value
that belongs on a cover page with a link span:

    During the <span class="orderform_link">Subscription Period</span>, ...

So a template already carries its own field list — the distinct terms it points
at. Deriving the fields from the markdown rather than hand-listing them keeps the
two from drifting: a term added to a template becomes a question the assistant
asks, with nothing else to update.

The Mutual NDA is the exception. It has a real cover page in the dataset and a
bespoke renderer, so its fields are modelled by hand in `nda.py`. It appears here
too, because the assistant still has to be able to choose it.
"""

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.config import CATALOG_PATH, TEMPLATES_DIR

# The value slots: whichever cover page, key terms, or order form the agreement
# is paired with must supply these.
LINK = re.compile(r'<span class="(?:coverpage|keyterms|orderform)_link"[^>]*>(.*?)</span>')
HEADING = re.compile(r'<span class="header_\d"[^>]*>(.*?)</span>')
ANY_TAG = re.compile(r"<[^>]+>")
LIST_MARKER = re.compile(r"^(\d+\.|[a-z]\.|[ivx]+\.)\s+")
MARKDOWN_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")

# The NDA is drafted by hand; see the module docstring.
MUTUAL_NDA_ID = "mutual-nda"
# Its cover page is the form, not an agreement to choose. The NDA itself covers it.
SKIP_FILES = {"Mutual-NDA-coverpage.md"}


@dataclass(frozen=True)
class Segment:
    """A run of a clause: either prose, or a reference to a cover-page value."""

    kind: str  # "text" | "ref" | "heading"
    value: str


@dataclass(frozen=True)
class Line:
    depth: int
    marker: str
    segments: list[Segment]


@dataclass(frozen=True)
class DocumentType:
    id: str
    name: str
    description: str
    fields: list[str]
    title: str
    lines: list[Line]


def normalize_term(term: str) -> str:
    """The name a term goes by on the cover page.

    Prose bends a term to fit the sentence — "the Customer's data", "later
    Subscription Periods" — but the cover page defines it once. Strip the
    possessive here; plurals are folded in `derive_fields`, which can see whether
    the singular is used elsewhere in the same document.
    """
    term = ANY_TAG.sub("", term).strip()
    return re.sub(r"[’']s$", "", term)


def derive_fields(text: str) -> list[str]:
    """The distinct values a template references, in the order it first needs them."""
    terms = [normalize_term(match) for match in LINK.findall(text)]

    fields: list[str] = []
    for term in terms:
        if term and term not in fields:
            fields.append(term)

    # "Subscription Periods" and "Subscription Period" are one value, written twice.
    # Only fold a plural when the singular is actually used in this document —
    # otherwise a term that simply ends in s would lose its last letter.
    singulars = set(fields)
    folded: list[str] = []
    for field in fields:
        singular = field[:-1]
        if field.endswith("s") and singular in singulars:
            continue
        folded.append(field)
    return folded


def parse_line(raw: str) -> Line | None:
    """One line of a template, as segments a renderer can lay out."""
    stripped = raw.rstrip()
    if not stripped.strip():
        return None

    indent = len(stripped) - len(stripped.lstrip(" "))
    body = stripped.lstrip(" ")

    marker = ""
    match = LIST_MARKER.match(body)
    if match:
        marker = match.group(1)
        body = body[match.end() :]

    segments: list[Segment] = []
    position = 0
    for token in re.finditer(f"{HEADING.pattern}|{LINK.pattern}", body):
        if token.start() > position:
            segments.append(Segment("text", clean_text(body[position : token.start()])))
        heading, ref = token.groups()
        if heading is not None:
            segments.append(Segment("heading", clean_text(heading)))
        else:
            segments.append(Segment("ref", normalize_term(ref)))
        position = token.end()

    if position < len(body):
        segments.append(Segment("text", clean_text(body[position:])))

    segments = [segment for segment in segments if segment.value]
    if not segments:
        return None

    return Line(depth=indent // 4, marker=marker, segments=segments)


def clean_text(text: str) -> str:
    """Prose with the markup taken out, but the words left alone."""
    text = MARKDOWN_LINK.sub(r"\1", text)
    text = ANY_TAG.sub("", text)
    text = text.replace("**", "")
    # Templates separate a clause name from its body with two spaces.
    return re.sub(r"\s+", " ", text).strip()


def parse_template(text: str) -> tuple[str, list[Line]]:
    title = ""
    lines: list[Line] = []
    for raw in text.splitlines():
        if raw.startswith("# "):
            title = clean_text(raw[2:])
            continue
        line = parse_line(raw)
        if line:
            lines.append(line)
    return title, lines


@lru_cache(maxsize=1)
def document_types() -> dict[str, DocumentType]:
    """Every agreement we can draft, keyed by id. Read once, at first use."""
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    types: dict[str, DocumentType] = {}
    for entry in catalog["templates"]:
        filename = entry["filename"]
        if filename in SKIP_FILES:
            continue

        text = (TEMPLATES_DIR / filename).read_text(encoding="utf-8")
        title, lines = parse_template(text)
        document_id = document_id_for(filename)
        types[document_id] = DocumentType(
            id=document_id,
            name=entry["name"].split(" — ")[0],
            description=entry["description"],
            fields=derive_fields(text),
            title=title,
            lines=lines,
        )
    return types


def document_id_for(filename: str) -> str:
    return Path(filename).stem.lower()


def get_document_type(document_id: str) -> DocumentType | None:
    return document_types().get(document_id)
