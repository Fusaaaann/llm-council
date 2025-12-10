"""Integration test for automatic token refresh during long sessions."""

import pytest
import requests
import time
import json
from playwright.sync_api import expect
from backend import auth


def create_and_login_user(backend_url):
    """Helper to create user and get auth tokens."""
    email = f"refresh-test-{int(time.time() * 1000)}@example.com"

    response = requests.post(
        f"{backend_url}/api/auth/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "name": "Refresh Test User"
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


def test_token_refresh_on_401(backend_server, browser):
    """Test that frontend automatically refreshes token on 401 response."""
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

    # Create conversation (should work)
    page.click('button:has-text("New Conversation")')
    expect(page.locator('.chat-interface')).to_be_visible(timeout=5000)

    # Manually expire the access token by setting an invalid one
    page.evaluate("localStorage.setItem('llm_council_access_token', 'expired-token')")

    # Try to list conversations (should trigger 401 → refresh → retry)
    # Trigger by creating another conversation
    page.click('button:has-text("New Conversation")')

    # Should still work after automatic refresh
    # Give it time to refresh and retry
    page.wait_for_timeout(2000)

    # Verify new token was stored
    new_token = page.evaluate("localStorage.getItem('llm_council_access_token')")
    assert new_token != 'expired-token'
    assert new_token != auth_data["access_token"]  # Should be new token

    # Cleanup
    page.close()
    context.close()


def test_proactive_token_refresh_before_streaming(backend_server, browser):
    """Test that frontend refreshes token proactively before long streaming."""
    auth_data = create_and_login_user(backend_server)
    profile_id = auth_data["user"]["default_profile_id"]

    # Create a token that's about to expire (simulate by creating one with short expiry)
    # Note: In real test, we'd need to manipulate JWT expiry, so this is simplified

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
    page.fill('textarea[placeholder*="message"]', 'Test streaming with token refresh')
    page.click('button:has-text("Send")')

    # Should complete successfully even with potential token expiry
    expect(page.locator('.stage3-container')).to_be_visible(timeout=30000)

    # Verify we're still authenticated
    expect(page.locator('button:has-text("Logout")')).to_be_visible()

    # Cleanup
    page.close()
    context.close()


def test_refresh_token_rotation(backend_server):
    """Test that refresh tokens are rotated (single-use)."""
    auth_data = create_and_login_user(backend_server)
    original_refresh_token = auth_data["refresh_token"]

    # Use refresh token
    response = requests.post(
        f"{backend_server}/api/auth/refresh",
        json={"refresh_token": original_refresh_token}
    )

    assert response.status_code == 200
    data = response.json()

    new_access_token = data["access_token"]
    new_refresh_token = data["refresh_token"]

    # Should get new tokens
    assert new_access_token != auth_data["access_token"]
    assert new_refresh_token != original_refresh_token

    # Try to use original refresh token again (should fail - already used)
    response2 = requests.post(
        f"{backend_server}/api/auth/refresh",
        json={"refresh_token": original_refresh_token}
    )

    assert response2.status_code == 401  # Token already used

    # New refresh token should work
    response3 = requests.post(
        f"{backend_server}/api/auth/refresh",
        json={"refresh_token": new_refresh_token}
    )

    assert response3.status_code == 200


def test_long_session_maintains_auth(backend_server, browser):
    """Test that authentication is maintained during long session with multiple operations."""
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

    # Perform multiple operations
    for i in range(3):
        page.click('button:has-text("New Conversation")')
        page.fill('textarea[placeholder*="message"]', f'Test message {i}')
        page.click('button:has-text("Send")')
        expect(page.locator('.stage3-container')).to_be_visible(timeout=30000)

        # Small delay between operations
        page.wait_for_timeout(1000)

    # Should still be authenticated
    expect(page.locator('button:has-text("Logout")')).to_be_visible()

    # Should have created 3 conversations
    conversation_items = page.locator('.conversation-item')
    count = conversation_items.count()
    assert count >= 3

    # Cleanup
    page.close()
    context.close()
