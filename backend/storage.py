"""JSON-based storage for conversations with encryption support."""

import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from .config import DATA_DIR, PROFILES_FILE, DEFAULT_PROFILE_ID, ENCRYPTION_ENABLED, ENCRYPTION_KEY, WAITLIST_FILE, INVITES_FILE
from .encryption import (
    FernetProvider,
    encrypt_data,
    decrypt_data,
    create_encryption_metadata,
    is_encrypted
)


def ensure_data_dir():
    """Ensure the data directory exists."""
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)


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


def ensure_profiles_file():
    """Ensure the profiles file exists."""
    Path(PROFILES_FILE).parent.mkdir(parents=True, exist_ok=True)
    if not os.path.exists(PROFILES_FILE):
        # Create default profile
        profiles = {
            DEFAULT_PROFILE_ID: {
                "id": DEFAULT_PROFILE_ID,
                "name": "Default Profile",
                "created_at": datetime.utcnow().isoformat(),
                "settings": {}
            }
        }
        with open(PROFILES_FILE, 'w') as f:
            json.dump(profiles, f, indent=2)


def get_profile_dir(profile_id: str) -> str:
    """Get the directory for a profile's conversations."""
    return os.path.join(DATA_DIR, f"profile_{profile_id}")


def get_conversation_path(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID) -> str:
    """Get the file path for a conversation."""
    profile_dir = get_profile_dir(profile_id)
    Path(profile_dir).mkdir(parents=True, exist_ok=True)
    return os.path.join(profile_dir, f"{conversation_id}.json")


def create_conversation(conversation_id: str, profile_id: str = DEFAULT_PROFILE_ID, uses_byok: bool = False) -> Dict[str, Any]:
    """
    Create a new conversation.

    Args:
        conversation_id: Unique identifier for the conversation
        profile_id: Profile identifier
        uses_byok: Whether the conversation uses bring-your-own-key

    Returns:
        New conversation dict
    """
    ensure_data_dir()

    conversation = {
        "id": conversation_id,
        "profile_id": profile_id,
        "created_at": datetime.utcnow().isoformat(),
        "title": "New Conversation",
        "messages": [],
        "is_public": not uses_byok,  # Default: public unless BYOK
        "published_at": None,
        "sync_status": "local",  # local, syncing, synced
        "uses_byok": uses_byok
    }

    # Save to file (only if public in production, always in local mode)
    path = get_conversation_path(conversation_id, profile_id)
    with open(path, 'w') as f:
        json.dump(conversation, f, indent=2)

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
    path = get_conversation_path(conversation_id, profile_id)

    if not os.path.exists(path):
        return None

    with open(path, 'r') as f:
        data = json.load(f)

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

    path = get_conversation_path(conversation['id'], profile_id)
    with open(path, 'w') as f:
        json.dump(data_to_save, f, indent=2)


def list_conversations(profile_id: str = DEFAULT_PROFILE_ID) -> List[Dict[str, Any]]:
    """
    List all conversations for a profile (metadata only).

    Args:
        profile_id: Profile identifier

    Returns:
        List of conversation metadata dicts
    """
    ensure_data_dir()

    conversations = []
    profile_dir = get_profile_dir(profile_id)

    if not os.path.exists(profile_dir):
        return conversations

    for filename in os.listdir(profile_dir):
        if filename.endswith('.json'):
            path = os.path.join(profile_dir, filename)
            with open(path, 'r') as f:
                data = json.load(f)

                # Get message count (handles both encrypted and unencrypted)
                if "messages" in data:
                    message_count = len(data["messages"])
                elif "messages_encrypted" in data:
                    # For encrypted data, we need to decrypt to count
                    # But for performance, we can skip this and show "?" or fetch full conversation
                    # For now, we'll get the full conversation which will decrypt
                    full_conv = get_conversation(data["id"], profile_id)
                    message_count = len(full_conv.get("messages", []))
                else:
                    message_count = 0

                # Return metadata only
                conversations.append({
                    "id": data["id"],
                    "created_at": data["created_at"],
                    "title": data.get("title", "New Conversation"),
                    "message_count": message_count,
                    "is_loading": data.get("is_loading", False),
                    "is_public": data.get("is_public", False),
                    "sync_status": data.get("sync_status", "local"),
                    "uses_byok": data.get("uses_byok", False)
                })

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
    path = get_conversation_path(conversation_id, profile_id)

    if not os.path.exists(path):
        return False

    os.remove(path)
    return True


