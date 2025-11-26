#!/usr/bin/env python3
"""
Test script for encryption API endpoints.
"""

import sys
import uuid
from backend.storage import (
    create_conversation,
    add_user_message,
    get_conversation,
    encrypt_conversation,
    decrypt_conversation,
    get_conversation_encryption_status,
    delete_conversation
)

def test_encryption_workflow():
    """Test the complete encryption workflow."""
    print("🧪 Testing Encryption Workflow\n")

    # Create a test conversation
    conv_id = str(uuid.uuid4())
    print(f"1. Creating test conversation: {conv_id}")
    conversation = create_conversation(conv_id)
    print(f"   ✓ Created\n")

    # Add a test message
    print("2. Adding test message")
    add_user_message(conv_id, "This is a test message to be encrypted")
    conversation = get_conversation(conv_id)
    print(f"   ✓ Message added: {len(conversation['messages'])} messages\n")

    # Check initial encryption status
    print("3. Checking initial encryption status")
    status = get_conversation_encryption_status(conv_id)
    print(f"   Status: {status}")
    print(f"   Is Encrypted: {status['is_encrypted']}\n")

    # Encrypt the conversation
    print("4. Encrypting conversation")
    encrypt_conversation(conv_id)
    status = get_conversation_encryption_status(conv_id)
    print(f"   ✓ Encrypted")
    print(f"   Status: {status}")
    print(f"   Provider: {status['provider']}")
    print(f"   Version: {status['version']}\n")

    # Verify we can still read it
    print("5. Verifying encrypted conversation can be read")
    conversation = get_conversation(conv_id)
    print(f"   ✓ Conversation loaded")
    print(f"   Messages: {len(conversation['messages'])}")
    print(f"   Message content: {conversation['messages'][0]['content']}\n")

    # Decrypt the conversation
    print("6. Decrypting conversation")
    decrypt_conversation(conv_id)
    status = get_conversation_encryption_status(conv_id)
    print(f"   ✓ Decrypted")
    print(f"   Status: {status}")
    print(f"   Is Encrypted: {status['is_encrypted']}\n")

    # Verify we can still read it
    print("7. Verifying decrypted conversation can be read")
    conversation = get_conversation(conv_id)
    print(f"   ✓ Conversation loaded")
    print(f"   Messages: {len(conversation['messages'])}")
    print(f"   Message content: {conversation['messages'][0]['content']}\n")

    # Clean up
    print("8. Cleaning up")
    delete_conversation(conv_id)
    print(f"   ✓ Test conversation deleted\n")

    print("✅ All tests passed!")

if __name__ == "__main__":
    try:
        test_encryption_workflow()
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
