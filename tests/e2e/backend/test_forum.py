"""E2E tests for forum (public conversations)."""

import pytest


def test_publish_conversation(client, auth_user, test_conversation_with_message):
    """Test publishing a conversation to the forum."""
    conv_id = test_conversation_with_message["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    response = client.post(
        f"/api/conversations/{conv_id}/publish",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == conv_id
    assert data["is_public"] is True
    assert "published_at" in data
    assert data["published_at"] is not None


def test_list_public_conversations(client, auth_user, test_conversation_with_message):
    """Test listing all public conversations."""
    conv_id = test_conversation_with_message["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    # Publish the conversation first
    client.post(
        f"/api/conversations/{conv_id}/publish",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    # List public conversations (no auth required)
    response = client.get("/api/forum/conversations")

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= 1

    # Find our published conversation
    conv_ids = [c["id"] for c in data]
    assert conv_id in conv_ids

    # Verify metadata
    published_conv = next(c for c in data if c["id"] == conv_id)
    assert published_conv["is_public"] is True
    assert "message_count" in published_conv


def test_get_public_conversation(client, auth_user, test_conversation_with_message):
    """Test getting a specific public conversation without auth."""
    conv_id = test_conversation_with_message["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    # Publish first
    client.post(
        f"/api/conversations/{conv_id}/publish",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    # Get public conversation (no auth required)
    response = client.get(f"/api/forum/conversations/{conv_id}")

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == conv_id
    assert data["is_public"] is True
    assert len(data["messages"]) > 0


def test_unpublish_conversation(client, auth_user, test_conversation_with_message):
    """Test unpublishing a conversation from the forum."""
    conv_id = test_conversation_with_message["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    # Publish first
    client.post(
        f"/api/conversations/{conv_id}/publish",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    # Then unpublish
    response = client.delete(
        f"/api/conversations/{conv_id}/unpublish",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == conv_id
    assert data["is_public"] is False
    assert data["published_at"] is None

    # Verify it's no longer in public list
    public_response = client.get("/api/forum/conversations")
    public_data = public_response.json()
    public_ids = [c["id"] for c in public_data]

    assert conv_id not in public_ids


def test_cannot_get_private_conversation_from_forum(client, auth_user, test_conversation_with_message):
    """Test that private conversations cannot be accessed via forum endpoint."""
    conv_id = test_conversation_with_message["id"]

    # Don't publish - try to get as public
    response = client.get(f"/api/forum/conversations/{conv_id}")

    assert response.status_code == 404
