"""Authentication middleware for FastAPI."""

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

from backend.storage import profiles
from backend.auth import verify_access_token, get_user_by_id
from backend.config import ENVIRONMENT


security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    required: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Get current user from JWT token (access token OR connection token).

    Returns None if no token or invalid token in local mode (when required=False).
    Raises 401 in production mode or when required=True.

    Args:
        credentials: Bearer token from Authorization header
        required: If True, always raise 401 on auth failure

    Returns:
        User data dict or None (when required=False and auth fails)
    """
    if not credentials:
        if ENVIRONMENT == "production" or required:
            raise HTTPException(status_code=401, detail="Authentication required")
        return None

    token = credentials.credentials

    # Try connection token first (for streaming sessions)
    from backend.auth import verify_connection_token
    connection_payload = verify_connection_token(token)
    if connection_payload:
        # Valid connection token
        user_id = connection_payload.get("sub")
        user = get_user_by_id(user_id)

        if not user:
            if ENVIRONMENT == "production" or required:
                raise HTTPException(status_code=401, detail="User not found")
            return None

        return {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "profile_id": user.get("default_profile_id"),  # Connection tokens use default profile
            "default_profile_id": user["default_profile_id"]
        }

    # Fall back to access token validation
    payload = verify_access_token(token)

    if not payload:
        if ENVIRONMENT == "production" or required:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return None

    user_id = payload.get("sub")
    user = get_user_by_id(user_id)

    if not user:
        if ENVIRONMENT == "production" or required:
            raise HTTPException(status_code=401, detail="User not found")
        return None

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "profile_id": payload.get("profile_id"),
        "default_profile_id": user["default_profile_id"]
    }


async def ensure_user_logged_in(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    Get current user from JWT token (required in production, optional in local).

    In production mode: Always raises 401 if no token or invalid token.
    In local mode: Returns a default user if no authentication provided.

    Args:
        credentials: Bearer token from Authorization header

    Returns:
        User data dict

    Raises:
        HTTPException: 401 if authentication fails (production mode only)
    """
    # In local mode without credentials, return a default user
    if ENVIRONMENT == "local" and not credentials:
        from backend.config import DEFAULT_PROFILE_ID
        return {
            "id": "default",
            "email": "local@localhost",
            "name": "Local User",
            "profile_id": DEFAULT_PROFILE_ID,
            "default_profile_id": DEFAULT_PROFILE_ID
        }

    return await get_current_user_optional(credentials=credentials, required=True)


def user_has_profile_access(user_id: str, profile_id: str) -> bool:
    """
    Check if a user has access to a specific profile.

    Args:
        user_id: User identifier
        profile_id: Profile identifier

    Returns:
        True if user has access, False otherwise
    """
    from backend import auth as auth_module

    # Get user data
    user = auth_module.get_user_by_id(user_id)
    if not user:
        return False

    # User always has access to their default profile
    if profile_id == user.get("default_profile_id"):
        return True

    # Get profile data
    profile = profiles.get_profile(profile_id)
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
