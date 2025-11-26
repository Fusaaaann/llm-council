"""Authentication middleware for FastAPI."""

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from .auth import verify_access_token, get_user_by_id
from .config import ENVIRONMENT


security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """
    Get current user from JWT token (optional).

    Returns None if no token or invalid token in local mode.
    Raises 401 in production mode.

    Args:
        credentials: Bearer token from Authorization header

    Returns:
        User data dict or None
    """
    if not credentials:
        if ENVIRONMENT == "production":
            raise HTTPException(status_code=401, detail="Authentication required")
        return None

    token = credentials.credentials
    payload = verify_access_token(token)

    if not payload:
        if ENVIRONMENT == "production":
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return None

    user_id = payload.get("sub")
    user = get_user_by_id(user_id)

    if not user:
        if ENVIRONMENT == "production":
            raise HTTPException(status_code=401, detail="User not found")
        return None

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "profile_id": payload.get("profile_id"),
        "default_profile_id": user["default_profile_id"]
    }


async def get_current_user_required(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Get current user from JWT token (required).

    Always raises 401 if no token or invalid token.

    Args:
        credentials: Bearer token from Authorization header

    Returns:
        User data dict

    Raises:
        HTTPException: 401 if authentication fails
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")

    token = credentials.credentials
    payload = verify_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    user = get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "profile_id": payload.get("profile_id"),
        "default_profile_id": user["default_profile_id"]
    }


def user_has_profile_access(user_id: str, profile_id: str) -> bool:
    """
    Check if a user has access to a specific profile.

    Args:
        user_id: User identifier
        profile_id: Profile identifier

    Returns:
        True if user has access, False otherwise
    """
    from . import storage, auth as auth_module

    # Get user data
    user = auth_module.get_user_by_id(user_id)
    if not user:
        return False

    # User always has access to their default profile
    if profile_id == user.get("default_profile_id"):
        return True

    # Get profile data
    profile = storage.get_profile(profile_id)
    if not profile:
        return False

    # Check if profile belongs to user (profile IDs are formatted as profile_{user_id})
    # This is the current simple ownership model
    if profile_id.startswith("profile_"):
        owner_id = profile_id.replace("profile_", "")
        return owner_id == user_id

    # For profiles without owner prefix, deny access (security fail-closed)
    return False


def get_profile_id_for_request(
    user: Optional[Dict[str, Any]],
    query_profile_id: Optional[str] = None
) -> str:
    """
    Determine profile_id for a request with access control.

    Logic:
    - If user authenticated: use query param if provided (with validation), else user's default profile
    - If no user (local mode): use query param or 'default'

    Args:
        user: Current user dict or None
        query_profile_id: Profile ID from query parameter

    Returns:
        Profile identifier to use

    Raises:
        HTTPException: 403 if user tries to access unauthorized profile
    """
    if user:
        # Authenticated user
        if query_profile_id:
            # Verify user has access to this profile
            if not user_has_profile_access(user["id"], query_profile_id):
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied to profile {query_profile_id}"
                )
            return query_profile_id
        return user["default_profile_id"]
    else:
        # Local mode without auth
        return query_profile_id or "default"
