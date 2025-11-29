"""Pytest fixtures for backend E2E tests."""

import os
import sys
import pytest
import shutil
from pathlib import Path
from fastapi.testclient import TestClient

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

# Set test environment before importing backend modules
os.environ["ENVIRONMENT"] = "local"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-e2e-testing-only"
os.environ["ENCRYPTION_ENABLED"] = "false"  # Simplify tests

from backend.main import app
from backend import storage, auth
from tests.mocks.openrouter_mock import mock_query_model, mock_query_models_parallel

# Monkey patch OpenRouter functions
import backend.openrouter
backend.openrouter.query_model = mock_query_model
backend.openrouter.query_models_parallel = mock_query_models_parallel


@pytest.fixture(scope="session")
def test_data_dir():
    """Create temporary data directory for tests."""
    test_dir = Path(__file__).parent.parent.parent.parent / "data_test"
    test_dir.mkdir(exist_ok=True)

    # Override storage paths
    storage.DATA_DIR = test_dir
    storage.CONVERSATIONS_DIR = test_dir / "conversations"
    storage.PROFILES_FILE = test_dir / "profiles.json"
    storage.USERS_FILE = test_dir / "users.json"
    storage.SESSIONS_FILE = test_dir / "sessions.json"
    storage.WAITLIST_FILE = test_dir / "waitlist.json"
    storage.INVITES_FILE = test_dir / "invites.json"

    yield test_dir

    # Cleanup after all tests
    if test_dir.exists():
        shutil.rmtree(test_dir)


@pytest.fixture(scope="function")
def client(test_data_dir):
    """Create test client for each test."""
    # Clean data directory before each test
    if (test_data_dir / "conversations").exists():
        shutil.rmtree(test_data_dir / "conversations")
    (test_data_dir / "conversations").mkdir(exist_ok=True)

    # Clean user/session files
    for file in [storage.USERS_FILE, storage.SESSIONS_FILE, storage.PROFILES_FILE]:
        if file.exists():
            file.unlink()

    with TestClient(app) as client:
        yield client


@pytest.fixture
def auth_user(client):
    """Create and authenticate a test user."""
    # Register user
    register_data = {
        "email": "test@example.com",
        "password": "TestPassword123!",
        "name": "Test User"
    }
    response = client.post("/api/auth/register", json=register_data)
    assert response.status_code == 200

    auth_data = response.json()
    access_token = auth_data["access_token"]
    refresh_token = auth_data["refresh_token"]
    user = auth_data["user"]

    return {
        "user": user,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "headers": {"Authorization": f"Bearer {access_token}"}
    }


@pytest.fixture
def test_conversation(client, auth_user):
    """Create a test conversation."""
    response = client.post(
        "/api/conversations",
        headers=auth_user["headers"],
        params={"profile_id": auth_user["user"]["default_profile_id"]}
    )
    assert response.status_code == 200

    conv = response.json()
    return conv


@pytest.fixture
def test_conversation_with_message(client, auth_user, test_conversation):
    """Create a conversation with a message (non-streaming for simplicity)."""
    # For tests, we'll use the conversation directly via storage
    # to avoid SSE complexity in fixtures
    conv_id = test_conversation["id"]
    profile_id = auth_user["user"]["default_profile_id"]

    # Add user message
    storage.add_user_message(conv_id, "Test question for the council?", profile_id)

    # Add mock assistant response
    storage.add_assistant_message(
        conv_id,
        stage1=[
            {"model": "model-a", "response": "Response from Model A"},
            {"model": "model-b", "response": "Response from Model B"}
        ],
        stage1_5={
            "questions": [
                {"model": "model-a", "questions": "Question for B?"},
                {"model": "model-b", "questions": "Question for A?"}
            ],
            "answers": [
                {"model": "model-a", "original_response": "Response from Model A", "questions": ["Question for A?"], "answers": "Answer from A"},
                {"model": "model-b", "original_response": "Response from Model B", "questions": ["Question for B?"], "answers": "Answer from B"}
            ],
            "label_to_model": {"Response A": "model-a", "Response B": "model-b"}
        },
        stage2=[
            {"model": "model-a", "ranking": "1. Response B\n2. Response A", "parsed_ranking": ["Response B", "Response A"]},
            {"model": "model-b", "ranking": "1. Response A\n2. Response B", "parsed_ranking": ["Response A", "Response B"]}
        ],
        stage3={"model": "chairman", "response": "Final synthesized answer from chairman."},
        metadata={
            "label_to_model": {"Response A": "model-a", "Response B": "model-b"},
            "aggregate_rankings": [
                {"model": "model-a", "average_rank": 1.5, "rankings_count": 2},
                {"model": "model-b", "average_rank": 1.5, "rankings_count": 2}
            ]
        },
        profile_id=profile_id
    )

    # Reload conversation
    conv = storage.get_conversation(conv_id, profile_id)
    return conv
