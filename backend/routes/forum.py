"""Forum (public conversations) endpoints."""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, Optional

from .. import storage
from ..auth_middleware import get_current_user_optional, get_profile_id_for_request
from ..models import Conversation

router = APIRouter(prefix="/api/forum", tags=["forum"])


@router.get("/conversations")
async def list_forum_conversations():
    """List all public conversations in the forum."""
    return storage.list_public_conversations()


@router.get("/conversations/{conversation_id}", response_model=Conversation)
async def get_forum_conversation(
    conversation_id: str,
    profile_id: Optional[str] = Query(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get a specific public conversation from the forum.
    Profile ID is needed to locate the conversation.
    """
    pid = get_profile_id_for_request(user, profile_id)
    conversation = storage.get_conversation(conversation_id, pid)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not conversation.get("is_public", False):
        raise HTTPException(status_code=403, detail="Conversation is not public")

    return conversation
