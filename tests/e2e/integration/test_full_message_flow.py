"""Integration test for full message flow (frontend → backend → frontend)."""

import pytest
import requests
from playwright.sync_api import expect


def create_and_login_user(backend_url):
    """Helper to create user and get auth tokens."""
    email = f"integration-test-{int(time.time() * 1000)}@example.com"

    # Register
    response = requests.post(
        f"{backend_url}/api/auth/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "name": "Integration Test User"
        }
    )
    assert response.status_code == 200

    data = response.json()
    return {
        "user": data["user"],
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "email": email,
        "password": "TestPass123!"
    }


def test_full_message_flow(backend_server, page):
    """Test complete flow: send message → backend processes → all stages displayed."""
    import time

    # Create user via API
    auth_data = create_and_login_user(backend_server)

    # Set auth tokens in browser
    page.goto("http://localhost:5173")

    page.evaluate(f"""
        localStorage.setItem('llm_council_access_token', '{auth_data["access_token"]}');
        localStorage.setItem('llm_council_refresh_token', '{auth_data["refresh_token"]}');
        localStorage.setItem('llm_council_user', '{json.dumps(auth_data["user"])}');
        localStorage.setItem('llm_council_profile_id', '{auth_data["user"]["default_profile_id"]}');
    """)

    page.reload()
    page.wait_for_selector('.sidebar', timeout=10000)

    # Create new conversation
    page.click('button:has-text("New Conversation")')
    page.wait_for_selector('textarea[placeholder*="message"]', timeout=5000)

    # Send message
    page.fill('textarea[placeholder*="message"]', 'What is the capital of France?')
    page.click('button:has-text("Send")')

    # Verify Stage 1 appears
    expect(page.locator('.stage1-container')).to_be_visible(timeout=30000)

    # Verify Stage 1.5 appears
    expect(page.locator('.stage1_5-container')).to_be_visible(timeout=30000)

    # Verify Stage 2 appears
    expect(page.locator('.stage2-container')).to_be_visible(timeout=30000)

    # Verify Stage 3 appears
    expect(page.locator('.stage3-container')).to_be_visible(timeout=30000)

    # Verify backend actually stored the conversation
    conv_items = page.locator('.conversation-item.active')
    conv_id = conv_items.get_attribute('data-conversation-id')

    # Query backend directly
    response = requests.get(
        f"{backend_server}/api/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        params={"profile_id": auth_data["user"]["default_profile_id"]}
    )

    assert response.status_code == 200
    conv = response.json()

    # Verify structure
    assert len(conv["messages"]) == 2  # User + Assistant
    assert conv["messages"][0]["content"] == "What is the capital of France?"
    assert "stage1" in conv["messages"][1]
    assert "stage1_5" in conv["messages"][1]
    assert "stage2" in conv["messages"][1]
    assert "stage3" in conv["messages"][1]
    assert "metadata" in conv["messages"][1]


def test_message_stages_have_content(backend_server, page):
    """Verify each stage contains actual model responses."""
    import time
    import json

    auth_data = create_and_login_user(backend_server)

    page.goto("http://localhost:5173")
    page.evaluate(f"""
        localStorage.setItem('llm_council_access_token', '{auth_data["access_token"]}');
        localStorage.setItem('llm_council_refresh_token', '{auth_data["refresh_token"]}');
        localStorage.setItem('llm_council_user', '{json.dumps(auth_data["user"])}');
        localStorage.setItem('llm_council_profile_id', '{auth_data["user"]["default_profile_id"]}');
    """)
    page.reload()
    page.wait_for_selector('.sidebar', timeout=10000)

    # Send message
    page.click('button:has-text("New Conversation")')
    page.fill('textarea[placeholder*="message"]', 'Test question?')
    page.click('button:has-text("Send")')

    # Wait for completion
    expect(page.locator('.stage3-container')).to_be_visible(timeout=30000)

    # Get conversation from backend
    conv_items = page.locator('.conversation-item.active')
    conv_id = conv_items.get_attribute('data-conversation-id')

    response = requests.get(
        f"{backend_server}/api/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        params={"profile_id": auth_data["user"]["default_profile_id"]}
    )

    conv = response.json()
    assistant_msg = conv["messages"][1]

    # Verify Stage 1 has responses
    assert len(assistant_msg["stage1"]) > 0
    for resp in assistant_msg["stage1"]:
        assert "model" in resp
        assert "response" in resp
        assert len(resp["response"]) > 0

    # Verify Stage 1.5 structure
    assert "questions" in assistant_msg["stage1_5"]
    assert "answers" in assistant_msg["stage1_5"]
    assert len(assistant_msg["stage1_5"]["questions"]) > 0
    assert len(assistant_msg["stage1_5"]["answers"]) > 0

    # Verify Stage 2 has rankings
    assert len(assistant_msg["stage2"]) > 0
    for ranking in assistant_msg["stage2"]:
        assert "model" in ranking
        assert "ranking" in ranking
        assert len(ranking["ranking"]) > 0

    # Verify Stage 3 has synthesis
    assert "response" in assistant_msg["stage3"]
    assert len(assistant_msg["stage3"]["response"]) > 0

    # Verify metadata
    assert "label_to_model" in assistant_msg["metadata"]
    assert "aggregate_rankings" in assistant_msg["metadata"]


import json
import time
