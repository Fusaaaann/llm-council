# ============================================================================
# PUBLISH/UNPUBLISH FUNCTIONS
# ============================================================================

import json
from backend.config import DEFAULT_PROFILE_ID
from backend.encryption import decrypt_data, get_encryption_provider, is_encrypted
from backend.storage.conversations import get_conversation, save_conversation


from datetime import datetime
from typing import Any, Dict, Optional

from backend.storage.database import ensure_data_dir, get_db_connection


def publish_conversation(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> Dict[str, Any]:
    """
    Mark a conversation as public and set published timestamp.

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier

    Returns:
        Updated conversation dict
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    if conversation.get("uses_byok", False):
        raise ValueError("Cannot publish BYOK conversations")

    conversation["is_public"] = True
    conversation["published_at"] = datetime.utcnow().isoformat()
    conversation["sync_status"] = "synced"

    save_conversation(conversation)

    return conversation


def unpublish_conversation(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> Dict[str, Any]:
    """
    Mark a conversation as private.

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier

    Returns:
        Updated conversation dict
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["is_public"] = False
    conversation["published_at"] = None
    conversation["sync_status"] = "local"

    save_conversation(conversation)

    return conversation


def get_public_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a public conversation by ID, searching across all profiles.
    No profile ownership validation - anyone can read public conversations.

    Args:
        conversation_id: Unique identifier for the conversation

    Returns:
        Conversation dict or None if not found or not public
    """
    ensure_data_dir()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM conversations WHERE id = ? AND is_public = 1",
            (conversation_id,)
        )
        row = cursor.fetchone()

        if not row:
            return None

        data = json.loads(row['data'])

        # Only return if it's public
        if not data.get("is_public", False):
            return None

        # Decrypt if necessary
        if is_encrypted(data):
            provider = get_encryption_provider()
            decrypted_messages = decrypt_data(data["messages_encrypted"], provider)
            data["messages"] = decrypted_messages
            # Remove encryption metadata from returned data
            data.pop("messages_encrypted", None)
            data.pop("_encryption", None)

        return data


