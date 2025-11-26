#!/usr/bin/env python3
"""
Setup script for authentication system.
Generates JWT secret key and updates .env file.
"""

import os
import secrets
from pathlib import Path


def generate_jwt_secret():
    """Generate a secure JWT secret key."""
    return secrets.token_urlsafe(32)


def setup_env_file():
    """Setup .env file with authentication settings."""
    project_root = Path(__file__).parent.parent
    env_file = project_root / ".env"
    env_example = project_root / ".env.example"

    # Check if .env exists
    if not env_file.exists():
        if env_example.exists():
            print("Creating .env from .env.example...")
            with open(env_example) as f:
                env_content = f.read()
            with open(env_file, 'w') as f:
                f.write(env_content)
        else:
            print("Creating new .env file...")
            with open(env_file, 'w') as f:
                f.write("")

    # Read current .env
    with open(env_file, 'r') as f:
        lines = f.readlines()

    # Check if JWT_SECRET_KEY exists
    has_jwt_key = any('JWT_SECRET_KEY=' in line for line in lines)

    if has_jwt_key:
        print("\n✓ JWT_SECRET_KEY already exists in .env")
        response = input("Do you want to generate a new one? (y/N): ").strip().lower()
        if response != 'y':
            print("Keeping existing JWT_SECRET_KEY")
            return

    # Generate new JWT secret
    jwt_secret = generate_jwt_secret()

    # Update or add JWT_SECRET_KEY
    updated = False
    for i, line in enumerate(lines):
        if line.startswith('JWT_SECRET_KEY='):
            lines[i] = f'JWT_SECRET_KEY={jwt_secret}\n'
            updated = True
            break

    if not updated:
        # Add JWT settings if not found
        if lines and not lines[-1].endswith('\n'):
            lines.append('\n')
        lines.append('\n# Authentication Settings\n')
        lines.append(f'JWT_SECRET_KEY={jwt_secret}\n')
        lines.append('ACCESS_TOKEN_EXPIRE_MINUTES=15\n')
        lines.append('REFRESH_TOKEN_EXPIRE_DAYS=7\n')
        lines.append('AUTH_ENABLED=false\n')

    # Write back to .env
    with open(env_file, 'w') as f:
        f.writelines(lines)

    print(f"\n✓ JWT_SECRET_KEY generated and saved to .env")
    print(f"✓ Secret: {jwt_secret[:20]}... (truncated)")
    print(f"\nAuthentication setup complete!")
    print(f"\nNext steps:")
    print(f"1. Install dependencies: uv sync")
    print(f"2. Start backend: python -m backend.main")
    print(f"3. Start frontend: cd frontend && npm run dev")
    print(f"\nFor production:")
    print(f"1. Set ENVIRONMENT=production in .env")
    print(f"2. Set AUTH_ENABLED=true in .env")


def main():
    print("=" * 60)
    print("LLM Council - Authentication Setup")
    print("=" * 60)
    print()

    try:
        setup_env_file()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return 1

    print("\n" + "=" * 60)
    return 0


if __name__ == "__main__":
    exit(main())
