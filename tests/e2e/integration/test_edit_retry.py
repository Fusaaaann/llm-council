"""Integration test for edit and retry message functionality."""

import pytest
import requests
import time
import json
from playwright.sync_api import expect


def create_and_login_user(backend_url):
    """Helper to create user and get auth tokens."""
    email = f"edit-test-{int(time.time() * 1000)}@example.com"

    response = requests.post(
        f"{backend_url}/api/auth/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "name": "Edit Test User"
        }
    )
    assert response.status_code == 200

    data = response.json()
    return {
        "user": data["user"],
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "email": email
    }


def test_edit_message_removes_from_backend(backend_server, browser):
    """Test that editing a message removes it from backend storage."""
    auth_data = create_and_login_user(backend_server)
    profile_id = auth_data["user"]["default_profile_id"]

    context = browser.new_context()
    page = context.new_page()

    page.goto("http://localhost:5173")
    page.evaluate(f"""
        localStorage.setItem('llm_council_access_token', '{auth_data["access_token"]}');
        localStorage.setItem('llm_council_refresh_token', '{auth_data["refresh_token"]}');
        localStorage.setItem('llm_council_user', '{json.dumps(auth_data["user"])}');
        localStorage.setItem('llm_council_profile_id', '{profile_id}');
    """)
    page.reload()
    page.wait_for_selector('.sidebar', timeout=10000)

    # Create conversation and send message
    page.click('button:has-text("New Conversation")')
    page.fill('textarea[placeholder*="message"]', 'Original message')
    page.click('button:has-text("Send")')

    # Wait for completion
    expect(page.locator('.stage3-container')).to_be_visible(timeout=30000)

    # Get conversation ID
    conv_item = page.locator('.conversation-item.active')
    conv_id = conv_item.get_attribute('data-conversation-id')

    # Verify message in backend
    response = requests.get(
        f"{backend_server}/api/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        params={"profile_id": profile_id}
    )
    conv = response.json()
    assert len(conv["messages"]) == 2  # User + Assistant

    # Click edit button
    edit_button = page.locator('button:has-text("Edit")').last
    edit_button.click()

    # Verify message removed from backend
    response2 = requests.get(
        f"{backend_server}/api/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        params={"profile_id": profile_id}
    )
    conv2 = response2.json()
    assert len(conv2["messages"]) == 0  # Both messages removed

    # Verify input field has original text
    textarea = page.locator('textarea[placeholder*="message"]')
    text_value = textarea.input_value()
    assert text_value == 'Original message'

    # Cleanup
    page.close()
    context.close()


def test_retry_message_resends_query(backend_server, browser):
    """Test that retry removes assistant response and resends user message."""
    auth_data = create_and_login_user(backend_server)
    profile_id = auth_data["user"]["default_profile_id"]

    context = browser.new_context()
    page = context.new_page()

    page.goto("http://localhost:5173")
    page.evaluate(f"""
        localStorage.setItem('llm_council_access_token', '{auth_data["access_token"]}');
        localStorage.setItem('llm_council_refresh_token', '{auth_data["refresh_token"]}');
        localStorage.setItem('llm_council_user', '{json.dumps(auth_data["user"])}');
        localStorage.setItem('llm_council_profile_id', '{profile_id}');
    """)
    page.reload()
    page.wait_for_selector('.sidebar', timeout=10000)

    # Send message
    page.click('button:has-text("New Conversation")')
    page.fill('textarea[placeholder*="message"]', 'Retry test message')
    page.click('button:has-text("Send")')
    expect(page.locator('.stage3-container')).to_be_visible(timeout=30000)

    # Get conversation ID
    conv_item = page.locator('.conversation-item.active')
    conv_id = conv_item.get_attribute('data-conversation-id')

    # Click retry button
    retry_button = page.locator('button:has-text("Retry")').last
    retry_button.click()

    # Should start processing again
    expect(page.locator('text=Stage 1 Loading')).to_be_visible(timeout=5000)

    # Wait for completion
    expect(page.locator('.stage3-container')).to_be_visible(timeout=30000)

    # Verify backend has user message + new assistant response
    response = requests.get(
        f"{backend_server}/api/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        params={"profile_id": profile_id}
    )
    conv = response.json()
    assert len(conv["messages"]) == 2
    assert conv["messages"][0]["content"] == 'Retry test message'
    assert conv["messages"][1]["role"] == "assistant"

    # Cleanup
    page.close()
    context.close()


