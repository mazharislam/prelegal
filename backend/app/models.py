"""Request and response models."""

from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.nda import NdaUpdates
from app.security import BCRYPT_MAX_BYTES


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def fits_bcrypt(cls, password: str) -> str:
        """bcrypt's limit is 72 *bytes*, not 72 characters.

        A password of 72 accented characters is 144 bytes, and bcrypt refuses it
        outright rather than truncating. Checking the character count here would
        wave it through, and signing up would then fail with a 500 — an account
        the user could never create and never be told why.
        """
        if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
            raise ValueError(f"Password must be {BCRYPT_MAX_BYTES} bytes or fewer.")
        return password


class UserResponse(BaseModel):
    """What a user is allowed to see about themselves. The hash is not on it."""

    id: int
    email: str
    created_at: str


class MessageResponse(BaseModel):
    message: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    # The document as the frontend holds it. This is prompt context, not
    # something the backend acts on, so it is passed through as-is rather than
    # duplicating every document's shape here.
    values: dict[str, Any]
    # Which agreement we are drafting, once the assistant knows. Null until then.
    documentType: str | None = None


class Unsupported(BaseModel):
    """The user asked for an agreement we have no template for."""

    requested: str
    closest: str | None = None


class ChatResponse(BaseModel):
    reply: str
    # The NDA answers with a typed patch; the other agreements with a field map.
    updates: NdaUpdates | dict[str, str]
    documentType: str | None = None
    unsupported: Unsupported | None = None


class DraftRequest(BaseModel):
    """A draft as the desk holds it: the agreement, its values, the conversation."""

    documentType: str
    values: dict[str, Any] = {}
    messages: list[ChatMessage] = []


class DraftResponse(BaseModel):
    id: int
    documentType: str
    name: str
    values: dict[str, Any]
    messages: list[ChatMessage]
    updated_at: str


class DraftSummary(BaseModel):
    """Enough to list a draft without loading the whole agreement."""

    id: int
    documentType: str
    name: str
    blanks: int
    updated_at: str


class DocumentTypeSummary(BaseModel):
    id: str
    name: str
    description: str
    fields: list[str]


class SegmentModel(BaseModel):
    kind: Literal["text", "ref", "heading"]
    value: str


class LineModel(BaseModel):
    depth: int
    marker: str
    segments: list[SegmentModel]


class DocumentTemplate(BaseModel):
    id: str
    name: str
    title: str
    fields: list[str]
    lines: list[LineModel]
