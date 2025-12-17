"""Simple test to verify scope_alignment module loads correctly"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.scope_alignment import (
    _extract_all_workers,
    _format_scope_as_instruction,
    _fallback_to_original_scopes
)

def test_extract_workers():
    """Test worker extraction - synchronous test"""
    workflow_def = {
        "supersteps": [
            {
                "map_phase": {
                    "workers": [
                        {
                            "worker_id": "worker1",
                            "model_ref": "openai/gpt-4o",
                            "instruction": "Do task 1"
                        },
                        {
                            "worker_id": "worker2",
                            "model_ref": "anthropic/claude-3.5-sonnet",
                            "instruction": "Do task 2"
                        }
                    ]
                }
            }
        ]
    }

    workers = _extract_all_workers(workflow_def)

    print(f"✓ Extracted {len(workers)} workers")
    assert len(workers) == 2
    assert workers[0]["worker_id"] == "worker1"
    assert workers[1]["worker_id"] == "worker2"
    print("✓ Worker IDs correct")
    assert workers[0]["model_ref"] == "openai/gpt-4o"
    assert workers[1]["model_ref"] == "anthropic/claude-3.5-sonnet"
    print("✓ Model refs correct")
    assert workers[0]["instruction"] == "Do task 1"
    assert workers[1]["instruction"] == "Do task 2"
    print("✓ Instructions correct")


def test_format_scope():
    """Test scope formatting"""
    scope_data = {
        "primary_responsibility": "Collect data",
        "boundaries": "No analysis",
        "dependencies": "None",
        "definition_of_done": "Data collected"
    }

    formatted = _format_scope_as_instruction(scope_data)

    print(f"✓ Formatted scope:\n{formatted}")
    assert "OPERATIONAL SCOPE (DO NOT DEVIATE):" in formatted
    assert "Primary Responsibility: Collect data" in formatted
    assert "Boundaries: No analysis" in formatted


def test_fallback_scopes():
    """Test fallback scope formatting"""
    agent_scopes = {
        "worker1": "PRIMARY: Task 1",
        "worker2": "PRIMARY: Task 2"
    }

    fallback_map = _fallback_to_original_scopes(agent_scopes)

    print(f"✓ Fallback map has {len(fallback_map)} entries")
    assert len(fallback_map) == 2
    assert "OPERATIONAL SCOPE:" in fallback_map["worker1"]
    assert "PRIMARY: Task 1" in fallback_map["worker1"]
    print("✓ Fallback formatting correct")


def test_perspective_matrix():
    """Test perspective matrix expansion"""
    workflow_def = {
        "models": ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
        "supersteps": [
            {
                "map_phase": {
                    "perspective_matrix": {
                        "perspectives": [
                            {
                                "perspective_id": "technical",
                                "instruction": "Technical analysis"
                            },
                            {
                                "perspective_id": "business",
                                "instruction": "Business analysis"
                            }
                        ],
                        "use_models": "all"
                    }
                }
            }
        ]
    }

    workers = _extract_all_workers(workflow_def)

    print(f"✓ Perspective matrix expanded to {len(workers)} workers")
    # 2 models × 2 perspectives = 4 workers
    assert len(workers) == 4

    worker_ids = [w["worker_id"] for w in workers]
    print(f"✓ Worker IDs: {worker_ids}")

    assert "gpt-4o-mini_technical" in worker_ids
    assert "gpt-4o-mini_business" in worker_ids
    assert "claude-3.5-sonnet_technical" in worker_ids
    assert "claude-3.5-sonnet_business" in worker_ids
    print("✓ All expected worker IDs present")


if __name__ == "__main__":
    print("Testing scope_alignment module...\n")

    test_extract_workers()
    print()

    test_format_scope()
    print()

    test_fallback_scopes()
    print()

    test_perspective_matrix()
    print()

    print("✅ All tests passed!")
