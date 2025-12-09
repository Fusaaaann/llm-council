"""Core database layer for SQLite storage.

This module provides the fundamental database connection and initialization functions.
No internal storage module dependencies - this is the foundation layer.
"""
# Database path
from datetime import datetime
import json
from pathlib import Path
import sqlite3
from contextlib import contextmanager

from backend.config import DATA_DIR, DEFAULT_PROFILE_ID


DB_PATH = "data/data.sqlite"


@contextmanager
def get_db_connection():
    """Get a thread-safe database connection with context manager."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
    finally:
        conn.close()


def init_database():
    """Initialize the database schema if it doesn't exist."""
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Conversations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                modified_at TEXT,
                title TEXT,
                is_public BOOLEAN DEFAULT 0,
                uses_byok BOOLEAN DEFAULT 0,
                data TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversations_profile_id
            ON conversations(profile_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversations_created_at
            ON conversations(created_at)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversations_is_public
            ON conversations(is_public)
        """)

        # Profiles table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                data TEXT NOT NULL
            )
        """)

        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                data TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users(email)
        """)

        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT,
                created_at TEXT NOT NULL,
                expires_at TEXT,
                data TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id
            ON sessions(user_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
            ON sessions(expires_at)
        """)

        conn.commit()

        # Create default profile if it doesn't exist
        cursor.execute("SELECT id FROM profiles WHERE id = ?", (DEFAULT_PROFILE_ID,))
        if not cursor.fetchone():
            default_profile = {
                "id": DEFAULT_PROFILE_ID,
                "name": "Default Profile",
                "created_at": datetime.utcnow().isoformat(),
                "settings": {}
            }
            cursor.execute(
                "INSERT INTO profiles (id, name, created_at, data) VALUES (?, ?, ?, ?)",
                (DEFAULT_PROFILE_ID, "Default Profile", default_profile["created_at"], json.dumps(default_profile))
            )
            conn.commit()


def ensure_data_dir():
    """Ensure the data directory exists."""
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    init_database()
