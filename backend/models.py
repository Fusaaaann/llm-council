"""Pydantic models for request and response validation."""

from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    uses_byok: bool = False


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str


class RenameConversationRequest(BaseModel):
    """Request to rename a conversation."""
    title: str


class ModelConfigRequest(BaseModel):
    """Request to update model configuration."""
    council_models: List[str]
    chairman_model: str


class CreateProfileRequest(BaseModel):
    """Request to create a new profile."""
    name: str
    settings: Optional[Dict[str, Any]] = None


class UpdateProfileRequest(BaseModel):
    """Request to update a profile."""
    name: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class RegisterRequest(BaseModel):
    """Request to register a new user."""
    email: str
    password: str
    name: str
    invite_token: Optional[str] = None


class LoginRequest(BaseModel):
    """Request to log in."""
    email: str
    password: str


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token."""
    refresh_token: str


class WaitlistRequest(BaseModel):
    """Request to join the waitlist."""
    email: str
    name: Optional[str] = None


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    title: str
    message_count: int
    is_loading: bool = False
    is_public: bool = False
    sync_status: str = "local"
    uses_byok: bool = False


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    profile_id: str
    created_at: str
    title: str
    messages: List[Dict[str, Any]]
    is_public: bool = False
    published_at: Optional[str] = None
    sync_status: str = "local"
    uses_byok: bool = False
