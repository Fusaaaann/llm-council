"""Authentication and session management."""

import os
import json
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path
import jwt
from passlib.hash import bcrypt
from .encryption import FernetProvider, encrypt_data, decrypt_data, create_encryption_metadata, is_encrypted
from .config import ENCRYPTION_ENABLED, ENCRYPTION_KEY

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Storage paths
USERS_FILE = "data/users.json"
SESSIONS_FILE = "data/sessions.json"


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


def ensure_auth_files():
    """Ensure authentication data files exist."""
    Path("data").mkdir(parents=True, exist_ok=True)

    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w') as f:
            json.dump({}, f, indent=2)

    if not os.path.exists(SESSIONS_FILE):
        with open(SESSIONS_FILE, 'w') as f:
            json.dump({}, f, indent=2)


def load_users() -> Dict[str, Any]:
    """Load users from file, decrypting if necessary."""
    ensure_auth_files()
    with open(USERS_FILE, 'r') as f:
        data = json.load(f)

    # Check if data is encrypted
    if isinstance(data, dict) and is_encrypted(data):
        provider = get_encryption_provider()
        if provider is None:
            raise ValueError("Encrypted users file found but encryption is disabled")

        # Decrypt users data
        if "data_encrypted" in data:
            try:
                return decrypt_data(data["data_encrypted"], provider)
            except ValueError as e:
                raise ValueError(f"Failed to decrypt users file: {e}")

    return data


def save_users(users: Dict[str, Any]):
    """Save users to file, encrypting if enabled."""
    ensure_auth_files()

    provider = get_encryption_provider()
    if provider is not None:
        # Encrypt the users data
        data_to_save = {
            "_encryption": create_encryption_metadata(provider),
            "data_encrypted": encrypt_data(users, provider)
        }
    else:
        data_to_save = users

    with open(USERS_FILE, 'w') as f:
        json.dump(data_to_save, f, indent=2)


def load_sessions() -> Dict[str, Any]:
    """Load sessions from file, decrypting if necessary."""
    ensure_auth_files()
    with open(SESSIONS_FILE, 'r') as f:
        data = json.load(f)

    # Check if data is encrypted
    if isinstance(data, dict) and is_encrypted(data):
        provider = get_encryption_provider()
        if provider is None:
            raise ValueError("Encrypted sessions file found but encryption is disabled")

        # Decrypt sessions data
        if "data_encrypted" in data:
            try:
                return decrypt_data(data["data_encrypted"], provider)
            except ValueError as e:
                raise ValueError(f"Failed to decrypt sessions file: {e}")

    return data


