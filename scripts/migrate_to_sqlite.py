#!/usr/bin/env python3
"""
Migration script to convert JSON-based storage to SQLite.

This script:
1. Reads existing JSON files (conversations, profiles, users, sessions)
2. Imports them into data/data.sqlite
3. Creates backup of original files
4. Validates the migration

Usage:
    python scripts/migrate_to_sqlite.py [--dry-run] [--backup-dir BACKUP_DIR]

Options:
    --dry-run       Show what would be migrated without actually doing it
    --backup-dir    Directory to store JSON backups (default: data/backup_json)
    --no-backup     Skip creating backups (not recommended)
"""

import os
import sys
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend import storage, auth
from backend.config import DATA_DIR, PROFILES_FILE


class MigrationStats:
    """Track migration statistics."""

    def __init__(self):
        self.conversations = 0
        self.profiles = 0
        self.users = 0
        self.sessions = 0
        self.errors = []

    def print_summary(self):
        """Print migration summary."""
        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        print(f"✅ Conversations migrated: {self.conversations}")
        print(f"✅ Profiles migrated:      {self.profiles}")
        print(f"✅ Users migrated:         {self.users}")
        print(f"✅ Sessions migrated:      {self.sessions}")

        if self.errors:
            print(f"\n⚠️  Errors encountered:    {len(self.errors)}")
            for error in self.errors:
                print(f"   - {error}")
        else:
            print("\n✅ No errors encountered")

        print("=" * 60)


def backup_json_files(backup_dir: str) -> bool:
    """
    Create backup of all JSON files.

    Args:
        backup_dir: Directory to store backups

    Returns:
        True if backup successful, False otherwise
    """
    print(f"\n📦 Creating backup in {backup_dir}...")

    try:
        Path(backup_dir).mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        files_backed_up = 0

        # Backup conversations directory
        if os.path.exists(DATA_DIR):
            backup_conversations_dir = os.path.join(backup_dir, f"conversations_{timestamp}")
            shutil.copytree(DATA_DIR, backup_conversations_dir)
            files_backed_up += sum(1 for _ in Path(backup_conversations_dir).rglob("*.json"))
            print(f"   ✓ Backed up conversations to {backup_conversations_dir}")

        # Backup profiles.json
        if os.path.exists(PROFILES_FILE):
            backup_path = os.path.join(backup_dir, f"profiles_{timestamp}.json")
            shutil.copy2(PROFILES_FILE, backup_path)
            files_backed_up += 1
            print(f"   ✓ Backed up profiles to {backup_path}")

        # Backup users.json
        users_file = "data/users.json"
        if os.path.exists(users_file):
            backup_path = os.path.join(backup_dir, f"users_{timestamp}.json")
            shutil.copy2(users_file, backup_path)
            files_backed_up += 1
            print(f"   ✓ Backed up users to {backup_path}")

        # Backup sessions.json
        sessions_file = "data/sessions.json"
        if os.path.exists(sessions_file):
            backup_path = os.path.join(backup_dir, f"sessions_{timestamp}.json")
            shutil.copy2(sessions_file, backup_path)
            files_backed_up += 1
            print(f"   ✓ Backed up sessions to {backup_path}")

        print(f"\n✅ Backup complete: {files_backed_up} files backed up")
        return True

    except Exception as e:
        print(f"\n❌ Backup failed: {e}")
        return False


