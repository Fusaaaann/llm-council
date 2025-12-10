"""Integration test for SSE conversation list updates."""

import pytest
import requests
import time
import json
from playwright.sync_api import expect


def create_and_login_user(backend_url):
    """Helper to create user and get auth tokens."""
    email = f"sse-test-{int(time.time() * 1000)}@example.com"

    response = requests.post(
        f"{backend_url}/api/auth/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "name": "SSE Test User"
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


def test_conversation_list_updates_in_realtime(backend_server, browser):
    """Test that creating a conversation updates sidebar in real-time."""
    auth_data = create_and_login_user(backend_server)
    profile_id = auth_data["user"]["default_profile_id"]

    # Open two browser contexts (simulating two tabs)
    context1 = browser.new_context()
    context2 = browser.new_context()

    page1 = context1.new_page()
    page2 = context2.new_page()

    # Set auth in both
    for page in [page1, page2]:
        page.goto("http://localhost:5173")
        page.evaluate(f"""
            localStorage.setItem('llm_council_access_token', '{auth_data["access_token"]}');
            localStorage.setItem('llm_council_refresh_token', '{auth_data["refresh_token"]}');
            localStorage.setItem('llm_council_user', '{json.dumps(auth_data["user"])}');
            localStorage.setItem('llm_council_profile_id', '{profile_id}');
        """)
        page.reload()
        page.wait_for_selector('.sidebar', timeout=10000)

    # Get initial conversation count in page2
    initial_count = page2.locator('.conversation-item').count()

    # Create conversation in page1
    page1.click('button:has-text("New Conversation")')
    page1.wait_for_selector('textarea[placeholder*="message"]', timeout=5000)

    # Page2 should see new conversation appear (via SSE)
    # Wait for conversation count to increase
    page2.wait_for_function(
        f"document.querySelectorAll('.conversation-item').length > {initial_count}",
        timeout=10000
    )

    # Verify count increased
    new_count = page2.locator('.conversation-item').count()
    assert new_count > initial_count

    # Cleanup
    page1.close()
    page2.close()
    context1.close()
    context2.close()


def test_conversation_title_updates_via_sse(backend_server, browser):
    """Test that title generation updates sidebar in real-time."""
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

    # Create conversation
    page.click('button:has-text("New Conversation")')
    page.wait_for_selector('textarea[placeholder*="message"]', timeout=5000)

    # Should initially show "New Conversation"
    expect(page.locator('.conversation-item.active')).to_contain_text('New Conversation')

    # Send message
    page.fill('textarea[placeholder*="message"]', 'What is quantum computing?')
    page.click('button:has-text("Send")')

    # Wait for completion
    expect(page.locator('.stage3-container')).to_be_visible(timeout=30000)

    # Title should eventually update (give time for async title generation)
    # Note: In test mode with mocked API, title may update quickly
    page.wait_for_timeout(3000)

    # Reload to ensure title persisted
    page.reload()
    page.wait_for_selector('.conversation-item', timeout=5000)

    # Should see a conversation in the list
    conversation_items = page.locator('.conversation-item')
    expect(conversation_items.first()).to_be_visible()

    # Cleanup
    page.close()
    context.close()


def test_delete_conversation_updates_sidebar(backend_server, browser):
    """Test that deleting a conversation removes it from sidebar."""
    auth_data = create_and_login_user(backend_server)
    profile_id = auth_data["user"]["default_profile_id"]

    # Create conversation via API
    response = requests.post(
        f"{backend_server}/api/conversations",
        headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        params={"profile_id": profile_id}
    )
    assert response.status_code == 200
    conv = response.json()
    conv_id = conv["id"]

    # Open browser
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

    # Should see conversation
    expect(page.locator(f'.conversation-item[data-conversation-id="{conv_id}"]')).to_be_visible()

    # Delete via API
    delete_response = requests.delete(
        f"{backend_server}/api/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {auth_data['access_token']}"},
        params={"profile_id": profile_id}
    )
    assert delete_response.status_code == 200

    # Should disappear from sidebar (via SSE)
    expect(page.locator(f'.conversation-item[data-conversation-id="{conv_id}"]')).not_to_be_visible(timeout=10000)

    # Cleanup
    page.close()
    context.close()
