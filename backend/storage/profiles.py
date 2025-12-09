# ============================================================================
# PROFILE FUNCTIONS
# ============================================================================

from datetime import datetime
from backend.config import DEFAULT_PROFILE_ID
from backend.storage.database import ensure_data_dir, get_db_connection


import json
from typing import Any, Dict, List, Optional


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