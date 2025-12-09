#!/usr/bin/env python3
"""Test backward compatibility with legacy conversation format."""

import json
import sys
from pathlib import Path

import backend.storage.conversations

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.config import DEFAULT_PROFILE_ID


def test_legacy_format():
    """Test reading a legacy unencrypted conversation."""
    print("=" * 60)
    print("TEST 1: Reading Legacy Unencrypted Format")
    print("=" * 60)

    # Read a backup conversation (legacy format)
    backup_path = Path("data-bak/conversations/d202d0e9-dca6-4c05-934a-567d3fd0212d.json")
    if not backup_path.exists():
        print("❌ Backup file not found")
        return False

    with open(backup_path, 'r') as f:
        legacy_data = json.load(f)

    print(f"✓ Legacy format has {len(legacy_data.get('messages', []))} messages")
    print(f"✓ Has '_encryption' field: {'_encryption' in legacy_data}")
    print(f"✓ Has 'messages_encrypted' field: {'messages_encrypted' in legacy_data}")

    # Now try reading through storage API
    conv_id = legacy_data['id']
    print(f"\n📖 Loading conversation {conv_id} via storage API...")

    try:
        loaded = backend.storage.conversations.get_conversation(conv_id, DEFAULT_PROFILE_ID)
        if loaded is None:
            print("❌ Conversation not found in storage")
            return False

        print(f"✓ Successfully loaded via API")
        print(f"✓ Has {len(loaded.get('messages', []))} messages")
        print(f"✓ Title: {loaded.get('title')}")
        print(f"✓ Created: {loaded.get('created_at')}")

        # Verify message structure
        if loaded.get('messages'):
            msg = loaded['messages'][0]
            print(f"✓ First message role: {msg.get('role')}")
            if msg.get('role') == 'user':
                print(f"✓ Has content: {bool(msg.get('content'))}")

        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_encrypted_format():
    """Test reading an encrypted conversation."""
    print("\n" + "=" * 60)
    print("TEST 2: Reading Encrypted Format")
    print("=" * 60)

    # Read current encrypted conversation
    current_path = Path(f"data/conversations/profile_{DEFAULT_PROFILE_ID}/d202d0e9-dca6-4c05-934a-567d3fd0212d.json")
    if not current_path.exists():
        print("❌ Encrypted file not found")
        return False

    with open(current_path, 'r') as f:
        encrypted_data = json.load(f)

    print(f"✓ Has '_encryption' field: {'_encryption' in encrypted_data}")
    print(f"✓ Has 'messages_encrypted' field: {'messages_encrypted' in encrypted_data}")
    print(f"✓ Has 'messages' field (should be absent): {'messages' in encrypted_data}")

    # Load via API (should decrypt automatically)
    conv_id = encrypted_data['id']
    print(f"\n📖 Loading encrypted conversation {conv_id} via storage API...")

    try:
        loaded = backend.storage.conversations.get_conversation(conv_id, DEFAULT_PROFILE_ID)
        if loaded is None:
            print("❌ Conversation not found")
            return False

        print(f"✓ Successfully decrypted")
        print(f"✓ Has {len(loaded.get('messages', []))} messages")
        print(f"✓ Has 'messages' field: {'messages' in loaded}")
        print(f"✓ Has '_encryption' field (should be removed): {'_encryption' in loaded}")

        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_re_encryption():
    """Test re-saving a conversation (encryption toggle)."""
    print("\n" + "=" * 60)
    print("TEST 3: Re-encryption (Toggle Test)")
    print("=" * 60)

    conv_id = "d202d0e9-dca6-4c05-934a-567d3fd0212d"

    try:
        # Load conversation
        print(f"📖 Loading conversation {conv_id}...")
        conv = backend.storage.conversations.get_conversation(conv_id, DEFAULT_PROFILE_ID)
        if conv is None:
            print("❌ Conversation not found")
            return False

        print(f"✓ Loaded successfully")

        # Check file state before re-save
        conv_path = Path(f"data/conversations/profile_{DEFAULT_PROFILE_ID}/{conv_id}.json")
        with open(conv_path, 'r') as f:
            before = json.load(f)

        was_encrypted = '_encryption' in before or 'messages_encrypted' in before
        print(f"✓ File was encrypted: {was_encrypted}")

        # Re-save (will apply current encryption settings)
        print(f"\n💾 Re-saving conversation...")
        backend.storage.conversations.save_conversation(conv, DEFAULT_PROFILE_ID)

        # Check file state after re-save
        with open(conv_path, 'r') as f:
            after = json.load(f)

        is_encrypted = '_encryption' in after or 'messages_encrypted' in after
        print(f"✓ File is now encrypted: {is_encrypted}")

        # Verify can still load
        print(f"\n📖 Verifying can still load...")
        reloaded = backend.storage.conversations.get_conversation(conv_id, DEFAULT_PROFILE_ID)
        if reloaded is None:
            print("❌ Failed to reload conversation")
            return False

        print(f"✓ Successfully reloaded")
        print(f"✓ Message count unchanged: {len(reloaded.get('messages', []))}")

        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("\n🧪 Backward Compatibility Test Suite")
    print("=" * 60)

    results = []

    # Test 1: Legacy format
    results.append(("Legacy Format", test_legacy_format()))

    # Test 2: Encrypted format
    results.append(("Encrypted Format", test_encrypted_format()))

    # Test 3: Re-encryption
    results.append(("Re-encryption", test_re_encryption()))

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status} - {name}")

    all_passed = all(r[1] for r in results)
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL TESTS PASSED")
    else:
        print("⚠️  SOME TESTS FAILED")
    print("=" * 60)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