# Profile management functions

def list_profiles() -> List[Dict[str, Any]]:
    """
    List all profiles.

    Returns:
        List of profile dicts
    """
    ensure_profiles_file()

    with open(PROFILES_FILE, 'r') as f:
        profiles = json.load(f)

    return list(profiles.values())


def get_profile(profile_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific profile.

    Args:
        profile_id: Profile identifier

    Returns:
        Profile dict or None if not found
    """
    ensure_profiles_file()

    with open(PROFILES_FILE, 'r') as f:
        profiles = json.load(f)

    return profiles.get(profile_id)


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
    ensure_profiles_file()

    with open(PROFILES_FILE, 'r') as f:
        profiles = json.load(f)

    if profile_id in profiles:
        raise ValueError(f"Profile {profile_id} already exists")

    profile = {
        "id": profile_id,
        "name": name,
        "created_at": datetime.utcnow().isoformat(),
        "settings": settings or {}
    }

    profiles[profile_id] = profile

    with open(PROFILES_FILE, 'w') as f:
        json.dump(profiles, f, indent=2)

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
    ensure_profiles_file()

    with open(PROFILES_FILE, 'r') as f:
        profiles = json.load(f)

    if profile_id not in profiles:
        raise ValueError(f"Profile {profile_id} not found")

    profile = profiles[profile_id]

    if name is not None:
        profile["name"] = name

    if settings is not None:
        profile["settings"] = settings

    profiles[profile_id] = profile

    with open(PROFILES_FILE, 'w') as f:
        json.dump(profiles, f, indent=2)

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

    ensure_profiles_file()

    with open(PROFILES_FILE, 'r') as f:
        profiles = json.load(f)

    if profile_id not in profiles:
        return False

    del profiles[profile_id]

    with open(PROFILES_FILE, 'w') as f:
        json.dump(profiles, f, indent=2)

    return True


# Publish/unpublish functions

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


def list_public_conversations() -> List[Dict[str, Any]]:
    """
    List all public conversations across all profiles.

    Returns:
        List of public conversation metadata dicts
    """
    ensure_data_dir()

    public_conversations = []

    # Iterate through all profile directories
    if not os.path.exists(DATA_DIR):
        return public_conversations

    for dirname in os.listdir(DATA_DIR):
        if dirname.startswith("profile_"):
            profile_dir = os.path.join(DATA_DIR, dirname)
            if not os.path.isdir(profile_dir):
                continue

            for filename in os.listdir(profile_dir):
                if filename.endswith('.json'):
                    path = os.path.join(profile_dir, filename)
                    with open(path, 'r') as f:
                        data = json.load(f)

                        # Only include public conversations
                        if data.get("is_public", False):
                            public_conversations.append({
                                "id": data["id"],
                                "profile_id": data.get("profile_id", DEFAULT_PROFILE_ID),
                                "created_at": data["created_at"],
                                "published_at": data.get("published_at"),
                                "title": data.get("title", "New Conversation"),
                                "message_count": len(data["messages"]),
                            })

    # Sort by publication time, newest first
    public_conversations.sort(key=lambda x: x.get("published_at", x["created_at"]), reverse=True)

    return public_conversations


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

    # Check if already encrypted
    path = get_conversation_path(conversation_id, profile_id)
    with open(path, 'r') as f:
        raw_data = json.load(f)

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
    with open(path, 'w') as f:
        json.dump(data_to_save, f, indent=2)

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
    path = get_conversation_path(conversation_id, profile_id)
    with open(path, 'r') as f:
        raw_data = json.load(f)

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
    with open(path, 'w') as f:
        json.dump(data_to_save, f, indent=2)

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
    path = get_conversation_path(conversation_id, profile_id)

    if not os.path.exists(path):
        raise ValueError(f"Conversation {conversation_id} not found")

    with open(path, 'r') as f:
        data = json.load(f)

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


# Waitlist management functions

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


# Invite token management functions

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