def save_sessions(sessions: Dict[str, Any]):
    """Save sessions to file, encrypting if enabled."""
    ensure_auth_files()

    provider = get_encryption_provider()
    if provider is not None:
        # Encrypt the sessions data
        data_to_save = {
            "_encryption": create_encryption_metadata(provider),
            "data_encrypted": encrypt_data(sessions, provider)
        }
    else:
        data_to_save = sessions

    with open(SESSIONS_FILE, 'w') as f:
        json.dump(data_to_save, f, indent=2)


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Truncates password to 72 bytes (bcrypt's maximum length) before hashing.
    """
    # Bcrypt has a 72-byte limit, truncate password if necessary
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt.hash(password_bytes.decode('utf-8', errors='ignore'))


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a password against its hash.

    Truncates password to 72 bytes (bcrypt's maximum length) before verification.
    """
    # Bcrypt has a 72-byte limit, truncate password if necessary
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt.verify(password_bytes.decode('utf-8', errors='ignore'), hashed)


def generate_user_id() -> str:
    """Generate a unique user ID."""
    return secrets.token_urlsafe(16)


def generate_refresh_token() -> str:
    """Generate a secure refresh token."""
    return secrets.token_urlsafe(32)


def create_access_token(user_id: str, profile_id: str) -> str:
    """
    Create a JWT access token.

    Args:
        user_id: User identifier
        profile_id: Default profile identifier for the user

    Returns:
        JWT token string
    """
    expires = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "profile_id": profile_id,
        "exp": expires,
        "iat": datetime.utcnow(),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token_record(user_id: str, profile_id: str) -> Dict[str, str]:
    """
    Create a refresh token and store it.

    Args:
        user_id: User identifier
        profile_id: Default profile identifier

    Returns:
        Dict with token and expiry
    """
    token = generate_refresh_token()
    expires = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    sessions = load_sessions()
    sessions[token] = {
        "user_id": user_id,
        "profile_id": profile_id,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": expires.isoformat()
    }
    save_sessions(sessions)

    return {
        "token": token,
        "expires_at": expires.isoformat()
    }


def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode an access token.

    Args:
        token: JWT token string

    Returns:
        Decoded payload or None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def verify_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify a refresh token.

    Args:
        token: Refresh token string

    Returns:
        Session data or None if invalid
    """
    import logging
    logger = logging.getLogger(__name__)

    token_preview = token[:20] + "..." if len(token) > 20 else token
    logger.info(f"[AUTH] Verifying refresh token: {token_preview}")

    sessions = load_sessions()
    logger.info(f"[AUTH] Total sessions in store: {len(sessions)}")

    session = sessions.get(token)

    if not session:
        logger.warning(f"[AUTH] Refresh token not found in session store: {token_preview}")
        logger.warning(f"[AUTH] This could mean:")
        logger.warning(f"[AUTH]   - Token already used (rotation security)")
        logger.warning(f"[AUTH]   - Token was revoked (logout)")
        logger.warning(f"[AUTH]   - Session data corrupted or cleared")
        return None

    # Check expiry
    expires_at = datetime.fromisoformat(session["expires_at"])
    time_until_expiry = expires_at - datetime.utcnow()

    if datetime.utcnow() > expires_at:
        # Token expired, remove it
        logger.warning(f"[AUTH] Refresh token expired: {token_preview}")
        logger.warning(f"[AUTH]   Expired at: {expires_at.isoformat()}")
        logger.warning(f"[AUTH]   Current time: {datetime.utcnow().isoformat()}")
        del sessions[token]
        save_sessions(sessions)
        return None

    logger.info(f"[AUTH] Refresh token valid for user_id={session.get('user_id')}, expires in {time_until_expiry}")
    return session


def revoke_refresh_token(token: str) -> bool:
    """
    Revoke a refresh token.

    Args:
        token: Refresh token to revoke

    Returns:
        True if revoked, False if not found
    """
    sessions = load_sessions()
    if token in sessions:
        del sessions[token]
        save_sessions(sessions)
        return True
    return False


def revoke_all_user_sessions(user_id: str):
    """
    Revoke all refresh tokens for a user.

    Args:
        user_id: User identifier
    """
    sessions = load_sessions()
    sessions_to_delete = [
        token for token, session in sessions.items()
        if session["user_id"] == user_id
    ]

    for token in sessions_to_delete:
        del sessions[token]

    save_sessions(sessions)


def revoke_all_sessions():
    """
    Revoke all active sessions (all users).
    Typically called on server shutdown for security.
    """
    ensure_auth_files()
    save_sessions({})


# Connection token management (for streaming sessions)

CONNECTION_TOKEN_EXPIRE_MINUTES = 30

def create_connection_token(user_id: str, conversation_id: str, stream_id: str) -> str:
    """
    Generate single-use connection token for streaming session.

    Args:
        user_id: User identifier
        conversation_id: Conversation being streamed
        stream_id: Unique stream identifier

    Returns:
        JWT token with 30-minute expiry
    """
    payload = {
        "sub": user_id,
        "conversation_id": conversation_id,
        "stream_id": stream_id,
        "token_type": "connection",
        "exp": datetime.utcnow() + timedelta(minutes=CONNECTION_TOKEN_EXPIRE_MINUTES),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_connection_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and mark connection token as used (single-use).

    Args:
        token: Connection token to verify

    Returns:
        Decoded payload if valid and unused, None otherwise
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        # Check if this is a connection token
        if payload.get("token_type") != "connection":
            return None

        stream_id = payload.get("stream_id")
        if not stream_id:
            return None

        # Check if already used
        sessions = load_sessions()
        connection_key = f"connection_{stream_id}"

        if connection_key in sessions:
            # Already used
            return None

        # Mark as used (store in sessions with TTL)
        expires = datetime.utcnow() + timedelta(minutes=CONNECTION_TOKEN_EXPIRE_MINUTES)
        sessions[connection_key] = {
            "stream_id": stream_id,
            "user_id": payload.get("sub"),
            "conversation_id": payload.get("conversation_id"),
            "used_at": datetime.utcnow().isoformat(),
            "expires_at": expires.isoformat()
        }
        save_sessions(sessions)

        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def is_connection_token_used(stream_id: str) -> bool:
    """
    Check if a connection token has already been used.

    Args:
        stream_id: Stream identifier

    Returns:
        True if already used, False otherwise
    """
    sessions = load_sessions()
    connection_key = f"connection_{stream_id}"
    return connection_key in sessions


def cleanup_expired_connection_tokens():
    """
    Clean up expired connection tokens from sessions store.
    Should be called periodically to prevent storage bloat.
    """
    sessions = load_sessions()
    now = datetime.utcnow()

    expired_keys = []
    for key, session in sessions.items():
        if key.startswith("connection_"):
            expires_at = datetime.fromisoformat(session.get("expires_at", ""))
            if expires_at < now:
                expired_keys.append(key)

    for key in expired_keys:
        del sessions[key]

    if expired_keys:
        save_sessions(sessions)
        print(f"[INFO] Cleaned up {len(expired_keys)} expired connection tokens")


def create_user(email: str, password: str, name: str, invite_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new user account.

    Args:
        email: User email (used as username)
        password: Plain text password
        name: User's display name
        invite_token: Optional invite token (required in production)

    Returns:
        User object

    Raises:
        ValueError: If email already exists or invite token invalid
    """
    users = load_users()

    # Check if email already exists
    email_lower = email.lower()
    if any(u.get("email", "").lower() == email_lower for u in users.values()):
        raise ValueError("Email already registered")

    # Validate invite token if provided
    if invite_token:
        from . import storage
        is_valid, error = storage.validate_invite_token(invite_token)
        if not is_valid:
            raise ValueError(error)

        # Mark token as used
        storage.mark_invite_used(invite_token, email)

    user_id = generate_user_id()

    # Create default profile for user
    from . import storage
    profile_id = f"profile_{user_id}"
    storage.create_profile(profile_id, f"{name}'s Profile", {})

    user = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(password),
        "name": name,
        "default_profile_id": profile_id,
        "created_at": datetime.utcnow().isoformat(),
        "last_login": None,
        "failed_login_attempts": 0,
        "locked_until": None
    }

    users[user_id] = user
    save_users(users)

    return user


