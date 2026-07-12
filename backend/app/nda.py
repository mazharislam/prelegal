"""The Mutual NDA field model, mirroring `frontend/src/lib/nda.ts`.

The AI answers with an `NdaUpdates` patch: only the fields it learned this
turn. It is never asked to echo back the whole document, because a model that
restates every value each turn is a model that can silently overwrite one the
user already settled.
"""

from typing import Literal

from pydantic import BaseModel, Field


class PartyUpdate(BaseModel):
    company: str | None = None
    signatoryName: str | None = None
    title: str | None = None
    noticeAddress: str | None = None


class NdaUpdates(BaseModel):
    purpose: str | None = Field(
        None, description="What the parties will use the confidential information for"
    )
    effectiveDate: str | None = Field(
        None, description="The date the NDA takes effect, as ISO yyyy-mm-dd"
    )
    mndaTermKind: Literal["expires", "untilTerminated"] | None = Field(
        None, description="Whether the NDA expires after a number of years or runs until terminated"
    )
    mndaTermYears: str | None = Field(
        None, description="Years until the NDA expires, when mndaTermKind is 'expires'"
    )
    confidentialityKind: Literal["years", "inPerpetuity"] | None = Field(
        None, description="Whether confidentiality lasts a number of years or forever"
    )
    confidentialityYears: str | None = Field(
        None,
        description="Years confidentiality survives, when confidentialityKind is 'years'",
    )
    governingLaw: str | None = Field(
        None, description="The US state whose law governs the agreement"
    )
    jurisdiction: str | None = Field(
        None, description="The courts that hear disputes, e.g. 'Wilmington, Delaware'"
    )
    modifications: str | None = Field(
        None,
        description=(
            "Changes to the standard terms, if the user asks for any. Most NDAs have "
            "none, so never ask for this: only fill it in when the user raises it."
        ),
    )
    party1: PartyUpdate | None = Field(None, description="The first party to the NDA")
    party2: PartyUpdate | None = Field(None, description="The second party to the NDA")


class ChatResult(BaseModel):
    """What the model must return on every turn."""

    reply: str = Field(
        description="The reply to show the user: acknowledge what they said, then ask for the next missing field"
    )
    updates: NdaUpdates = Field(
        description="Only the fields learned from this message. Omit everything else."
    )
