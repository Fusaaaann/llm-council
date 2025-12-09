"""Audit logging system for security events."""

import os
import json
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path

AUDIT_LOG_FILE = "data/audit.log"


def ensure_audit_log():
    """Ensure audit log file and directory exist."""
    Path(AUDIT_LOG_FILE).parent.mkdir(parents=True, exist_ok=True)
    if not os.path.exists(AUDIT_LOG_FILE):
        Path(AUDIT_LOG_FILE).touch()


def log_event(
    event_type: str,
    result: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
):
    """
    Log a security event to the audit log.

    Args:
        event_type: Type of event (e.g., "login", "login_failed", "logout", etc.)
        result: Result of the event (e.g., "success", "failure", "denied")
        user_id: User identifier (if applicable)
        email: User email (if applicable)
        ip_address: Client IP address
        user_agent: Client user agent string
        details: Additional event details
    """
    ensure_audit_log()

    log_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event_type": event_type,
        "result": result,
        "user_id": user_id,
        "email": email,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "details": details or {}
    }

    # Write as single-line JSON for easy parsing
    with open(AUDIT_LOG_FILE, 'a') as f:
        f.write(json.dumps(log_entry) + '\n')


def log_login_success(user_id: str, email: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None):
    """Log successful login."""
    log_event("login", "success", user_id=user_id, email=email, ip_address=ip_address, user_agent=user_agent)


def log_login_failure(email: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None, reason: Optional[str] = None):
    """Log failed login attempt."""
    log_event(
        "login",
        "failure",
        email=email,
        ip_address=ip_address,
        user_agent=user_agent,
        details={"reason": reason} if reason else None
    )


def log_register_success(user_id: str, email: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None, invited: bool = False):
    """Log successful registration."""
    log_event(
        "register",
        "success",
        user_id=user_id,
        email=email,
        ip_address=ip_address,
        user_agent=user_agent,
        details={"invited": invited}
    )


def log_register_failure(email: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None, reason: Optional[str] = None):
    """Log failed registration attempt."""
    log_event(
        "register",
        "failure",
        email=email,
        ip_address=ip_address,
        user_agent=user_agent,
        details={"reason": reason} if reason else None
    )


def log_logout(user_id: str, email: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None):
    """Log logout event."""
    log_event("logout", "success", user_id=user_id, email=email, ip_address=ip_address, user_agent=user_agent)


def log_token_refresh(user_id: str, email: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None):
    """Log token refresh event."""
    log_event("token_refresh", "success", user_id=user_id, email=email, ip_address=ip_address, user_agent=user_agent)


def log_token_refresh_failure(ip_address: Optional[str] = None, user_agent: Optional[str] = None, reason: Optional[str] = None):
    """Log failed token refresh."""
    log_event(
        "token_refresh",
        "failure",
        ip_address=ip_address,
        user_agent=user_agent,
        details={"reason": reason} if reason else None
    )


def log_invite_validation(token: str, result: str, email: Optional[str] = None, ip_address: Optional[str] = None):
    """Log invite token validation attempt."""
    log_event(
        "invite_validation",
        result,
        email=email,
        ip_address=ip_address,
        details={"token_prefix": token[:8] + "..."}  # Only log first 8 chars for security
    )


def log_invite_used(token: str, email: str, ip_address: Optional[str] = None):
    """Log invite token usage."""
    log_event(
        "invite_used",
        "success",
        email=email,
        ip_address=ip_address,
        details={"token_prefix": token[:8] + "..."}
    )


def log_profile_access_denied(user_id: str, profile_id: str, ip_address: Optional[str] = None):
    """Log unauthorized profile access attempt."""
    log_event(
        "profile_access",
        "denied",
        user_id=user_id,
        ip_address=ip_address,
        details={"profile_id": profile_id}
    )


def log_rate_limit_exceeded(endpoint: str, ip_address: Optional[str] = None, user_id: Optional[str] = None):
    """Log rate limit violation."""
    log_event(
        "rate_limit",
        "exceeded",
        user_id=user_id,
        ip_address=ip_address,
        details={"endpoint": endpoint}
    )


def log_account_locked(user_id: str, email: str, reason: str, ip_address: Optional[str] = None):
    """Log account lockout event."""
    log_event(
        "account_locked",
        "locked",
        user_id=user_id,
        email=email,
        ip_address=ip_address,
        details={"reason": reason}
    )


def log_waitlist_submission(email: str, ip_address: Optional[str] = None):
    """Log waitlist submission."""
    log_event(
        "waitlist_submission",
        "success",
        email=email,
        ip_address=ip_address
    )


def log_session_revocation(reason: str, details: Optional[Dict[str, Any]] = None):
    """Log session revocation event."""
    log_event(
        "session_revocation",
        "success",
        details={"reason": reason, **(details or {})}
    )
