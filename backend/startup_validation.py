"""Startup validation to fail fast on security misconfigurations."""

import os
import sys
from pathlib import Path
from typing import List, Tuple
from backend.config import ENVIRONMENT, JWT_SECRET_KEY, ENCRYPTION_ENABLED, ENCRYPTION_KEY


class SecurityValidationError(Exception):
    """Raised when critical security validation fails."""
    pass


def validate_jwt_secret() -> Tuple[bool, str]:
    """
    Validate JWT secret key configuration.

    Returns:
        Tuple of (is_valid, error_message)
    """
    if ENVIRONMENT == "production":
        if not JWT_SECRET_KEY:
            return False, (
                "CRITICAL SECURITY ERROR: JWT_SECRET_KEY must be set in production mode!\n"
                "Set JWT_SECRET_KEY in your .env file with a strong random value.\n"
                "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )

        if len(JWT_SECRET_KEY) < 32:
            return False, (
                "CRITICAL SECURITY ERROR: JWT_SECRET_KEY is too short!\n"
                f"Current length: {len(JWT_SECRET_KEY)} characters. Minimum: 32 characters.\n"
                "Generate a new one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
    else:
        # Local mode warning
        if not JWT_SECRET_KEY:
            print(
                "⚠️  WARNING: JWT_SECRET_KEY not set. Auto-generating ephemeral key.\n"
                "   This key will change on server restart, logging out all users.\n"
                "   Set JWT_SECRET_KEY in .env for persistent sessions.",
                file=sys.stderr
            )

    return True, ""


def validate_encryption_key() -> Tuple[bool, str]:
    """
    Validate encryption key configuration.

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not ENCRYPTION_ENABLED:
        return True, ""

    if not ENCRYPTION_KEY:
        return False, (
            "CRITICAL SECURITY ERROR: ENCRYPTION_KEY not set but ENCRYPTION_ENABLED=true!\n"
            "Set ENCRYPTION_KEY in your .env file.\n"
            "Generate one with: python scripts/generate_encryption_key.py"
        )

    # Check if encrypted files exist but no key
    data_dir = "data"
    encrypted_files_exist = False

    if os.path.exists(data_dir):
        for root, dirs, files in os.walk(data_dir):
            for file in files:
                if file.endswith('.json'):
                    filepath = os.path.join(root, file)
                    try:
                        import json
                        with open(filepath, 'r') as f:
                            data = json.load(f)
                            if isinstance(data, dict) and ('_encryption' in data or 'messages_encrypted' in data):
                                encrypted_files_exist = True
                                break
                    except:
                        continue
            if encrypted_files_exist:
                break

    if encrypted_files_exist and not ENCRYPTION_KEY:
        return False, (
            "CRITICAL SECURITY ERROR: Encrypted files found but ENCRYPTION_KEY not set!\n"
            "Your data is encrypted but the decryption key is missing.\n"
            "Set ENCRYPTION_KEY in your .env file to the original key used for encryption.\n"
            "WARNING: Lost encryption key = permanently lost data!"
        )

    return True, ""


def validate_file_permissions() -> Tuple[bool, str]:
    """
    Validate file permissions on sensitive data files.

    Returns:
        Tuple of (is_valid, error_message)
    """
    sensitive_files = [
        "data/users.json",
        "data/sessions.json",
        "data/invites.json",
        ".env"
    ]

    warnings = []

    for filepath in sensitive_files:
        if not os.path.exists(filepath):
            continue

        # Get file permissions
        stat_info = os.stat(filepath)
        mode = stat_info.st_mode

        # Check if world-readable (octal 0o004)
        if mode & 0o004:
            warnings.append(
                f"⚠️  SECURITY WARNING: {filepath} is world-readable!\n"
                f"   Current permissions: {oct(mode)[-3:]}\n"
                f"   Fix with: chmod 600 {filepath}"
            )

        # Check if group-readable (octal 0o040) in production
        if ENVIRONMENT == "production" and (mode & 0o040):
            warnings.append(
                f"⚠️  SECURITY WARNING: {filepath} is group-readable in production!\n"
                f"   Current permissions: {oct(mode)[-3:]}\n"
                f"   Fix with: chmod 600 {filepath}"
            )

    if warnings:
        print("\n".join(warnings), file=sys.stderr)

    # Don't fail on permission warnings, just warn
    return True, ""


def validate_production_requirements() -> Tuple[bool, str]:
    """
    Validate production-specific requirements.

    Returns:
        Tuple of (is_valid, error_message)
    """
    if ENVIRONMENT != "production":
        return True, ""

    errors = []

    # Check for localhost in CORS origins would go here
    # (requires access to main.py app configuration)

    return True, ""


def run_startup_validation():
    """
    Run all startup validations.

    Raises:
        SecurityValidationError: If any critical validation fails
    """
    print("🔒 Running security startup validation...", file=sys.stderr)

    validations = [
        ("JWT Secret Key", validate_jwt_secret),
        ("Encryption Key", validate_encryption_key),
        ("File Permissions", validate_file_permissions),
        ("Production Requirements", validate_production_requirements),
    ]

    failed_validations = []

    for name, validator in validations:
        is_valid, error_message = validator()
        if not is_valid:
            failed_validations.append((name, error_message))

    if failed_validations:
        error_output = "\n" + "="*80 + "\n"
        error_output += "STARTUP VALIDATION FAILED\n"
        error_output += "="*80 + "\n\n"

        for name, message in failed_validations:
            error_output += f"❌ {name}:\n{message}\n\n"

        error_output += "="*80 + "\n"
        error_output += "Server startup aborted due to security validation failures.\n"
        error_output += "Fix the issues above and restart the server.\n"
        error_output += "="*80

        raise SecurityValidationError(error_output)

    print("✅ Security validation passed", file=sys.stderr)