def migrate_conversations(dry_run: bool = False) -> int:
    """
    Migrate conversations from JSON files to SQLite.

    Args:
        dry_run: If True, only print what would be done

    Returns:
        Number of conversations migrated
    """
    print("\n📄 Migrating conversations...")

    if not os.path.exists(DATA_DIR):
        print("   ℹ️  No conversations directory found")
        return 0

    count = 0

    # Iterate through profile directories
    for dirname in os.listdir(DATA_DIR):
        if not dirname.startswith("profile_"):
            continue

        profile_dir = os.path.join(DATA_DIR, dirname)
        if not os.path.isdir(profile_dir):
            continue

        profile_id = dirname.replace("profile_", "")

        # Iterate through conversation files
        for filename in os.listdir(profile_dir):
            if not filename.endswith('.json'):
                continue

            conversation_id = filename.replace('.json', '')
            path = os.path.join(profile_dir, filename)

            try:
                with open(path, 'r') as f:
                    data = json.load(f)

                if dry_run:
                    print(f"   [DRY RUN] Would migrate: {conversation_id} (profile: {profile_id})")
                else:
                    # Insert into database using storage
                    with storage.get_db_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute(
                            """INSERT OR REPLACE INTO conversations
                               (id, profile_id, created_at, modified_at, title, is_public, uses_byok, data)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                            (
                                data.get("id", conversation_id),
                                data.get("profile_id", profile_id),
                                data.get("created_at", ""),
                                data.get("modified_at", ""),
                                data.get("title", "New Conversation"),
                                1 if data.get("is_public", False) else 0,
                                1 if data.get("uses_byok", False) else 0,
                                json.dumps(data)
                            )
                        )
                        conn.commit()

                    print(f"   ✓ Migrated: {conversation_id} (profile: {profile_id})")

                count += 1

            except Exception as e:
                print(f"   ❌ Error migrating {conversation_id}: {e}")
                continue

    return count


def migrate_profiles(dry_run: bool = False) -> int:
    """
    Migrate profiles from profiles.json to SQLite.

    Args:
        dry_run: If True, only print what would be done

    Returns:
        Number of profiles migrated
    """
    print("\n👤 Migrating profiles...")

    if not os.path.exists(PROFILES_FILE):
        print("   ℹ️  No profiles.json found")
        return 0

    try:
        with open(PROFILES_FILE, 'r') as f:
            profiles = json.load(f)

        count = 0
        for profile_id, profile in profiles.items():
            if dry_run:
                print(f"   [DRY RUN] Would migrate: {profile_id} - {profile.get('name', 'Unknown')}")
            else:
                with storage.get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        """INSERT OR REPLACE INTO profiles (id, name, created_at, data)
                           VALUES (?, ?, ?, ?)""",
                        (
                            profile_id,
                            profile.get("name", "Unknown"),
                            profile.get("created_at", ""),
                            json.dumps(profile)
                        )
                    )
                    conn.commit()

                print(f"   ✓ Migrated: {profile_id} - {profile.get('name', 'Unknown')}")

            count += 1

        return count

    except Exception as e:
        print(f"   ❌ Error migrating profiles: {e}")
        return 0


def migrate_users(dry_run: bool = False) -> int:
    """
    Migrate users from users.json to SQLite.

    Args:
        dry_run: If True, only print what would be done

    Returns:
        Number of users migrated
    """
    print("\n🔐 Migrating users...")

    users_file = "data/users.json"
    if not os.path.exists(users_file):
        print("   ℹ️  No users.json found")
        return 0

    try:
        # Use auth load/save to handle encryption properly
        from backend import auth

        # Load users using original auth module (handles decryption)
        users = auth.load_users()

        if not users:
            print("   ℹ️  No users to migrate")
            return 0

        count = 0
        for user_id, user in users.items():
            if dry_run:
                print(f"   [DRY RUN] Would migrate: {user.get('email', 'Unknown')}")
            else:
                # Insert into database
                with storage.get_db_connection() as conn:
                    cursor = conn.cursor()

                    # Prepare data (let auth handle encryption)
                    from backend.encryption import create_encryption_metadata, encrypt_data
                    from backend.config import ENCRYPTION_ENABLED, ENCRYPTION_KEY

                    if ENCRYPTION_ENABLED and ENCRYPTION_KEY:
                        from backend.encryption import FernetProvider
                        provider = FernetProvider(ENCRYPTION_KEY.encode('utf-8'))
                        data_to_save = {
                            "_encryption": create_encryption_metadata(provider),
                            "data_encrypted": encrypt_data(user, provider)
                        }
                        data_json = json.dumps(data_to_save)
                    else:
                        data_json = json.dumps(user)

                    cursor.execute(
                        """INSERT OR REPLACE INTO users (id, email, created_at, data)
                           VALUES (?, ?, ?, ?)""",
                        (
                            user_id,
                            user.get("email", ""),
                            user.get("created_at", ""),
                            data_json
                        )
                    )
                    conn.commit()

                print(f"   ✓ Migrated: {user.get('email', 'Unknown')}")

            count += 1

        return count

    except Exception as e:
        print(f"   ❌ Error migrating users: {e}")
        return 0


def migrate_sessions(dry_run: bool = False) -> int:
    """
    Migrate sessions from sessions.json to SQLite.

    Args:
        dry_run: If True, only print what would be done

    Returns:
        Number of sessions migrated
    """
    print("\n🔑 Migrating sessions...")

    sessions_file = "data/sessions.json"
    if not os.path.exists(sessions_file):
        print("   ℹ️  No sessions.json found")
        return 0

    try:
        # Use auth module to handle decryption
        from backend import auth

        sessions = auth.load_sessions()

        if not sessions:
            print("   ℹ️  No sessions to migrate")
            return 0

        count = 0
        for token, session in sessions.items():
            if dry_run:
                print(f"   [DRY RUN] Would migrate session for user: {session.get('user_id', 'Unknown')}")
            else:
                # Use auth.save_sessions which will handle encryption
                pass  # We'll save all at once

            count += 1

        if not dry_run and count > 0:
            # Save all sessions at once using auth
            auth.save_sessions(sessions)
            print(f"   ✓ Migrated {count} sessions")

        return count

    except Exception as e:
        print(f"   ❌ Error migrating sessions: {e}")
        return 0


def validate_migration(stats: MigrationStats) -> bool:
    """
    Validate that migration was successful.

    Args:
        stats: Migration statistics

    Returns:
        True if validation passed, False otherwise
    """
    print("\n🔍 Validating migration...")

    try:
        # Check database exists
        db_path = "data/data.sqlite"
        if not os.path.exists(db_path):
            print("   ❌ Database file not found!")
            return False

        # Check we can connect
        with storage.get_db_connection() as conn:
            cursor = conn.cursor()

            # Count records in each table
            cursor.execute("SELECT COUNT(*) FROM conversations")
            conv_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM profiles")
            profile_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM sessions")
            session_count = cursor.fetchone()[0]

        print(f"   ✓ Database accessible")
        print(f"   ✓ Conversations in DB: {conv_count} (expected: {stats.conversations})")
        print(f"   ✓ Profiles in DB:      {profile_count} (expected: {stats.profiles})")
        print(f"   ✓ Users in DB:         {user_count} (expected: {stats.users})")
        print(f"   ✓ Sessions in DB:      {session_count} (expected: {stats.sessions})")

        # Validate counts match
        if (conv_count == stats.conversations and
            profile_count == stats.profiles and
            user_count == stats.users and
            session_count == stats.sessions):
            print("\n✅ Validation passed!")
            return True
        else:
            print("\n⚠️  Warning: Record counts don't match expected values")
            return False

    except Exception as e:
        print(f"   ❌ Validation failed: {e}")
        return False


def main():
    """Main migration function."""
    parser = argparse.ArgumentParser(description="Migrate JSON storage to SQLite")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated without doing it")
    parser.add_argument("--backup-dir", default="data/backup_json", help="Directory to store JSON backups")
    parser.add_argument("--no-backup", action="store_true", help="Skip creating backups (not recommended)")
    args = parser.parse_args()

    print("=" * 60)
    print("MIGRATION: JSON Storage → SQLite")
    print("=" * 60)

    if args.dry_run:
        print("\n🔍 DRY RUN MODE - No changes will be made")

    # Initialize database
    if not args.dry_run:
        print("\n🗄️  Initializing SQLite database...")
        storage.init_database()
        print("   ✓ Database initialized")

    # Create backup (unless --no-backup or --dry-run)
    if not args.dry_run and not args.no_backup:
        if not backup_json_files(args.backup_dir):
            print("\n❌ Backup failed. Aborting migration for safety.")
            print("   Use --no-backup to skip backup (not recommended)")
            return 1

    # Track statistics
    stats = MigrationStats()

    # Run migrations
    stats.conversations = migrate_conversations(args.dry_run)
    stats.profiles = migrate_profiles(args.dry_run)
    stats.users = migrate_users(args.dry_run)
    stats.sessions = migrate_sessions(args.dry_run)

    # Print summary
    stats.print_summary()

    # Validate (skip in dry-run mode)
    if not args.dry_run:
        if validate_migration(stats):
            print("\n✅ Migration completed successfully!")
            print(f"\n📦 Backups stored in: {args.backup_dir}")
            print("\n📝 Next steps:")
            print("   1. Update your code to import storage/auth instead of storage/auth")
            print("   2. Test the application thoroughly")
            print("   3. Once confirmed working, you can delete the JSON backup files")
            return 0
        else:
            print("\n⚠️  Migration completed with warnings. Please review.")
            return 1
    else:
        print("\n✅ Dry run completed. Use without --dry-run to perform actual migration.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
