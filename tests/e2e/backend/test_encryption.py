"""E2E tests for conversation encryption."""

import pytest
import json
from pathlib import Path
from backend import storage


def test_create_and_verify_encrypted_conversation(client, auth_user):
    """Test that conversations are encrypted on disk (if encryption enabled)."""
    profile_id = auth_user["user"]["default_profile_id"]

    # Create conversation
    response = client.post(
        "/api/conversations",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )
    assert response.status_code == 200
    conv = response.json()
    conv_id = conv["id"]

    # Add a message via storage (simpler than SSE in test)
    storage.add_user_message(conv_id, "Secret message", profile_id)
    storage.add_assistant_message(
        conv_id,
        stage1=[{"model": "test", "response": "Secret response"}],
        stage2=[],
        stage3={"response": "Secret synthesis"},
        metadata={},
        profile_id=profile_id
    )

    # Check file on disk
    conv_path = storage.get_conversation_path(conv_id, profile_id)
    assert conv_path.exists()

    with open(conv_path, 'r') as f:
        disk_data = json.load(f)

    # Verify structure based on encryption setting
    if storage.ENCRYPTION_ENABLED:
        # Should be encrypted
        assert "_encryption" in disk_data
        assert "messages_encrypted" in disk_data
        assert "messages" not in disk_data  # No plaintext messages
    else:
        # Should be plaintext
        assert "messages" in disk_data
        assert "_encryption" not in disk_data

    # Verify we can read it back via API
    get_response = client.get(
        f"/api/conversations/{conv_id}",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )
    assert get_response.status_code == 200

    conv_loaded = get_response.json()
    assert len(conv_loaded["messages"]) == 2
    assert conv_loaded["messages"][0]["content"] == "Secret message"


def test_encryption_status_endpoint(client, auth_user, test_conversation_with_message):
    """Test getting encryption status of a conversation."""
    conv_id = test_conversation_with_message["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    response = client.get(
        f"/api/conversations/{conv_id}/encryption-status",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    assert response.status_code == 200
    data = response.json()

    assert "encrypted" in data
    assert "message_count" in data

    if storage.ENCRYPTION_ENABLED:
        assert data["encrypted"] is True
        assert "provider" in data
        assert "version" in data
    else:
        assert data["encrypted"] is False


def test_encrypt_conversation(client, auth_user, test_conversation_with_message):
    """Test encrypting a conversation via API."""
    conv_id = test_conversation_with_message["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    response = client.post(
        f"/api/conversations/{conv_id}/encrypt",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    # Should succeed or return 400 if already encrypted
    assert response.status_code in [200, 400]

    if response.status_code == 200:
        data = response.json()
        assert data["encrypted"] is True

        # Verify on disk
        conv_path = storage.get_conversation_path(conv_id, profile_id)
        with open(conv_path, 'r') as f:
            disk_data = json.load(f)

        assert "_encryption" in disk_data
        assert "messages_encrypted" in disk_data


def test_decrypt_conversation(client, auth_user, test_conversation_with_message):
    """Test decrypting a conversation via API."""
    conv_id = test_conversation_with_message["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    # First ensure it's encrypted
    client.post(
        f"/api/conversations/{conv_id}/encrypt",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    # Then decrypt
    response = client.post(
        f"/api/conversations/{conv_id}/decrypt",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    # Should succeed or return 400 if not encrypted
    assert response.status_code in [200, 400]

    if response.status_code == 200:
        data = response.json()
        assert data["encrypted"] is False

        # Verify on disk
        conv_path = storage.get_conversation_path(conv_id, profile_id)
        with open(conv_path, 'r') as f:
            disk_data = json.load(f)

        assert "messages" in disk_data  # Plaintext messages
        assert "_encryption" not in disk_data
