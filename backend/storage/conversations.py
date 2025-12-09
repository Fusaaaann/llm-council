# ============================================================================
# CONVERSATION FUNCTIONS
# ============================================================================

from backend.config import DEFAULT_PROFILE_ID
from backend.encryption import create_encryption_metadata, decrypt_data, encrypt_data, get_encryption_provider, is_encrypted
from backend.storage.database import ensure_data_dir, get_db_connection


import json
from datetime import datetime
from typing import Any, Dict, List, Optional



def create_conversation(
    conversation_id: str,
    profile_id: str = DEFAULT_PROFILE_ID,
    uses_byok: bool = False,
    council_models: Optional[List[str]] = None,
    chairman_model: Optional[str] = None,
    workflow_json: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new conversation.

    Args:
        conversation_id: Unique identifier for the conversation
        profile_id: Profile identifier
        uses_byok: Whether the conversation uses bring-your-own-key
        council_models: List of model identifiers for council (defaults to config.COUNCIL_MODELS)
        chairman_model: Model identifier for chairman (defaults to config.CHAIRMAN_MODEL)
        workflow_json: Optional workflow DSL JSON string (overrides council config if provided)

    Returns:
        New conversation dict
    """
    ensure_data_dir()

    # Import here to avoid circular dependency
    from ..config import COUNCIL_MODELS, CHAIRMAN_MODEL

    conversation = {
        "id": conversation_id,
        "profile_id": profile_id,
        "created_at": datetime.utcnow().isoformat(),
        "title": "New Conversation",
        "messages": [],
        "is_public": not uses_byok,  # Default: public unless BYOK
        "published_at": None,
        "sync_status": "local",  # local, syncing, synced
        "uses_byok": uses_byok,
        "council_models": council_models if council_models is not None else COUNCIL_MODELS,
        "chairman_model": chairman_model if chairman_model is not None else CHAIRMAN_MODEL,
        "workflow_json": workflow_json  # Workflow DSL JSON (if provided)
    }

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO conversations
               (id, profile_id, created_at, title, is_public, uses_byok, data)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                conversation_id,
                profile_id,
                conversation["created_at"],
                conversation["title"],
                1 if conversation["is_public"] else 0,
                1 if uses_byok else 0,
                json.dumps(conversation)
            )
        )
        conn.commit()

    return conversation


def get_conversation(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> Optional[Dict[str, Any]]:
    """
    Load a conversation from storage, decrypting if necessary.

    Args:
        conversation_id: Unique identifier for the conversation
        profile_id: Profile identifier

    Returns:
        Conversation dict or None if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM conversations WHERE id = ? AND profile_id = ?",
            (conversation_id, profile_id)
        )
        row = cursor.fetchone()

        if not row:
            return None

        data = json.loads(row['data'])

    # Check if data is encrypted
    if is_encrypted(data):
        provider = get_encryption_provider()
        if provider is None:
            raise ValueError("Encrypted conversation found but encryption is disabled")

        # Decrypt messages
        if "messages_encrypted" in data:
            try:
                data["messages"] = decrypt_data(data["messages_encrypted"], provider)
                del data["messages_encrypted"]
                if "_encryption" in data:
                    del data["_encryption"]
            except ValueError as e:
                # Decryption failed - could be wrong key or corrupted data
                raise ValueError(f"Failed to decrypt conversation: {e}")

    # Ensure profile_id is present (for backward compatibility)
    if "profile_id" not in data:
        data["profile_id"] = profile_id

    return data


