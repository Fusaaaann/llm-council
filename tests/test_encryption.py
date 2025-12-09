#!/usr/bin/env python3
"""
Test encryption functionality.

Tests:
1. Creating a new encrypted conversation
2. Reading and decrypting an encrypted conversation
3. Backward compatibility with unencrypted conversations
4. Re-encryption of legacy conversations on save
"""

import json
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from backend.storage.conversations import add_assistant_message, add_user_message, create_conversation, get_conversation, save_conversation
from backend.storage2 import (
    get_conversation_path
)
from backend.config import ENCRYPTION_ENABLED


def test_encrypted_conversation():
    """Test creating and reading encrypted conversations."""
    print("\n=== Test 1: Create Encrypted Conversation ===")

    # Create test conversation
    test_id = "test-encrypted-conv"
    conv = create_conversation(test_id, profile_id="default")
    print(f"✓ Created conversation: {test_id}")

    # Add a user message
    add_user_message(test_id, "Hello, this is a test message!", profile_id="default")
    print(f"✓ Added user message")

    # Add an assistant message
    add_assistant_message(
        test_id,
        stage1=[{"model": "test-model", "content": "Test response"}],
        stage2=[{"model": "test-model", "ranking": "Response A"}],
        stage3={"content": "Final answer"},
        metadata={"test": "metadata"},
        profile_id="default"
    )
    print(f"✓ Added assistant message")

    # Verify file is encrypted on disk
    path = get_conversation_path(test_id, "default")
    with open(path, 'r') as f:
        disk_data = json.load(f)

    if ENCRYPTION_ENABLED:
        if "messages_encrypted" in disk_data:
            print(f"✓ File is encrypted on disk")
            print(f"  Encryption metadata: {disk_data.get('_encryption')}")
        else:
            print(f"✗ ERROR: File should be encrypted but isn't!")
            return False

        if "messages" in disk_data:
            print(f"✗ ERROR: Plaintext messages found in encrypted file!")
            return False
    else:
        print(f"ℹ Encryption disabled, file stored as plaintext")

    # Read conversation back
    loaded_conv = get_conversation(test_id, profile_id="default")
    print(f"✓ Loaded and decrypted conversation")

    # Verify messages are decrypted
    if len(loaded_conv["messages"]) == 2:
        print(f"✓ Messages decrypted correctly ({len(loaded_conv['messages'])} messages)")
    else:
        print(f"✗ ERROR: Expected 2 messages, got {len(loaded_conv['messages'])}")
        return False

    # Verify content
    if loaded_conv["messages"][0]["content"] == "Hello, this is a test message!":
        print(f"✓ Message content verified")
    else:
        print(f"✗ ERROR: Message content corrupted")
        return False

    # Cleanup
    os.remove(path)
    print(f"✓ Test conversation cleaned up")

    return True


def test_legacy_conversation():
    """Test reading unencrypted (legacy) conversations."""
    print("\n=== Test 2: Legacy Unencrypted Conversation ===")

    # Create a legacy conversation manually (unencrypted)
    test_id = "test-legacy-conv"
    legacy_conv = {
        "id": test_id,
        "profile_id": "default",
        "created_at": "2025-01-01T00:00:00",
        "title": "Legacy Conversation",
        "messages": [
            {"role": "user", "content": "Legacy message"},
            {"role": "assistant", "stage1": [], "stage2": [], "stage3": {}}
        ],
        "is_public": False,
        "published_at": None,
        "sync_status": "local",
        "uses_byok": False
    }

    # Write as plaintext (no encryption)
    path = get_conversation_path(test_id, "default")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f:
        json.dump(legacy_conv, f, indent=2)
    print(f"✓ Created legacy unencrypted conversation")

    # Try to read it
    loaded_conv = get_conversation(test_id, profile_id="default")
    if loaded_conv is None:
        print(f"✗ ERROR: Failed to load legacy conversation")
        return False

    print(f"✓ Loaded legacy conversation (backward compatible)")

    # Verify messages
    if len(loaded_conv["messages"]) == 2:
        print(f"✓ Messages loaded correctly")
    else:
        print(f"✗ ERROR: Expected 2 messages, got {len(loaded_conv['messages'])}")
        return False

    # Now save it (should re-encrypt if encryption enabled)
    save_conversation(loaded_conv)
    print(f"✓ Re-saved conversation")

    # Check if it's now encrypted
    with open(path, 'r') as f:
        disk_data = json.load(f)

    if ENCRYPTION_ENABLED:
        if "messages_encrypted" in disk_data:
            print(f"✓ Legacy conversation re-encrypted on save")
        else:
            print(f"✗ ERROR: Should be encrypted after save!")
            return False
    else:
        print(f"ℹ Encryption disabled, remains as plaintext")

    # Verify we can still read it
    reloaded = get_conversation(test_id, profile_id="default")
    if len(reloaded["messages"]) == 2:
        print(f"✓ Re-encrypted conversation loads correctly")
    else:
        print(f"✗ ERROR: Failed to load after re-encryption")
        return False

    # Cleanup
    os.remove(path)
    print(f"✓ Test conversation cleaned up")

    return True


def main():
    print("=" * 60)
    print("Encryption Test Suite")
    print("=" * 60)
    print(f"Encryption enabled: {ENCRYPTION_ENABLED}")

    results = []

    # Test 1: Encrypted conversation
    results.append(("Encrypted Conversation", test_encrypted_conversation()))

    # Test 2: Legacy conversation
    results.append(("Legacy Conversation", test_legacy_conversation()))

    # Summary
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {name}")

    all_passed = all(passed for _, passed in results)
    print("\n" + ("All tests passed! ✓" if all_passed else "Some tests failed! ✗"))

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
