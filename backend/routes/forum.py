"""Forum (public conversations) endpoints."""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, Optional

import backend.storage.publish

from backend.auth_middleware import get_current_user_optional, get_profile_id_for_request
from backend.models import Conversation

router = APIRouter(prefix="/api/forum", tags=["forum"])


@router.get("/conversations")
async def list_forum_conversations():
    """List all public conversations in the forum."""
    return backend.storage.publish.list_public_conversations()


@router.get("/conversations/{conversation_id}", response_model=Conversation)
async def get_forum_conversation(
    conversation_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get a specific public conversation from the forum.
    No profile ownership validation - anyone can read public conversations.
    """
    conversation = backend.storage.publish.get_public_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Public conversation not found")

    return conversation
