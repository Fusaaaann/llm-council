"""Authentication and waitlist endpoints."""

from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Dict, Any

import backend.storage.registration

from backend.storage import audit

from backend import config, auth
from backend.auth_middleware import ensure_user_logged_in
from backend.models import RegisterRequest, LoginRequest, RefreshTokenRequest, WaitlistRequest
from backend.rate_limiter import limiter

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/auth/register")
@limiter.limit("3/hour")
async def register(req: RegisterRequest, request: Request):
    """Register a new user account (requires invite token in production)."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        # In production mode, require invite token
        if config.ENVIRONMENT == "production" and not req.invite_token:
            audit.log_register_failure(req.email, ip_address=client_ip, user_agent=user_agent, reason="missing_invite_token")
            raise HTTPException(status_code=400, detail="Invite token required for registration")

        user = auth.create_user(req.email, req.password, req.name, req.invite_token)

        # Create tokens
        access_token = auth.create_access_token(user["id"], user["default_profile_id"])
        refresh_token_data = auth.create_refresh_token_record(user["id"], user["default_profile_id"])

        audit.log_register_success(user["id"], user["email"], ip_address=client_ip, user_agent=user_agent, invited=bool(req.invite_token))

        return {
            "user": auth.get_safe_user_data(user),
            "access_token": access_token,
            "refresh_token": refresh_token_data["token"],
            "token_type": "bearer"
        }
    except ValueError as e:
        audit.log_register_failure(req.email, ip_address=client_ip, user_agent=user_agent, reason=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/login")
@limiter.limit("5/15minutes")
async def login(req: LoginRequest, request: Request):
    """Authenticate and log in a user."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    user = auth.authenticate_user(req.email, req.password)

    # Check if account is locked
    if user and user.get("_locked"):
        audit.log_login_failure(req.email, ip_address=client_ip, user_agent=user_agent, reason="account_locked")
        locked_until = user.get("locked_until", "unknown")
        raise HTTPException(
            status_code=403,
            detail=f"Account temporarily locked due to too many failed login attempts. Please try again later. Locked until: {locked_until}"
        )

    if not user:
        audit.log_login_failure(req.email, ip_address=client_ip, user_agent=user_agent, reason="invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create tokens
    access_token = auth.create_access_token(user["id"], user["default_profile_id"])
    refresh_token_data = auth.create_refresh_token_record(user["id"], user["default_profile_id"])

    audit.log_login_success(user["id"], user["email"], ip_address=client_ip, user_agent=user_agent)

    return {
        "user": auth.get_safe_user_data(user),
        "access_token": access_token,
        "refresh_token": refresh_token_data["token"],
        "token_type": "bearer"
    }


@router.post("/auth/refresh")
@limiter.limit("20/minute")
async def refresh_token(req: RefreshTokenRequest, request: Request):
    """Refresh an access token and rotate refresh token for enhanced security."""
    import logging
    logger = logging.getLogger(__name__)

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    token_preview = req.refresh_token[:20] + "..." if len(req.refresh_token) > 20 else req.refresh_token
    logger.info(f"[AUTH] Refresh token request from {client_ip}, token: {token_preview}")

    session = auth.verify_refresh_token(req.refresh_token)

    if not session:
        logger.warning(f"[AUTH] Refresh token verification failed for token: {token_preview}")
        audit.log_token_refresh_failure(ip_address=client_ip, user_agent=user_agent, reason="invalid_token")
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = auth.get_user_by_id(session["user_id"])
    if not user:
        logger.error(f"[AUTH] User not found for session user_id: {session['user_id']}")
        audit.log_token_refresh_failure(ip_address=client_ip, user_agent=user_agent, reason="user_not_found")
        raise HTTPException(status_code=401, detail="User not found")

    logger.info(f"[AUTH] Revoking old refresh token for user: {user['id']}")
    # Revoke old refresh token immediately (token rotation)
    auth.revoke_refresh_token(req.refresh_token)

    # Create new access token AND new refresh token
    logger.info(f"[AUTH] Creating new tokens for user: {user['id']}")
    access_token = auth.create_access_token(user["id"], user["default_profile_id"])
    new_refresh_token_data = auth.create_refresh_token_record(user["id"], user["default_profile_id"])

    audit.log_token_refresh(user["id"], user["email"], ip_address=client_ip, user_agent=user_agent)

    logger.info(f"[AUTH] Token refresh successful for user: {user['id']}, new refresh token: {new_refresh_token_data['token'][:20]}...")

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token_data["token"],  # Return new refresh token
        "token_type": "bearer"
    }


@router.post("/auth/logout")
async def logout(req: RefreshTokenRequest, request: Request):
    """Log out by revoking a refresh token."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Try to get user info from session before revoking
    session = auth.verify_refresh_token(req.refresh_token)
    if session:
        user = auth.get_user_by_id(session["user_id"])
        if user:
            audit.log_logout(user["id"], user["email"], ip_address=client_ip, user_agent=user_agent)

    auth.revoke_refresh_token(req.refresh_token)
    return {"success": True}


@router.get("/auth/me")
async def get_current_user(user: Dict[str, Any] = Depends(ensure_user_logged_in)):
    """Get current authenticated user."""
    return {"user": user}


@router.post("/waitlist")
@limiter.limit("1/hour")
async def join_waitlist(request: Request, waitlist_data: WaitlistRequest):
    """Join the waitlist for account registration."""
    client_ip = request.client.host if request.client else None

    try:
        entry = backend.storage.registration.add_to_waitlist(waitlist_data.email, waitlist_data.name)

        audit.log_waitlist_submission(waitlist_data.email, ip_address=client_ip)

        # TODO: Send notification email to admin
        # This would be implemented with an email service

        return {
            "success": True,
            "message": "Successfully joined waitlist",
            "email": entry["email"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invite/validate/{token}")
async def validate_invite(token: str, request: Request):
    """Validate an invite token."""
    client_ip = request.client.host if request.client else None

    is_valid, error = backend.storage.registration.validate_invite_token(token)

    invite = backend.storage.registration.get_invite_token(token) if is_valid else None
    audit.log_invite_validation(
        token,
        "success" if is_valid else "failure",
        email=invite.get("email") if invite else None,
        ip_address=client_ip
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    return {
        "valid": True,
        "email": invite.get("email"),
        "expires_at": invite.get("expires_at")
    }
