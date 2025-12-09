"""Test script for perspective_matrix feature."""

import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from workflow_schema import validate_workflow
from workflow_engine import WorkflowExecutor


def test_schema_validation():
    """Test that the new schema validates correctly."""
    print("Testing schema validation...")

    # Load perspective_matrix example
    with open("examples/workflows/perspective_matrix.json") as f:
        workflow = json.load(f)

    is_valid, error = validate_workflow(workflow)

    if is_valid:
        print("✓ Schema validation passed")
    else:
        print(f"✗ Schema validation failed: {error}")
        return False

    return True


def test_worker_expansion():
    """Test that perspective_matrix expands to correct number of workers."""
    print("\nTesting worker expansion...")

    # Load perspective_matrix example
    with open("examples/workflows/perspective_matrix.json") as f:
        workflow = json.load(f)

    executor = WorkflowExecutor(workflow)

    # Get first superstep map_phase
    map_phase = workflow['supersteps'][0]['map_phase']

    # Expand workers
    workers = executor._expand_map_phase_workers(map_phase)

    # Should be 3 models × 4 perspectives = 12 workers
    expected_count = 3 * 4
    actual_count = len(workers)

    if actual_count == expected_count:
        print(f"✓ Worker expansion correct: {actual_count} workers generated")
    else:
        print(f"✗ Worker expansion failed: expected {expected_count}, got {actual_count}")
        return False

    # Check worker_id format
    print("\nGenerated worker IDs:")
    for worker in workers[:6]:  # Show first 6
        print(f"  - {worker['worker_id']}")
    print(f"  ... ({actual_count - 6} more)")

    # Verify all workers have required fields
    for worker in workers:
        if not all(k in worker for k in ['worker_id', 'model_ref', 'instruction']):
            print(f"✗ Worker missing required fields: {worker}")
            return False

    print("✓ All workers have required fields")

    return True


def test_backwards_compatibility():
    """Test that old examples still work with role_definition."""
    print("\nTesting backwards compatibility...")

    # Load an old-style example (should still work)
    with open("examples/workflows/simple_debate.json") as f:
        workflow = json.load(f)

    is_valid, error = validate_workflow(workflow)

    if is_valid:
        print("✓ Backwards compatibility: old examples still validate")
    else:
        print(f"✗ Backwards compatibility failed: {error}")
        return False

    return True


def test_all_examples():
    """Test that all examples validate."""
    print("\nTesting all example workflows...")

    examples_dir = Path("examples/workflows")
    json_files = list(examples_dir.glob("*.json"))

    print(f"Found {len(json_files)} workflow examples")

    failed = []
    for json_file in json_files:
        with open(json_file) as f:
            try:
                workflow = json.load(f)
                is_valid, error = validate_workflow(workflow)

                if is_valid:
                    print(f"  ✓ {json_file.name}")
                else:
                    print(f"  ✗ {json_file.name}: {error}")
                    failed.append((json_file.name, error))
            except Exception as e:
                print(f"  ✗ {json_file.name}: {str(e)}")
                failed.append((json_file.name, str(e)))

    if not failed:
        print(f"\n✓ All {len(json_files)} examples validated successfully")
        return True
    else:
        print(f"\n✗ {len(failed)} examples failed validation:")
        for name, error in failed:
            print(f"  - {name}: {error}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Perspective Matrix Feature Test Suite")
    print("=" * 60)

    tests = [
        ("Schema Validation", test_schema_validation),
        ("Worker Expansion", test_worker_expansion),
        ("Backwards Compatibility", test_backwards_compatibility),
        ("All Examples", test_all_examples),
    ]

    results = []
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n✗ {name} threw exception: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
        print()

    print("=" * 60)
    print("Test Results Summary")
    print("=" * 60)

    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {name}")

    total = len(results)
    passed = sum(1 for _, p in results if p)

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} tests failed")
        sys.exit(1)
