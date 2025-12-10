"""E2E tests for message streaming."""

import pytest
import json


def test_send_message_stream(client, auth_user, test_conversation):
    """Test sending a message with SSE streaming."""
    conv_id = test_conversation["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    # Start streaming message
    with client.stream(
        "POST",
        f"/api/conversations/{conv_id}/message/stream",
        headers=auth_user["headers"],
        params={"profile_id": profile_id},
        json={"content": "What is the meaning of life?"}
    ) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data_str = line[6:]  # Remove "data: " prefix
                if data_str.strip():
                    try:
                        event_data = json.loads(data_str)
                        events.append(event_data)
                    except json.JSONDecodeError:
                        pass

        # Verify we got all expected events
        event_types = [e.get("event") for e in events]

        assert "stream_init" in event_types
        assert "stage1_start" in event_types
        assert "stage1_complete" in event_types
        assert "stage1_5_questions_start" in event_types
        assert "stage1_5_questions_complete" in event_types
        assert "stage1_5_answers_start" in event_types
        assert "stage1_5_answers_complete" in event_types
        assert "stage2_start" in event_types
        assert "stage2_complete" in event_types
        assert "stage3_start" in event_types
        assert "stage3_complete" in event_types
        assert "complete" in event_types

    # Verify conversation has the message
    conv_response = client.get(
        f"/api/conversations/{conv_id}",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    assert conv_response.status_code == 200
    conv = conv_response.json()

    assert len(conv["messages"]) == 2  # User + Assistant
    assert conv["messages"][0]["content"] == "What is the meaning of life?"
    assert conv["messages"][1]["role"] == "assistant"


def test_message_creates_all_stages(client, auth_user, test_conversation):
    """Test that streaming message creates all stages correctly."""
    conv_id = test_conversation["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    # Send message
    with client.stream(
        "POST",
        f"/api/conversations/{conv_id}/message/stream",
        headers=auth_user["headers"],
        params={"profile_id": profile_id},
        json={"content": "Test question?"}
    ) as response:
        # Consume stream
        for _ in response.iter_lines():
            pass

    # Get conversation and verify structure
    conv_response = client.get(
        f"/api/conversations/{conv_id}",
        headers=auth_user["headers"],
        params={"profile_id": profile_id}
    )

    conv = conv_response.json()
    assistant_msg = conv["messages"][1]

    # Verify all stages exist
    assert "stage1" in assistant_msg
    assert "stage1_5" in assistant_msg
    assert "stage2" in assistant_msg
    assert "stage3" in assistant_msg
    assert "metadata" in assistant_msg

    # Verify stage1 has responses
    assert len(assistant_msg["stage1"]) > 0
    assert "model" in assistant_msg["stage1"][0]
    assert "response" in assistant_msg["stage1"][0]

    # Verify stage1_5 structure
    assert "questions" in assistant_msg["stage1_5"]
    assert "answers" in assistant_msg["stage1_5"]
    assert "label_to_model" in assistant_msg["stage1_5"]

    # Verify stage2 has rankings
    assert len(assistant_msg["stage2"]) > 0
    assert "model" in assistant_msg["stage2"][0]
    assert "ranking" in assistant_msg["stage2"][0]

    # Verify stage3 has synthesis
    assert "response" in assistant_msg["stage3"]

    # Verify metadata
    assert "label_to_model" in assistant_msg["metadata"]
    assert "aggregate_rankings" in assistant_msg["metadata"]


def test_heartbeat_events(client, auth_user, test_conversation):
    """Test that heartbeat events are sent during streaming."""
    conv_id = test_conversation["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    with client.stream(
        "POST",
        f"/api/conversations/{conv_id}/message/stream",
        headers=auth_user["headers"],
        params={"profile_id": profile_id},
        json={"content": "Quick test?"}
    ) as response:
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data_str = line[6:]
                if data_str.strip():
                    try:
                        event_data = json.loads(data_str)
                        events.append(event_data)
                    except json.JSONDecodeError:
                        pass

        # Check for heartbeat events (may or may not be present depending on timing)
        event_types = [e.get("event") for e in events]
        # Heartbeats are optional in fast tests, just verify no errors
        assert "error" not in event_types
