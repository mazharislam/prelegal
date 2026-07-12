"""Request and response models."""

from pydantic import BaseModel, EmailStr


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
