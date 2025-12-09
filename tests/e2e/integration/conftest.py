"""Pytest fixtures for integration tests."""

import os
import sys
import pytest
import asyncio
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

# Set test environment
os.environ["ENVIRONMENT"] = "local"
os.environ["JWT_SECRET_KEY"] = "test-secret-integration"
os.environ["ENCRYPTION_ENABLED"] = "false"

from backend.main import app
from backend.storage import database
from tests.mocks.openrouter_mock import mock_query_model, mock_query_models_parallel
import uvicorn

# Monkey patch OpenRouter
import backend.openrouter
backend.openrouter.query_model = mock_query_model
backend.openrouter.query_models_parallel = mock_query_models_parallel


@pytest.fixture(scope="session")
def backend_server():
    """Start backend server in background thread."""
    # Configure test storage
    test_dir = Path(__file__).parent.parent.parent.parent / "data_integration_test"
    test_dir.mkdir(exist_ok=True)

    # Override storage paths for SQLite database
    database.DATA_DIR = test_dir

    # Start server in thread
    server_thread = threading.Thread(
        target=lambda: uvicorn.run(app, host="127.0.0.1", port=8003, log_level="error"),
        daemon=True
    )
    server_thread.start()

    # Wait for server to be ready
    time.sleep(3)

    yield "http://127.0.0.1:8003"

    # Cleanup
    import shutil
    if test_dir.exists():
        shutil.rmtree(test_dir)


@pytest.fixture(scope="session")
def browser():
    """Create Playwright browser instance."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser):
    """Create new page for each test."""
    context = browser.new_context()
    page = context.new_page()
    yield page
    page.close()
    context.close()
