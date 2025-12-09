"""Isolated SQLite storage for DSL workflows.

This module provides CRUD operations for workflow definitions,
isolated from the main storage module for clean separation of concerns.
"""

import json
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from contextlib import contextmanager

from backend.storage.database import DB_PATH


@contextmanager
def get_db_connection():
    """Get a thread-safe database connection with context manager."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
    finally:
        conn.close()


def init_workflows_table():
    """Initialize the workflows table if it doesn't exist."""
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Workflows table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                modified_at TEXT,
                data TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_workflows_profile_id
            ON workflows(profile_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_workflows_created_at
            ON workflows(created_at DESC)
        """)

        conn.commit()


def save_workflow_definition(
    workflow_id: str,
    profile_id: str,
    name: str,
    workflow: Dict[str, Any],
    description: Optional[str] = None
) -> Dict[str, Any]:
    """
    Save workflow definition to database.

    Args:
        workflow_id: Unique workflow identifier
        profile_id: Profile ID (owner)
        name: Human-readable name
        workflow: Complete workflow JSON
        description: Optional description

    Returns:
        Workflow metadata dict
    """
    now = datetime.utcnow().isoformat() + 'Z'

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check if workflow exists
        cursor.execute("""
            SELECT id FROM workflows WHERE id = ?
        """, (workflow_id,))

        exists = cursor.fetchone() is not None

        if exists:
            # Update existing workflow
            cursor.execute("""
                UPDATE workflows
                SET name = ?, description = ?, modified_at = ?, data = ?
                WHERE id = ? AND profile_id = ?
            """, (
                name,
                description,
                now,
                json.dumps(workflow),
                workflow_id,
                profile_id
            ))
        else:
            # Insert new workflow
            cursor.execute("""
                INSERT INTO workflows
                (id, profile_id, name, description, created_at, modified_at, data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                workflow_id,
                profile_id,
                name,
                description,
                now,
                now,
                json.dumps(workflow)
            ))

        conn.commit()

        # Fetch to get created_at if updated
        cursor.execute("""
            SELECT created_at FROM workflows WHERE id = ?
        """, (workflow_id,))
        row = cursor.fetchone()
        created_at = row['created_at'] if row else now

    return {
        'id': workflow_id,
        'profile_id': profile_id,
        'name': name,
        'description': description,
        'created_at': created_at,
        'modified_at': now,
        'workflow': workflow
    }


def get_workflow_definition(
    workflow_id: str,
    profile_id: str
) -> Optional[Dict[str, Any]]:
    """
    Get workflow definition by ID.

    Args:
        workflow_id: Workflow ID
        profile_id: Profile ID (for ownership check)

    Returns:
        Workflow dict or None if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, profile_id, name, description, created_at, modified_at, data
            FROM workflows
            WHERE id = ? AND profile_id = ?
        """, (workflow_id, profile_id))

        row = cursor.fetchone()

        if not row:
            return None

        return {
            'id': row['id'],
            'profile_id': row['profile_id'],
            'name': row['name'],
            'description': row['description'],
            'created_at': row['created_at'],
            'modified_at': row['modified_at'],
            'workflow': json.loads(row['data'])
        }


def list_workflow_definitions(profile_id: str) -> List[Dict[str, Any]]:
    """
    List all workflows for a profile.

    Args:
        profile_id: Profile ID

    Returns:
        List of workflow metadata dicts (without full workflow data)
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, profile_id, name, description, created_at, modified_at, data
            FROM workflows
            WHERE profile_id = ?
            ORDER BY created_at DESC
        """, (profile_id,))

        rows = cursor.fetchall()

        workflows = []
        for row in rows:
            workflow_data = json.loads(row['data'])

            # Count supersteps and workers
            superstep_count = len(workflow_data.get('supersteps', []))
            worker_count = sum(
                len(s.get('map_phase', {}).get('workers', []))
                for s in workflow_data.get('supersteps', [])
            )

            workflows.append({
                'id': row['id'],
                'profile_id': row['profile_id'],
                'name': row['name'],
                'description': row['description'],
                'created_at': row['created_at'],
                'modified_at': row['modified_at'],
                'superstep_count': superstep_count,
                'worker_count': worker_count
            })

        return workflows


def delete_workflow_definition(
    workflow_id: str,
    profile_id: str
) -> bool:
    """
    Delete workflow definition.

    Args:
        workflow_id: Workflow ID
        profile_id: Profile ID (for ownership check)

    Returns:
        True if deleted, False if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM workflows
            WHERE id = ? AND profile_id = ?
        """, (workflow_id, profile_id))

        conn.commit()

        return cursor.rowcount > 0


def validate_workflow_ownership(
    workflow_id: str,
    profile_id: str
) -> bool:
    """
    Check if profile owns workflow.

    Args:
        workflow_id: Workflow ID
        profile_id: Profile ID

    Returns:
        True if profile owns workflow
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 1 FROM workflows
            WHERE id = ? AND profile_id = ?
        """, (workflow_id, profile_id))

        return cursor.fetchone() is not None


def count_workflows_using_workflow(workflow_id: str) -> int:
    """
    Count how many conversations use a specific workflow.

    Args:
        workflow_id: Workflow ID

    Returns:
        Count of conversations using this workflow
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check if conversations table has workflow_id column
        cursor.execute("PRAGMA table_info(conversations)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'workflow_id' not in columns:
            return 0

        cursor.execute("""
            SELECT COUNT(*) as count
            FROM conversations
            WHERE workflow_id = ?
        """, (workflow_id,))

        row = cursor.fetchone()
        return row['count'] if row else 0


# Initialize table on module import
init_workflows_table()
