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
    # duplicating the whole NdaValues shape here.
    values: dict[str, Any]


class ChatResponse(BaseModel):
    reply: str
    updates: NdaUpdates
