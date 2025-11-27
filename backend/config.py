"""Configuration for the LLM Council."""

import os
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

# OpenRouter API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Council members - list of OpenRouter model identifiers
COUNCIL_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]

# Chairman model - synthesizes final response
CHAIRMAN_MODEL = "google/gemini-3-pro-preview"

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Environment mode: "local" or "production"
ENVIRONMENT = os.getenv("ENVIRONMENT", "local")

# Default profile ID for local development
DEFAULT_PROFILE_ID = os.getenv("DEFAULT_PROFILE_ID", "default")

# Data directory for conversation storage
DATA_DIR = "data/conversations"

# Profiles metadata file
PROFILES_FILE = "data/profiles.json"

# Encryption settings
ENCRYPTION_ENABLED = os.getenv("ENCRYPTION_ENABLED", "true").lower() == "true"
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")  # Base64-encoded Fernet key
ENCRYPTION_PROVIDER = "fernet"  # Currently only Fernet supported

# Authentication settings
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")  # Secret key for JWT signing
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "false").lower() == "true"  # Enable authentication

# Waitlist and invite settings
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")  # Email to receive waitlist submissions
WAITLIST_FILE = "data/waitlist.json"
INVITES_FILE = "data/invites.json"
INVITE_TOKEN_EXPIRE_DAYS = int(os.getenv("INVITE_TOKEN_EXPIRE_DAYS", "7"))  # Invite link expiration
API_BASE_URL = os.getenv("API_BASE_URL")

# Account security settings
ACCOUNT_LOCKOUT_THRESHOLD = int(os.getenv("ACCOUNT_LOCKOUT_THRESHOLD", "10"))  # Failed login attempts before lockout
ACCOUNT_LOCKOUT_DURATION_MINUTES = int(os.getenv("ACCOUNT_LOCKOUT_DURATION_MINUTES", "30"))  # Lockout duration

# Audit logging
AUDIT_LOG_FILE = "data/audit.log"

# CORS settings for frontend
FRONTEND_URLS = os.getenv("FRONTEND_URLS", "http://localhost:5173,http://localhost:3000").split(",")
