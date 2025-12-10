#!/usr/bin/env python3
"""
Generate and add encryption key to .env file.

This script generates a new Fernet encryption key and adds it to the .env file
if not already present.
"""

import os
from pathlib import Path
from backend.encryption import generate_fernet_key

def main():
    env_path = Path(".env")

    # Read existing .env content
    if env_path.exists():
        with open(env_path, 'r') as f:
            env_content = f.read()
    else:
        env_content = ""

    # Check if encryption key already exists
    if "ENCRYPTION_KEY=" in env_content:
        print("✓ ENCRYPTION_KEY already exists in .env")
        # Extract and display the key
        for line in env_content.split('\n'):
            if line.startswith("ENCRYPTION_KEY="):
                key_value = line.split('=', 1)[1]
                print(f"  Current key: {key_value[:20]}...")
        return

    # Generate new Fernet key
    print("Generating new encryption key...")
    key = generate_fernet_key()
    key_str = key.decode('utf-8')

    # Add to .env file
    if env_content and not env_content.endswith('\n'):
        env_content += '\n'

    env_content += f"\n# Encryption key for conversation storage (Fernet/AES-128)\n"
    env_content += f"# IMPORTANT: Back up this key! Lost key = lost conversations\n"
    env_content += f"ENCRYPTION_KEY={key_str}\n"
    env_content += f"ENCRYPTION_ENABLED=true\n"

    # Write back to .env
    with open(env_path, 'w') as f:
        f.write(env_content)

    print(f"✓ Generated and saved encryption key to .env")
    print(f"  Key: {key_str[:20]}...")
    print(f"\n⚠️  IMPORTANT: Back up your .env file!")
    print(f"  Without the encryption key, you cannot decrypt your conversations.")

if __name__ == "__main__":
    main()
