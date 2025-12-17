#!/usr/bin/env python3
"""
Migrate workflow DSL from old format to new unified perspectives format.

Old patterns:
1. "workers": [...] → "perspectives": [...]  (with model_ref inline)
2. "perspective_matrix": {...} → "perspectives": [...] (model-neutral)

Usage:
    python scripts/migrate_workflows.py [directory]

    If no directory specified, defaults to 'examples/workflows/'
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any


def migrate_workflow(workflow_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Migrate old DSL to new unified DSL.

    Args:
        workflow_data: Workflow JSON data

    Returns:
        Migrated workflow data
    """
    migrated = workflow_data.copy()

    for superstep in migrated.get('supersteps', []):
        map_phase = superstep.get('map_phase', {})

        # Pattern 1: workers → perspectives with model_ref
        if 'workers' in map_phase:
            workers = map_phase.pop('workers')
            perspectives = []

            for worker in workers:
                perspective = {
                    'perspective_id': worker['worker_id'],
                    'instruction': worker.get('instruction') or worker.get('role_definition', ''),
                    'model_ref': worker['model_ref']  # Inline binding
                }
                perspectives.append(perspective)

            map_phase['perspectives'] = perspectives
            print(f"  ✓ Migrated 'workers' → 'perspectives' ({len(perspectives)} workers)")

        # Pattern 2: perspective_matrix → perspectives (model-neutral)
        elif 'perspective_matrix' in map_phase:
            matrix = map_phase.pop('perspective_matrix')
            map_phase['perspectives'] = matrix['perspectives']

            # Note: 'perspectives' items already have perspective_id and instruction
            # No model_ref needed (model-neutral by default)
            print(f"  ✓ Migrated 'perspective_matrix' → 'perspectives' ({len(matrix['perspectives'])} perspectives)")

    return migrated


def migrate_file(json_file: Path, dry_run: bool = False) -> bool:
    """
    Migrate a single workflow file.

    Args:
        json_file: Path to JSON file
        dry_run: If True, only show what would be done without writing

    Returns:
        True if migration was successful, False otherwise
    """
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Processing {json_file}...")

    try:
        # Read original
        with open(json_file, 'r') as f:
            data = json.load(f)

        # Check if migration is needed
        needs_migration = False
        for superstep in data.get('supersteps', []):
            map_phase = superstep.get('map_phase', {})
            if 'workers' in map_phase or 'perspective_matrix' in map_phase:
                needs_migration = True
                break

        if not needs_migration:
            print("  → Already using new DSL format, skipping")
            return True

        # Migrate
        migrated = migrate_workflow(data)

        if dry_run:
            print("  → Would create backup and write migrated file")
            return True

        # Backup original
        backup = json_file.with_suffix('.json.backup')
        with open(backup, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"  ✓ Created backup: {backup}")

        # Write migrated
        with open(json_file, 'w') as f:
            json.dump(migrated, f, indent=2)
        print(f"  ✓ Wrote migrated file: {json_file}")

        return True

    except json.JSONDecodeError as e:
        print(f"  ✗ JSON decode error: {e}")
        return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def migrate_directory(directory: Path, dry_run: bool = False) -> None:
    """
    Migrate all .json files in directory.

    Args:
        directory: Path to directory containing workflow files
        dry_run: If True, only show what would be done without writing
    """
    if not directory.exists():
        print(f"Error: Directory {directory} does not exist")
        sys.exit(1)

    if not directory.is_dir():
        print(f"Error: {directory} is not a directory")
        sys.exit(1)

    # Find all .json files
    json_files = list(directory.glob('*.json'))

    if not json_files:
        print(f"No .json files found in {directory}")
        return

    print(f"{'[DRY RUN MODE] ' if dry_run else ''}Found {len(json_files)} workflow file(s) in {directory}")
    print("=" * 60)

    success_count = 0
    skip_count = 0
    fail_count = 0

    for json_file in json_files:
        # Skip backup files
        if json_file.suffix == '.backup' or json_file.name.endswith('.json.backup'):
            skip_count += 1
            continue

        if migrate_file(json_file, dry_run):
            success_count += 1
        else:
            fail_count += 1

    print("\n" + "=" * 60)
    print(f"Migration {'simulation' if dry_run else 'complete'}!")
    print(f"  Migrated: {success_count}")
    print(f"  Skipped:  {skip_count}")
    print(f"  Failed:   {fail_count}")

    if dry_run:
        print("\nThis was a dry run. No files were modified.")
        print("Run without --dry-run to apply changes.")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Migrate workflow DSL from old format to new unified perspectives format',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Migrate all workflows in examples/workflows/
  python scripts/migrate_workflows.py

  # Migrate workflows in a specific directory
  python scripts/migrate_workflows.py path/to/workflows

  # Dry run (preview changes without modifying files)
  python scripts/migrate_workflows.py --dry-run

  # Migrate specific file
  python scripts/migrate_workflows.py examples/workflows/simple_debate.json
        """
    )
    parser.add_argument(
        'path',
        nargs='?',
        default='examples/workflows',
        help='Directory or file to migrate (default: examples/workflows)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying files'
    )

    args = parser.parse_args()

    path = Path(args.path)

    if path.is_file():
        # Migrate single file
        print(f"{'[DRY RUN MODE] ' if args.dry_run else ''}Migrating single file: {path}")
        print("=" * 60)
        migrate_file(path, args.dry_run)
    else:
        # Migrate directory
        migrate_directory(path, args.dry_run)


if __name__ == '__main__':
    main()
