"""E2E tests for conversation CRUD operations."""

import pytest


def test_create_conversation(client, auth_user):
    """Test creating a new conversation."""
    response = client.post(
        "/api/conversations",
        headers=auth_user["headers"],
        params={"profile_id": auth_user["user"]["default_profile_id"]}
    )

    assert response.status_code == 200
    data = response.json()

    assert "id" in data
    assert data["profile_id"] == auth_user["user"]["default_profile_id"]
    assert data["title"] == "New Conversation"
    assert data["messages"] == []
    assert data["is_public"] is False
    assert data["uses_byok"] is False


def test_get_conversation(client, auth_user, test_conversation):
    """Test retrieving a conversation by ID."""
    conv_id = test_conversation["id"]

    response = client.get(
        f"/api/conversations/{conv_id}",
        headers=auth_user["headers"],
        params={"profile_id": auth_user["user"]["default_profile_id"]}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == conv_id
    assert data["profile_id"] == auth_user["user"]["default_profile_id"]


def test_list_conversations(client, auth_user, test_conversation):
    """Test listing conversations."""
    response = client.get(
        "/api/conversations",
        headers=auth_user["headers"],
        params={
            "profile_id": auth_user["user"]["default_profile_id"],
            "view": "private"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= 1

    # Find our test conversation
    conv_ids = [c["id"] for c in data]
    assert test_conversation["id"] in conv_ids


def test_rename_conversation(client, auth_user, test_conversation):
    """Test renaming a conversation."""
    conv_id = test_conversation["id"]
    new_title = "Renamed Conversation Title"

    response = client.patch(
        f"/api/conversations/{conv_id}/rename",
        headers=auth_user["headers"],
        params={"profile_id": auth_user["user"]["default_profile_id"]},
        json={"title": new_title}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == conv_id
    assert data["title"] == new_title


def test_delete_conversation(client, auth_user, test_conversation):
    """Test deleting a conversation."""
    conv_id = test_conversation["id"]

    response = client.delete(
        f"/api/conversations/{conv_id}",
        headers=auth_user["headers"],
        params={"profile_id": auth_user["user"]["default_profile_id"]}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Conversation deleted"

    # Verify it's gone
    get_response = client.get(
        f"/api/conversations/{conv_id}",
        headers=auth_user["headers"],
        params={"profile_id": auth_user["user"]["default_profile_id"]}
    )
    assert get_response.status_code == 404


def test_conversation_with_message(client, auth_user, test_conversation_with_message):
    """Test retrieving a conversation that has messages."""
    conv = test_conversation_with_message

    response = client.get(
        f"/api/conversations/{conv['id']}",
        headers=auth_user["headers"],
        params={"profile_id": auth_user["user"]["default_profile_id"]}
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["messages"]) == 2  # User + Assistant
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][1]["role"] == "assistant"

    # Verify assistant message structure
    assistant_msg = data["messages"][1]
    assert "stage1" in assistant_msg
    assert "stage1_5" in assistant_msg
    assert "stage2" in assistant_msg
    assert "stage3" in assistant_msg
    assert "metadata" in assistant_msg

    # Verify stages have content
    assert len(assistant_msg["stage1"]) > 0
    assert len(assistant_msg["stage2"]) > 0
    assert assistant_msg["stage3"]["response"]
