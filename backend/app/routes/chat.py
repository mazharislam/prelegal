"""The AI chat that fills in the NDA.

PL-5 replaces the form: the user talks, the model asks for what is still
missing, and each turn returns a patch of the fields it learned.
"""

import json

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.ai import call_claude_structured
from app.dependencies import CurrentUser
from app.models import ChatRequest, ChatResponse
from app.nda import ChatResult

router = APIRouter(prefix="/api", tags=["chat"])

SYSTEM = """\
You are a legal assistant helping someone fill in a Common Paper Mutual NDA by
talking to them. You are not drafting the agreement: the standard terms are
fixed. You are only collecting the values on its cover page.

The fields you need are:
- purpose: why the parties are sharing confidential information
- effectiveDate: when the NDA starts
- mndaTerm: how long the NDA runs (a number of years, or until terminated)
- termOfConfidentiality: how long confidentiality survives (years, or in perpetuity)
- governingLaw: the US state whose law governs
- jurisdiction: the courts that hear disputes
- the two parties: company, signatory name, title, and notice address

If the user asks to change the standard terms, record that under modifications.
Do not ask about it: almost every NDA leaves the standard terms alone.

How to behave:
- Ask for ONE thing at a time, in plain language. Never present a form or a list
  of every remaining field.
- Acknowledge what the user just told you, then ask the next question.
- Accept what the user gives you, even out of order, and extract it.
- Suggest the common answer when the user is unsure. Do not give legal advice.
- When every field is filled, say the NDA is ready to download and stop asking.
- Keep replies to a couple of sentences.

Return only the fields you learned from the user's latest message. Do not repeat
fields that are already filled in.
"""


def build_prompt(request: ChatRequest) -> str:
    conversation = "\n".join(
        f"{message.role}: {message.content}" for message in request.messages
    )
    filled = json.dumps(request.values, indent=2)
    return (
        f"{SYSTEM}\n\n"
        f"The document so far (empty strings are still missing):\n<document>\n{filled}\n</document>\n\n"
        f"The conversation so far:\n<conversation>\n{conversation}\n</conversation>\n\n"
        "Reply to the user's latest message and extract any fields it taught you."
    )


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, user: CurrentUser):
    structured = call_claude_structured(
        build_prompt(request), ChatResult.model_json_schema()
    )

    try:
        result = ChatResult.model_validate(structured)
    except ValidationError as error:
        # The schema is enforced by the CLI, so this means the model answered
        # with a shape we cannot merge. Better a clear 502 than a 500.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The model returned an unusable response: {error.error_count()} invalid fields.",
        )

    return ChatResponse(reply=result.reply, updates=result.updates)
