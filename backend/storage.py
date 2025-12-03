"""SQLite-based storage for conversations with encryption support.

This module is 100% API-compatible with storage.py but uses SQLite instead of JSON files.
Conversations and profiles are stored in data/data.sqlite, while waitlist/invites remain in JSON.
"""

import json
import os
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from contextlib import contextmanager
from .config import DATA_DIR, DEFAULT_PROFILE_ID, ENCRYPTION_ENABLED, ENCRYPTION_KEY, WAITLIST_FILE, INVITES_FILE
from .encryption import (
    FernetProvider,
    encrypt_data,
    decrypt_data,
    create_encryption_metadata,
    is_encrypted
)

# Database path
DB_PATH = "data/data.sqlite"


@contextmanager
def get_db_connection():
    """Get a thread-safe database connection with context manager."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
    finally:
        conn.close()


def init_database():
    """Initialize the database schema if it doesn't exist."""
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Conversations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                modified_at TEXT,
                title TEXT,
                is_public BOOLEAN DEFAULT 0,
                uses_byok BOOLEAN DEFAULT 0,
                data TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversations_profile_id
            ON conversations(profile_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversations_created_at
            ON conversations(created_at)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversations_is_public
            ON conversations(is_public)
        """)

        # Profiles table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                data TEXT NOT NULL
            )
        """)

        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                data TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users(email)
        """)

        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT,
                created_at TEXT NOT NULL,
                expires_at TEXT,
                data TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id
            ON sessions(user_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
            ON sessions(expires_at)
        """)

        conn.commit()

        # Create default profile if it doesn't exist
        cursor.execute("SELECT id FROM profiles WHERE id = ?", (DEFAULT_PROFILE_ID,))
        if not cursor.fetchone():
            default_profile = {
                "id": DEFAULT_PROFILE_ID,
                "name": "Default Profile",
                "created_at": datetime.utcnow().isoformat(),
                "settings": {}
            }
            cursor.execute(
                "INSERT INTO profiles (id, name, created_at, data) VALUES (?, ?, ?, ?)",
                (DEFAULT_PROFILE_ID, "Default Profile", default_profile["created_at"], json.dumps(default_profile))
            )
            conn.commit()


def ensure_data_dir():
    """Ensure the data directory exists."""
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    init_database()


def get_encryption_provider() -> Optional[FernetProvider]:
    """
    Get encryption provider if encryption is enabled.

    Returns:
        FernetProvider instance or None if encryption disabled
    """
    if not ENCRYPTION_ENABLED:
        return None

    if not ENCRYPTION_KEY:
        raise ValueError("ENCRYPTION_KEY not configured but encryption is enabled")

    return FernetProvider(ENCRYPTION_KEY.encode('utf-8'))


# ============================================================================
# CONVERSATION FUNCTIONS
# ============================================================================