def save_conversation(conversation: Dict[str, Any], profile_id: str = None):
    """
    Save a conversation to storage, encrypting if enabled.

    Args:
        conversation: Conversation dict to save
        profile_id: Profile identifier (uses conversation's profile_id if not provided)
    """
    ensure_data_dir()

    if profile_id is None:
        profile_id = conversation.get('profile_id', DEFAULT_PROFILE_ID)

    # Create a copy to avoid modifying original
    data_to_save = conversation.copy()

    # Update modified_at timestamp
    data_to_save["modified_at"] = datetime.utcnow().isoformat()

    # Encrypt messages if encryption is enabled
    provider = get_encryption_provider()
    if provider is not None:
        # Extract messages for encryption
        messages = data_to_save.get("messages", [])

        # Encrypt messages
        data_to_save["messages_encrypted"] = encrypt_data(messages, provider)

        # Remove plaintext messages
        if "messages" in data_to_save:
            del data_to_save["messages"]

        # Add encryption metadata
        data_to_save["_encryption"] = create_encryption_metadata(provider)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE conversations
               SET data = ?, modified_at = ?, title = ?, is_public = ?, uses_byok = ?
               WHERE id = ? AND profile_id = ?""",
            (
                json.dumps(data_to_save),
                data_to_save["modified_at"],
                data_to_save.get("title", "New Conversation"),
                1 if data_to_save.get("is_public", False) else 0,
                1 if data_to_save.get("uses_byok", False) else 0,
                conversation['id'],
                profile_id
            )
        )
        conn.commit()


def list_public_conversations() -> List[Dict[str, Any]]:
    """
    List all public conversations across all profiles.

    Returns:
        List of public conversation metadata dicts
    """
    ensure_data_dir()

    public_conversations = []

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM conversations WHERE is_public = 1")

        for row in cursor.fetchall():
            data = json.loads(row['data'])

            # Only include public conversations
            if data.get("is_public", False):
                # Get message count (handles both encrypted and unencrypted)
                if "messages" in data:
                    message_count = len(data["messages"])
                elif "messages_encrypted" in data:
                    # For encrypted data, we need to decrypt to count
                    # For performance, get the full conversation which will decrypt
                    profile_id = data.get("profile_id", DEFAULT_PROFILE_ID)
                    full_conv = get_conversation(data["id"], profile_id)
                    message_count = len(full_conv.get("messages", []))
                else:
                    message_count = 0

                public_conversations.append({
                    "id": data["id"],
                    "profile_id": data.get("profile_id", DEFAULT_PROFILE_ID),
                    "created_at": data["created_at"],
                    "published_at": data.get("published_at"),
                    "title": data.get("title", "New Conversation"),
                    "message_count": message_count,
                })

    # Sort by publication time, newest first (handle None values)
    public_conversations.sort(
        key=lambda x: x.get("published_at") or x.get("created_at") or "",
        reverse=True
    )

    return public_conversations


def list_conversations(profile_id: str = DEFAULT_PROFILE_ID, view: str = "private") -> List[Dict[str, Any]]:
    """
    List conversations with optional view filtering.

    Args:
        profile_id: Profile identifier
        view: View mode - "private" (user's own), "public" (all public), "all" (both)

    Returns:
        List of conversation metadata dicts
    """
    ensure_data_dir()

    if view == "public":
        # Return all public conversations across all profiles
        return list_public_conversations()

    # Get user's own conversations
    conversations = []

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM conversations WHERE profile_id = ? ORDER BY created_at DESC",
            (profile_id,)
        )

        for row in cursor.fetchall():
            data = json.loads(row['data'])

            # Get message count (handles both encrypted and unencrypted)
            if "messages" in data:
                message_count = len(data["messages"])
            elif "messages_encrypted" in data:
                # For encrypted data, we need to decrypt to count
                # But for performance, we can skip this and get the full conversation
                full_conv = get_conversation(data["id"], profile_id)
                message_count = len(full_conv.get("messages", []))
            else:
                message_count = 0

            # Return metadata only
            conversations.append({
                "id": data["id"],
                "profile_id": profile_id,
                "created_at": data["created_at"],
                "modified_at": data.get("modified_at", data["created_at"]),
                "title": data.get("title", "New Conversation"),
                "message_count": message_count,
                "is_loading": data.get("is_loading", False),
                "is_public": data.get("is_public", False),
                "sync_status": data.get("sync_status", "local"),
                "uses_byok": data.get("uses_byok", False)
            })

    if view == "all":
        # Merge user's conversations with all public conversations
        public_convs = list_public_conversations()

        # Create a set of conversation IDs we already have
        existing_ids = {c["id"] for c in conversations}

        # Add public conversations that aren't already in the list
        for pub_conv in public_convs:
            if pub_conv["id"] not in existing_ids:
                conversations.append(pub_conv)

        # Sort by creation time, newest first
        conversations.sort(key=lambda x: x["created_at"], reverse=True)

    return conversations


def add_user_message(conversation_id: str, content: str, profile_id: str = DEFAULT_PROFILE_ID):
    """
    Add a user message to a conversation.

    Args:
        conversation_id: Conversation identifier
        content: User message content
        profile_id: Profile identifier
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["messages"].append({
        "role": "user",
        "content": content
    })

    save_conversation(conversation)


def add_assistant_message(
    conversation_id: str,
    stage1: List[Dict[str, Any]],
    stage2: List[Dict[str, Any]],
    stage3: Dict[str, Any],
    metadata: Optional[Dict[str, Any]] = None,
    stage1_5: Optional[Dict[str, Any]] = None,
    profile_id: str = DEFAULT_PROFILE_ID
):
    """
    Add an assistant message with all stages to a conversation.

    Args:
        conversation_id: Conversation identifier
        stage1: List of individual model responses
        stage2: List of model rankings
        stage3: Final synthesized response
        metadata: Optional metadata (label_to_model, aggregate_rankings)
        stage1_5: Optional interrogation round data (questions and answers)
        profile_id: Profile identifier
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    message = {
        "role": "assistant",
        "stage1": stage1,
        "stage2": stage2,
        "stage3": stage3
    }

    # Add stage1_5 if provided
    if stage1_5:
        message["stage1_5"] = stage1_5

    # Add metadata if provided
    if metadata:
        message["metadata"] = metadata

    conversation["messages"].append(message)

    save_conversation(conversation)


def remove_last_assistant_message(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID):
    """
    Remove the last assistant message from a conversation (used for retry).

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    messages = conversation["messages"]
    if messages and messages[-1].get("role") == "assistant":
        messages.pop()
        save_conversation(conversation)
        print(f"[INFO] Removed last assistant message for retry in conversation {conversation_id}")


def set_stream_metadata(
    conversation_id: str,
    stream_id: str,
    connection_token: str,
    last_stage: str,
    profile_id: str = DEFAULT_PROFILE_ID
):
    """
    Store stream metadata for resumption purposes.

    Args:
        conversation_id: Conversation identifier
        stream_id: Unique identifier for this stream
        connection_token: Token for validating resume requests
        last_stage: Last completed stage (stage1, stage1_5, stage2, stage3)
        profile_id: Profile identifier
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    if "stream_metadata" not in conversation:
        conversation["stream_metadata"] = {}

    conversation["stream_metadata"] = {
        "stream_id": stream_id,
        "connection_token": connection_token,
        "last_stage": last_stage,
        "updated_at": datetime.utcnow().isoformat()
    }

    save_conversation(conversation)


def clear_stream_metadata(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID):
    """
    Clear stream metadata after successful completion or expiry.

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        return

    if "stream_metadata" in conversation:
        del conversation["stream_metadata"]
        save_conversation(conversation)


def save_partial_assistant_message(
    conversation_id: str,
    stage_name: str,
    stage_data: Any,
    metadata: Optional[Dict[str, Any]] = None,
    profile_id: str = DEFAULT_PROFILE_ID,
    stream_id: Optional[str] = None,
    connection_token: Optional[str] = None
):
    """
    Save or update partial assistant message after each stage completes.
    Enables resume-from-checkpoint on reconnection.

    Args:
        conversation_id: Conversation identifier
        stage_name: Name of stage ("stage1", "stage1_5", "stage2", "stage3")
        stage_data: Data for this stage
        metadata: Optional metadata to update
        profile_id: Profile identifier
        stream_id: Optional stream identifier for resume tracking
        connection_token: Optional connection token for resume validation
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    messages = conversation["messages"]
    if not messages:
        raise ValueError(f"No messages in conversation {conversation_id}")

    last_message = messages[-1]

    # If last message is user message, create new partial assistant message
    if last_message.get("role") == "user":
        partial_message = {
            "role": "assistant",
            "stage1": None,
            "stage1_5": None,
            "stage2": None,
            "stage3": None,
            "partial": True  # Mark as partial/incomplete
        }
        messages.append(partial_message)
        last_message = partial_message
    elif last_message.get("role") == "assistant":
        # Update existing assistant message (resume scenario)
        # This handles stream resumption after network drops
        print(f"[INFO] Updating existing assistant message for conversation {conversation_id}")

    # Update the stage data
    if last_message.get("role") == "assistant":
        last_message[stage_name] = stage_data

        # Update metadata if provided
        if metadata:
            if "metadata" not in last_message:
                last_message["metadata"] = {}
            last_message["metadata"].update(metadata)

        # If stage3 is complete, mark as complete (remove partial flag)
        if stage_name == "stage3":
            last_message.pop("partial", None)

    # Update stream metadata for resume capability
    if stream_id and connection_token:
        set_stream_metadata(conversation_id, stream_id, connection_token, stage_name, profile_id)

    # Clear stream metadata if stage3 is complete
    if stage_name == "stage3":
        clear_stream_metadata(conversation_id, profile_id)

    save_conversation(conversation)
    print(f"[INFO] Saved partial state for conversation {conversation_id}, {stage_name}")


def update_conversation_title(conversation_id: str, title: str, profile_id: str = DEFAULT_PROFILE_ID):
    """
    Update the title of a conversation.

    Args:
        conversation_id: Conversation identifier
        title: New title for the conversation
        profile_id: Profile identifier
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["title"] = title
    save_conversation(conversation)


def update_conversation_models(
    conversation_id: str,
    council_models: Optional[List[str]] = None,
    chairman_model: Optional[str] = None,
    workflow_json: Optional[str] = None,
    profile_id: str = DEFAULT_PROFILE_ID
):
    """
    Update the model configuration for a conversation (only allowed before first message).

    Args:
        conversation_id: Conversation identifier
        council_models: List of model identifiers for council (optional if workflow_json provided)
        chairman_model: Model identifier for chairman (optional if workflow_json provided)
        workflow_json: Optional workflow DSL JSON string (overrides council config if provided)
        profile_id: Profile identifier
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    # Update council models if provided
    if council_models is not None:
        conversation["council_models"] = council_models
    if chairman_model is not None:
        conversation["chairman_model"] = chairman_model

    # Update workflow_json (can be None to clear it, or a JSON string to set it)
    if workflow_json is not None:
        conversation["workflow_json"] = workflow_json

    save_conversation(conversation)


def set_conversation_loading(conversation_id: str, is_loading: bool, profile_id: str = DEFAULT_PROFILE_ID):
    """
    Set the loading state for a conversation.

    Args:
        conversation_id: Conversation identifier
        is_loading: Whether the conversation is currently loading
        profile_id: Profile identifier
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["is_loading"] = is_loading
    save_conversation(conversation)


def get_stream_metadata(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> Optional[Dict[str, Any]]:
    """
    Retrieve stream metadata for a conversation.

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier

    Returns:
        Stream metadata dict or None if not found
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        return None

    return conversation.get("stream_metadata")


def get_conversation_loading(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> bool:
    """
    Get the loading state for a conversation.

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier

    Returns:
        True if conversation is loading, False otherwise
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        return False

    return conversation.get("is_loading", False)


def delete_conversation(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> bool:
    """
    Delete a conversation.

    Args:
        conversation_id: Conversation identifier
        profile_id: Profile identifier

    Returns:
        True if deleted, False if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM conversations WHERE id = ? AND profile_id = ?",
            (conversation_id, profile_id)
        )
        conn.commit()
        return cursor.rowcount > 0