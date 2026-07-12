"""The AI chat that decides which agreement to draft, and fills it in.

The response schema is built per turn, because what the assistant may answer with
depends on which agreement is on the table: the Mutual NDA takes a typed patch
(its options are not free text), and every other agreement takes a map of the
fields its own template asks for. Handing the model a schema that only contains
the fields of the document in play is what stops it inventing fields.
"""

import json
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.ai import call_claude_structured
from app.dependencies import CurrentUser
from app.models import ChatRequest, ChatResponse, Unsupported
from app.nda import NdaUpdates
from app.templates import MUTUAL_NDA_ID, document_types, get_document_type

router = APIRouter(prefix="/api", tags=["chat"])

SYSTEM = """\
You are a legal assistant who drafts agreements by talking to the user. You do
not write the agreements: their standard terms are fixed. You work out which
agreement the user needs, then collect the values its cover page requires.

How to behave:
- If you do not yet know which agreement the user wants, ask. Set documentType as
  soon as you know, and say which one you are drafting.
- Ask for ONE value at a time, in plain language. Never present a form or a list
  of every remaining field.
- Acknowledge what the user just told you, then ask for the next value.
- Accept values out of order, and extract whatever the user gives you.
- Suggest the common answer when the user is unsure. Do not give legal advice.
- When every value is filled, say the agreement is ready to download and stop asking.
- Keep replies to a couple of sentences.

If the user asks for an agreement that is not one of the ones you can draft:
- Say plainly that you cannot draft that one.
- Name the closest agreement you CAN draft, and say why it is close.
- Offer to go ahead with it, and wait for the user to agree before setting documentType.
- Record this in `unsupported`: what they asked for, and the id you offered.
Never draft a different agreement than the one the user asked for without saying so.

Return only the values you learned from the user's latest message. Do not repeat
values that are already filled in.
"""


def catalogue() -> str:
    return "\n".join(
        f"- {document.id}: {document.name} — {document.description}"
        for document in document_types().values()
    )


def updates_schema(document_id: str | None) -> dict[str, Any]:
    """The fields the assistant may fill in on this turn.

    Before an agreement is chosen there are none: the only job is to find out what
    the user needs. The NDA keeps its hand-written schema, because its term options
    are choices rather than free text. Everything else is driven by the fields its
    template references.
    """
    if document_id == MUTUAL_NDA_ID:
        return NdaUpdates.model_json_schema()

    document = get_document_type(document_id) if document_id else None
    if document is None:
        return {"type": "object", "properties": {}, "additionalProperties": False}

    return {
        "type": "object",
        "properties": {
            field: {
                "type": "string",
                "description": f"The agreement's {field}",
            }
            for field in document.fields
        },
        "additionalProperties": False,
    }


def response_schema(document_id: str | None) -> dict[str, Any]:
    updates = updates_schema(document_id)

    # The NDA's schema nests a party, which Pydantic writes as a $ref into $defs.
    # A $ref resolves from the root of the schema it lands in, so those defs have
    # to be hoisted out of `updates` and up here, or the reference dangles and the
    # CLI rejects the whole schema.
    definitions = updates.pop("$defs", None)

    schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "reply": {
                "type": "string",
                "description": "What to say to the user: acknowledge, then ask for the next value.",
            },
            "documentType": {
                "type": ["string", "null"],
                "enum": [*document_types(), None],
                "description": "The agreement being drafted, once the user has settled on one.",
            },
            "unsupported": {
                "type": ["object", "null"],
                "properties": {
                    "requested": {
                        "type": "string",
                        "description": "The agreement the user asked for that we cannot draft.",
                    },
                    "closest": {
                        "type": ["string", "null"],
                        "enum": [*document_types(), None],
                        "description": "The id of the closest agreement we can draft.",
                    },
                },
                "required": ["requested", "closest"],
                "additionalProperties": False,
                "description": "Set only when the user asks for an agreement we have no template for.",
            },
            "updates": updates,
        },
        "required": ["reply", "documentType", "unsupported", "updates"],
        "additionalProperties": False,
    }

    if definitions:
        schema["$defs"] = definitions

    return schema


def build_prompt(request: ChatRequest) -> str:
    conversation = "\n".join(
        f"{message.role}: {message.content}" for message in request.messages
    )

    document = get_document_type(request.documentType) if request.documentType else None
    if document is None:
        drafting = "The user has not settled on an agreement yet."
    else:
        fields = "\n".join(f"- {field}" for field in document.fields)
        drafting = (
            f"You are drafting: {document.name}.\n"
            f"Its cover page needs these values:\n{fields}"
        )

    return (
        f"{SYSTEM}\n\n"
        f"The agreements you can draft:\n{catalogue()}\n\n"
        f"{drafting}\n\n"
        f"The values so far (empty means still missing):\n"
        f"<document>\n{json.dumps(request.values, indent=2)}\n</document>\n\n"
        f"The conversation so far:\n<conversation>\n{conversation}\n</conversation>\n\n"
        "Reply to the user's latest message and extract any values it taught you."
    )


def parse_updates(document_id: str | None, raw: Any) -> NdaUpdates | dict[str, str]:
    """The patch, checked against the agreement actually in play.

    The schema already constrains the model, but a field the document does not
    have would be a field nothing can render, so drop anything unrecognised
    rather than passing it on.
    """
    if not isinstance(raw, dict):
        return {}

    if document_id == MUTUAL_NDA_ID:
        return NdaUpdates.model_validate(raw)

    document = get_document_type(document_id) if document_id else None
    if document is None:
        return {}

    return {
        field: value
        for field, value in raw.items()
        if field in document.fields and isinstance(value, str) and value
    }


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, user: CurrentUser):
    structured = call_claude_structured(
        build_prompt(request), response_schema(request.documentType)
    )
    document_id = request.documentType

    chosen = structured.get("documentType")
    if chosen and chosen != document_id and get_document_type(chosen):
        # The turn that picks the agreement was answered with a schema that had
        # none of its fields — before this turn we did not know which agreement
        # it was. So the user's opening "a CSA for Acme and Globex, 12 months"
        # would name four values with nowhere to record them. Ask again, now that
        # we know what they asked for, so the answer keeps what they already said.
        document_id = chosen
        structured = call_claude_structured(
            build_prompt(request.model_copy(update={"documentType": chosen})),
            response_schema(chosen),
        )

    try:
        updates = parse_updates(document_id, structured.get("updates"))
        unsupported = structured.get("unsupported")
        return ChatResponse(
            reply=structured["reply"],
            updates=updates,
            # `document_id`, not whatever the model last said. An agreement
            # already being drafted is not un-chosen by the model failing to
            # restate it — and the prompt actively invites that, by telling it to
            # leave documentType unset while the user considers an alternative.
            # Echoing a stray null back would tell the frontend the document had
            # changed, and it would wipe every value the user has given.
            documentType=document_id,
            unsupported=Unsupported.model_validate(unsupported) if unsupported else None,
        )
    except (KeyError, ValidationError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The model returned an unusable response: {error}",
        )
