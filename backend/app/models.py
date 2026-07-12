"""Request and response models."""

from typing import Any, Literal

from pydantic import BaseModel, EmailStr

from app.nda import NdaUpdates


class LoginRequest(BaseModel):
    """The fake login. A password field is deliberately absent: PL-4 has no
    authentication, and accepting a password would imply it is checked."""

    email: EmailStr


class UserResponse(BaseModel):
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
