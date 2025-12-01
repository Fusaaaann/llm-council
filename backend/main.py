"""FastAPI backend for LLM Council - Main application startup and configuration."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from . import config
from .startup_validation import run_startup_validation, SecurityValidationError
from .security_middleware import SecurityHeadersMiddleware
from .rate_limiter import limiter

# Import route modules
from .routes import conversations, auth, profiles, forum, model_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown."""
    # Startup: Run security validation
    try:
        run_startup_validation()
    except SecurityValidationError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)

    yield

    # Shutdown: Revoke all sessions for security
    from .auth import revoke_all_sessions
    from .audit import log_session_revocation
    revoke_all_sessions()
    log_session_revocation("server_shutdown")
    print("All sessions revoked on shutdown", file=sys.stderr)


# Create FastAPI app with lifespan handler
app = FastAPI(title="LLM Council API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Enable CORS - configurable via FRONTEND_URLS environment variable
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # Allow JavaScript to read Content-Disposition header
)

# Include routers
app.include_router(conversations.router)
app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(forum.router)
app.include_router(model_config.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
