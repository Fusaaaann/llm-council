# ============================================================================
# ENCRYPTION FUNCTIONS
# ============================================================================

from backend.config import DEFAULT_PROFILE_ID, ENCRYPTION_KEY
from backend.encryption import FernetProvider, create_encryption_metadata, encrypt_data, is_encrypted
from backend.storage.conversations import get_conversation
from backend.storage.database import get_db_connection


import json
from typing import Any, Dict


def encrypt_conversation(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> Dict[str, Any]:
    """
    Encrypt a conversation's messages.

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier

    Returns:
        Updated conversation dict

    Raises:
        ValueError: If conversation not found or encryption fails
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    # Check if already encrypted by loading raw data
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM conversations WHERE id = ? AND profile_id = ?",
            (conversation_id, profile_id)
        )
        row = cursor.fetchone()
        if row:
            raw_data = json.loads(row['data'])
            if is_encrypted(raw_data):
                # Already encrypted, return as-is
                return conversation

    # Get encryption provider
    provider = FernetProvider(ENCRYPTION_KEY.encode('utf-8'))

    # Create encrypted version
    data_to_save = conversation.copy()
    messages = data_to_save.get("messages", [])

    # Encrypt messages
    data_to_save["messages_encrypted"] = encrypt_data(messages, provider)

    # Remove plaintext messages
    if "messages" in data_to_save:
        del data_to_save["messages"]

    # Add encryption metadata
    data_to_save["_encryption"] = create_encryption_metadata(provider)

    # Save encrypted version
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE conversations SET data = ? WHERE id = ? AND profile_id = ?",
            (json.dumps(data_to_save), conversation_id, profile_id)
        )
        conn.commit()

    # Return decrypted conversation for use
    return conversation


def decrypt_conversation(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> Dict[str, Any]:
    """
    Decrypt a conversation's messages (save as plaintext).

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier

    Returns:
        Updated conversation dict

    Raises:
        ValueError: If conversation not found or decryption fails
    """
    # First load the conversation (auto-decrypts)
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    # Check if it's encrypted
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM conversations WHERE id = ? AND profile_id = ?",
            (conversation_id, profile_id)
        )
        row = cursor.fetchone()
        if row:
            raw_data = json.loads(row['data'])
            if not is_encrypted(raw_data):
                # Already plaintext, return as-is
                return conversation

    # Save without encryption (plaintext)
    data_to_save = conversation.copy()

    # Remove encryption metadata if present
    if "_encryption" in data_to_save:
        del data_to_save["_encryption"]
    if "messages_encrypted" in data_to_save:
        del data_to_save["messages_encrypted"]

    # Save plaintext version
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE conversations SET data = ? WHERE id = ? AND profile_id = ?",
            (json.dumps(data_to_save), conversation_id, profile_id)
        )
        conn.commit()

    return conversation


def get_conversation_encryption_status(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> Dict[str, Any]:
    """
    Get the encryption status of a conversation.

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier

    Returns:
        Dict with encryption status information

    Raises:
        ValueError: If conversation not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM conversations WHERE id = ? AND profile_id = ?",
            (conversation_id, profile_id)
        )
        row = cursor.fetchone()

        if not row:
            raise ValueError(f"Conversation {conversation_id} not found")

        data = json.loads(row['data'])

    encrypted = is_encrypted(data)
    provider = None
    version = None

    if encrypted and "_encryption" in data:
        provider = data["_encryption"].get("provider")
        version = data["_encryption"].get("version")

    return {
        "is_encrypted": encrypted,
        "provider": provider,
        "version": version
    }