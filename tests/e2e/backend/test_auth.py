"""E2E tests for authentication flow."""

import pytest


def test_register_success(client):
    """Test successful user registration."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "name": "New User"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert "user" in data
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["name"] == "New User"
    assert "id" in data["user"]
    assert "default_profile_id" in data["user"]


def test_login_success(client):
    """Test successful login with registered user."""
    # First register
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "logintest@example.com",
            "password": "TestPass123!",
            "name": "Login Test"
        }
    )
    assert register_response.status_code == 200

    # Then login
    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "logintest@example.com",
            "password": "TestPass123!"
        }
    )

    assert login_response.status_code == 200
    data = login_response.json()

    assert "user" in data
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "logintest@example.com"


def test_refresh_token(client):
    """Test token refresh flow."""
    # Register user
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "refreshtest@example.com",
            "password": "TestPass123!",
            "name": "Refresh Test"
        }
    )
    assert register_response.status_code == 200
    refresh_token = register_response.json()["refresh_token"]

    # Refresh token
    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token}
    )

    assert refresh_response.status_code == 200
    data = refresh_response.json()

    assert "access_token" in data
    assert "refresh_token" in data  # Should get new refresh token (rotation)
    assert data["token_type"] == "bearer"

    # Verify new refresh token is different (rotation)
    assert data["refresh_token"] != refresh_token


def test_get_current_user(client, auth_user):
    """Test getting current user info with valid token."""
    response = client.get(
        "/api/auth/me",
        headers=auth_user["headers"]
    )

    assert response.status_code == 200
    data = response.json()

    assert data["email"] == auth_user["user"]["email"]
    assert data["name"] == auth_user["user"]["name"]
    assert data["id"] == auth_user["user"]["id"]


def test_logout(client, auth_user):
    """Test logout (token revocation)."""
    response = client.post(
        "/api/auth/logout",
        headers=auth_user["headers"],
        json={"refresh_token": auth_user["refresh_token"]}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Logged out successfully"

    # Verify refresh token is now invalid
    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": auth_user["refresh_token"]}
    )
    assert refresh_response.status_code == 401
