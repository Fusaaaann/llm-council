# ============================================================================
# WAITLIST FUNCTIONS (Keep JSON-based - readability for admin)
# ============================================================================

from datetime import datetime
from typing import Any, Dict, List, Optional
from backend.config import INVITES_FILE, WAITLIST_FILE


import json
import os
from pathlib import Path

from backend.encryption import create_encryption_metadata, decrypt_data, encrypt_data, get_encryption_provider, is_encrypted


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