def test_cancel_message_aborts_stream(backend_server, browser):
    """Test that cancel button aborts ongoing stream."""
    auth_data = create_and_login_user(backend_server)
    profile_id = auth_data["user"]["default_profile_id"]

    context = browser.new_context()
    page = context.new_page()

    page.goto("http://localhost:5173")
    page.evaluate(f"""
        localStorage.setItem('llm_council_access_token', '{auth_data["access_token"]}');
        localStorage.setItem('llm_council_refresh_token', '{auth_data["refresh_token"]}');
        localStorage.setItem('llm_council_user', '{json.dumps(auth_data["user"])}');
        localStorage.setItem('llm_council_profile_id', '{profile_id}');
    """)
    page.reload()
    page.wait_for_selector('.sidebar', timeout=10000)

    # Send message
    page.click('button:has-text("New Conversation")')
    page.fill('textarea[placeholder*="message"]', 'Cancel test message')
    page.click('button:has-text("Send")')

    # Wait for processing to start
    expect(page.locator('text=Stage 1 Loading')).to_be_visible(timeout=5000)

    # Click cancel button
    cancel_button = page.locator('button:has-text("Cancel")')
    cancel_button.click()

    # Loading should stop
    expect(page.locator('text=Stage 1 Loading')).not_to_be_visible(timeout=5000)

    # Input should be enabled
    textarea = page.locator('textarea[placeholder*="message"]')
    expect(textarea).to_be_enabled()

    # Cleanup
    page.close()
    context.close()


def test_edit_after_multi_turn_conversation(backend_server, browser):
    """Test editing earlier message in multi-turn conversation."""
    auth_data = create_and_login_user(backend_server)
    profile_id = auth_data["user"]["default_profile_id"]

    context = browser.new_context()
    page = context.new_page()

    page.goto("http://localhost:5173")
    page.evaluate(f"""
        localStorage.setItem('llm_council_access_token', '{auth_data["access_token"]}');
        localStorage.setItem('llm_council_refresh_token', '{auth_data["refresh_token"]}');
        localStorage.setItem('llm_council_user', '{json.dumps(auth_data["user"])}');
        localStorage.setItem('llm_council_profile_id', '{profile_id}');
    """)
    page.reload()
    page.wait_for_selector('.sidebar', timeout=10000)

    # Send first message
    page.click('button:has-text("New Conversation")')
    page.fill('textarea[placeholder*="message"]', 'First message')
    page.click('button:has-text("Send")')
    expect(page.locator('.stage3-container')).to_be_visible(timeout=30000)

    # Send second message
    page.fill('textarea[placeholder*="message"]', 'Second message')
    page.click('button:has-text("Send")')
    expect(page.locator('.message-group').nth(1)).to_be_visible(timeout=30000)

    # Get conversation ID
    conv_item = page.locator('.conversation-item.active')
    conv_id = conv_item.get_attribute('data-conversation-id')

    # Should have 4 messages (2 user + 2 assistant)
    response = requests.get(
        f"{backend_server}/api/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        params={"profile_id": profile_id}
    )
    conv = response.json()
    assert len(conv["messages"]) == 4

    # Edit last message (should only show edit on last user message)
    edit_button = page.locator('button:has-text("Edit")').last
    edit_button.click()

    # Should remove last 2 messages (user + assistant)
    response2 = requests.get(
        f"{backend_server}/api/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        params={"profile_id": profile_id}
    )
    conv2 = response2.json()
    assert len(conv2["messages"]) == 2  # Only first turn remains

    # Input should have second message
    textarea = page.locator('textarea[placeholder*="message"]')
    text_value = textarea.input_value()
    assert text_value == 'Second message'

    # Cleanup
    page.close()
    context.close()