def is_account_locked(user: Dict[str, Any]) -> bool:
    """
    Check if user account is locked.

    Args:
        user: User object

    Returns:
        True if account is locked, False otherwise
    """
    locked_until = user.get("locked_until")
    if not locked_until:
        return False

    # Check if lock has expired
    lock_expiry = datetime.fromisoformat(locked_until)
    if datetime.utcnow() > lock_expiry:
        return False

    return True


def lock_account(user: Dict[str, Any], duration_minutes: int = 30):
    """
    Lock user account for a specified duration.

    Args:
        user: User object
        duration_minutes: Duration to lock account in minutes
    """
    users = load_users()
    locked_until = datetime.utcnow() + timedelta(minutes=duration_minutes)

    user["locked_until"] = locked_until.isoformat()
    user["failed_login_attempts"] = 0  # Reset counter

    users[user["id"]] = user
    save_users(users)


def record_failed_login(user: Dict[str, Any], max_attempts: int = 10):
    """
    Record a failed login attempt and lock account if threshold exceeded.

    Args:
        user: User object
        max_attempts: Maximum failed attempts before lockout

    Returns:
        True if account was locked, False otherwise
    """
    users = load_users()

    attempts = user.get("failed_login_attempts", 0) + 1
    user["failed_login_attempts"] = attempts

    if attempts >= max_attempts:
        lock_account(user, duration_minutes=30)
        users[user["id"]] = user
        save_users(users)
        return True
    else:
        users[user["id"]] = user
        save_users(users)
        return False


def reset_failed_login_attempts(user: Dict[str, Any]):
    """
    Reset failed login attempts counter.

    Args:
        user: User object
    """
    users = load_users()
    user["failed_login_attempts"] = 0
    user["locked_until"] = None
    users[user["id"]] = user
    save_users(users)


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Authenticate a user by email and password with account lockout protection.

    Args:
        email: User email
        password: Plain text password

    Returns:
        User object if authenticated, None otherwise
        Returns None with special "locked" indicator if account is locked
    """
    users = load_users()

    email_lower = email.lower()
    for user in users.values():
        if user.get("email", "").lower() == email_lower:
            # Check if account is locked
            if is_account_locked(user):
                # Return a special marker to indicate locked account
                # Don't return actual user data for security
                return {"_locked": True, "locked_until": user.get("locked_until")}

            if verify_password(password, user["password_hash"]):
                # Successful login - reset failed attempts and update last login
                reset_failed_login_attempts(user)
                user["last_login"] = datetime.utcnow().isoformat()
                users[user["id"]] = user
                save_users(users)
                return user
            else:
                # Failed login - record attempt
                was_locked = record_failed_login(user)
                if was_locked:
                    # Return locked indicator
                    return {"_locked": True, "locked_until": user.get("locked_until")}
                return None

    return None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a user by ID.

    Args:
        user_id: User identifier

    Returns:
        User object or None if not found
    """
    users = load_users()
    return users.get(user_id)


def get_safe_user_data(user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get user data without sensitive fields.

    Args:
        user: Full user object

    Returns:
        User object without password_hash
    """
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "default_profile_id": user["default_profile_id"],
        "created_at": user["created_at"],
        "last_login": user.get("last_login")
    }
