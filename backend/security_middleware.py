"""Security headers middleware for enhanced protection."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from .config import ENVIRONMENT


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Prevent clickjacking attacks
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # XSS protection (for older browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy (restrict access to browser features)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=()"
        )

        # Content Security Policy
        # Note: This is basic. May need adjustment based on frontend needs
        csp = "default-src 'self'; "
        csp += "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Allow inline scripts for now
        csp += "style-src 'self' 'unsafe-inline'; "  # Allow inline styles
        csp += "img-src 'self' data: https:; "  # Allow images from self, data URIs, and HTTPS
        csp += "font-src 'self'; "
        csp += "connect-src 'self'; "
        csp += "frame-ancestors 'none'"  # Prevent embedding
        response.headers["Content-Security-Policy"] = csp

        # HSTS (only in production with HTTPS)
        if ENVIRONMENT == "production":
            # Strict-Transport-Security: force HTTPS for 1 year
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response