def create_conversation(
    conversation_id: str,
    profile_id: str = DEFAULT_PROFILE_ID,
    uses_byok: bool = False,
    council_models: Optional[List[str]] = None,
    chairman_model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new conversation.

    Args:
        conversation_id: Unique identifier for the conversation
        profile_id: Profile identifier
        uses_byok: Whether the conversation uses bring-your-own-key
        council_models: List of model identifiers for council (defaults to config.COUNCIL_MODELS)
        chairman_model: Model identifier for chairman (defaults to config.CHAIRMAN_MODEL)

    Returns:
        New conversation dict
    """
    ensure_data_dir()

    # Import here to avoid circular dependency
    from .config import COUNCIL_MODELS, CHAIRMAN_MODEL

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
        "chairman_model": chairman_model if chairman_model is not None else CHAIRMAN_MODEL
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
    council_models: List[str],
    chairman_model: str,
    profile_id: str = DEFAULT_PROFILE_ID
):
    """
    Update the model configuration for a conversation (only allowed before first message).

    Args:
        conversation_id: Conversation identifier
        council_models: List of model identifiers for council
        chairman_model: Model identifier for chairman
        profile_id: Profile identifier
    """
    conversation = get_conversation(conversation_id, profile_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["council_models"] = council_models
    conversation["chairman_model"] = chairman_model
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


# ============================================================================
# PROFILE FUNCTIONS
# ============================================================================

def list_profiles() -> List[Dict[str, Any]]:
    """
    List all profiles.

    Returns:
        List of profile dicts
    """
    ensure_data_dir()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM profiles")
        return [json.loads(row['data']) for row in cursor.fetchall()]


def get_profile(profile_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific profile.

    Args:
        profile_id: Profile identifier

    Returns:
        Profile dict or None if not found
    """
    ensure_data_dir()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM profiles WHERE id = ?", (profile_id,))
        row = cursor.fetchone()
        return json.loads(row['data']) if row else None


def create_profile(profile_id: str, name: str, settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create a new profile.

    Args:
        profile_id: Unique identifier for the profile
        name: Profile name
        settings: Optional profile settings

    Returns:
        New profile dict
    """
    ensure_data_dir()

    # Check if profile already exists
    if get_profile(profile_id) is not None:
        raise ValueError(f"Profile {profile_id} already exists")

    profile = {
        "id": profile_id,
        "name": name,
        "created_at": datetime.utcnow().isoformat(),
        "settings": settings or {}
    }

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO profiles (id, name, created_at, data) VALUES (?, ?, ?, ?)",
            (profile_id, name, profile["created_at"], json.dumps(profile))
        )
        conn.commit()

    return profile


def update_profile(profile_id: str, name: Optional[str] = None, settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Update a profile.

    Args:
        profile_id: Profile identifier
        name: New profile name (optional)
        settings: New profile settings (optional)

    Returns:
        Updated profile dict
    """
    ensure_data_dir()

    profile = get_profile(profile_id)
    if profile is None:
        raise ValueError(f"Profile {profile_id} not found")

    if name is not None:
        profile["name"] = name

    if settings is not None:
        profile["settings"] = settings

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE profiles SET name = ?, data = ? WHERE id = ?",
            (profile["name"], json.dumps(profile), profile_id)
        )
        conn.commit()

    return profile


def delete_profile(profile_id: str) -> bool:
    """
    Delete a profile.

    Args:
        profile_id: Profile identifier

    Returns:
        True if deleted, False if not found
    """
    if profile_id == DEFAULT_PROFILE_ID:
        raise ValueError("Cannot delete default profile")

    ensure_data_dir()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        conn.commit()
        return cursor.rowcount > 0


# ============================================================================
# PUBLISH/UNPUBLISH FUNCTIONS
# ============================================================================

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


# ============================================================================
# ENCRYPTION FUNCTIONS
# ============================================================================

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


# ============================================================================
# WAITLIST FUNCTIONS (Keep JSON-based - readability for admin)
# ============================================================================

def ensure_waitlist_file():
    """Ensure the waitlist file exists."""
    Path(WAITLIST_FILE).parent.mkdir(parents=True, exist_ok=True)
    if not os.path.exists(WAITLIST_FILE):
        with open(WAITLIST_FILE, 'w') as f:
            json.dump([], f, indent=2)


def add_to_waitlist(email: str, name: Optional[str] = None, notes: Optional[str] = None) -> Dict[str, Any]:
    """
    Add an email to the waitlist.

    Args:
        email: Email address
        name: Optional name
        notes: Optional notes

    Returns:
        Waitlist entry dict
    """
    ensure_waitlist_file()

    with open(WAITLIST_FILE, 'r') as f:
        waitlist = json.load(f)

    # Check if email already exists
    for entry in waitlist:
        if entry["email"] == email:
            raise ValueError(f"Email {email} already on waitlist")

    entry = {
        "email": email,
        "name": name,
        "notes": notes,
        "submitted_at": datetime.utcnow().isoformat(),
        "invited": False,
        "invited_at": None
    }

    waitlist.append(entry)

    with open(WAITLIST_FILE, 'w') as f:
        json.dump(waitlist, f, indent=2)

    return entry


def list_waitlist(invited: Optional[bool] = None) -> List[Dict[str, Any]]:
    """
    List all waitlist entries.

    Args:
        invited: Filter by invited status (None = all, True = invited only, False = not invited)

    Returns:
        List of waitlist entries
    """
    ensure_waitlist_file()

    with open(WAITLIST_FILE, 'r') as f:
        waitlist = json.load(f)

    if invited is not None:
        waitlist = [e for e in waitlist if e["invited"] == invited]

    # Sort by submission time, oldest first
    waitlist.sort(key=lambda x: x["submitted_at"])

    return waitlist


def mark_waitlist_invited(email: str) -> Dict[str, Any]:
    """
    Mark a waitlist entry as invited.

    Args:
        email: Email address

    Returns:
        Updated waitlist entry

    Raises:
        ValueError: If email not found
    """
    ensure_waitlist_file()

    with open(WAITLIST_FILE, 'r') as f:
        waitlist = json.load(f)

    for entry in waitlist:
        if entry["email"] == email:
            entry["invited"] = True
            entry["invited_at"] = datetime.utcnow().isoformat()

            with open(WAITLIST_FILE, 'w') as f:
                json.dump(waitlist, f, indent=2)

            return entry

    raise ValueError(f"Email {email} not found in waitlist")


# ============================================================================
# INVITE TOKEN FUNCTIONS (Keep JSON-based - readability for admin)
# ============================================================================

def ensure_invites_file():
    """Ensure the invites file exists."""
    Path(INVITES_FILE).parent.mkdir(parents=True, exist_ok=True)
    if not os.path.exists(INVITES_FILE):
        with open(INVITES_FILE, 'w') as f:
            json.dump({}, f, indent=2)


def load_invites() -> Dict[str, Any]:
    """Load invites from file, decrypting if necessary."""
    ensure_invites_file()
    with open(INVITES_FILE, 'r') as f:
        data = json.load(f)

    # Check if data is encrypted
    if isinstance(data, dict) and is_encrypted(data):
        provider = get_encryption_provider()
        if provider is None:
            raise ValueError("Encrypted invites file found but encryption is disabled")

        # Decrypt invites data
        if "data_encrypted" in data:
            try:
                return decrypt_data(data["data_encrypted"], provider)
            except ValueError as e:
                raise ValueError(f"Failed to decrypt invites file: {e}")

    return data


def save_invites(invites: Dict[str, Any]):
    """Save invites to file, encrypting if enabled."""
    ensure_invites_file()

    provider = get_encryption_provider()
    if provider is not None:
        # Encrypt the invites data
        data_to_save = {
            "_encryption": create_encryption_metadata(provider),
            "data_encrypted": encrypt_data(invites, provider)
        }
    else:
        data_to_save = invites

    with open(INVITES_FILE, 'w') as f:
        json.dump(data_to_save, f, indent=2)


def create_invite_token(token: str, email: Optional[str] = None, expires_at: Optional[str] = None, notes: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new invite token.

    Args:
        token: Unique invite token
        email: Optional email this invite is for
        expires_at: Optional expiration timestamp
        notes: Optional notes

    Returns:
        Invite dict

    Raises:
        ValueError: If token already exists
    """
    invites = load_invites()

    if token in invites:
        raise ValueError(f"Invite token {token} already exists")

    invite = {
        "token": token,
        "email": email,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": expires_at,
        "used": False,
        "used_at": None,
        "used_by": None,
        "notes": notes
    }

    invites[token] = invite
    save_invites(invites)

    return invite


def get_invite_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Get an invite token.

    Args:
        token: Invite token

    Returns:
        Invite dict or None if not found
    """
    invites = load_invites()
    return invites.get(token)


def validate_invite_token(token: str) -> tuple[bool, Optional[str]]:
    """
    Validate an invite token.

    Args:
        token: Invite token

    Returns:
        Tuple of (is_valid, error_message)
    """
    invite = get_invite_token(token)

    if invite is None:
        return False, "Invalid invite token"

    if invite["used"]:
        return False, "Invite token already used"

    if invite["expires_at"]:
        expires_at = datetime.fromisoformat(invite["expires_at"])
        if datetime.utcnow() > expires_at:
            return False, "Invite token expired"

    return True, None


def mark_invite_used(token: str, email: str) -> Dict[str, Any]:
    """
    Mark an invite token as used.

    Args:
        token: Invite token
        email: Email that used the invite

    Returns:
        Updated invite dict

    Raises:
        ValueError: If token not found
    """
    invites = load_invites()

    if token not in invites:
        raise ValueError(f"Invite token {token} not found")

    invite = invites[token]
    invite["used"] = True
    invite["used_at"] = datetime.utcnow().isoformat()
    invite["used_by"] = email

    invites[token] = invite
    save_invites(invites)

    return invite


def list_invite_tokens(used: Optional[bool] = None) -> List[Dict[str, Any]]:
    """
    List all invite tokens.

    Args:
        used: Filter by used status (None = all, True = used only, False = unused only)

    Returns:
        List of invite dicts
    """
    invites = load_invites()
    result = list(invites.values())

    if used is not None:
        result = [i for i in result if i["used"] == used]

    # Sort by creation time, newest first
    result.sort(key=lambda x: x["created_at"], reverse=True)

    return result
