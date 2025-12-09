#!/usr/bin/env python3
"""
Generate invite links for new user registration.

Usage:
    python scripts/generate_invite.py <email> [--days DAYS] [--notes NOTES]
    python scripts/generate_invite.py --list [--unused]
    python scripts/generate_invite.py --waitlist

Examples:
    # Generate invite for specific email (expires in 7 days)
    python scripts/generate_invite.py user@example.com

    # Generate invite with custom expiration (14 days)
    python scripts/generate_invite.py user@example.com --days 14

    # Generate invite with notes
    python scripts/generate_invite.py user@example.com --notes "Beta tester"

    # List all invite tokens
    python scripts/generate_invite.py --list

    # List unused invite tokens only
    python scripts/generate_invite.py --list --unused

    # List waitlist entries
    python scripts/generate_invite.py --waitlist
"""

import sys
import os
import secrets
from datetime import datetime, timedelta
from pathlib import Path

import backend.storage.registration

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import INVITE_TOKEN_EXPIRE_DAYS, API_BASE_URL


def generate_token() -> str:
    """Generate a secure random invite token."""
    return secrets.token_urlsafe(32)


def generate_invite(email: str, days: int = None, notes: str = None) -> dict:
    """
    Generate an invite token.

    Args:
        email: Email address this invite is for
        days: Expiration in days (default from config)
        notes: Optional notes

    Returns:
        Invite dict with token and details
    """
    token = generate_token()
    expires_days = days if days is not None else INVITE_TOKEN_EXPIRE_DAYS
    expires_at = (datetime.utcnow() + timedelta(days=expires_days)).isoformat()

    invite = backend.storage.registration.create_invite_token(
        token=token,
        email=email,
        expires_at=expires_at,
        notes=notes
    )

    return invite


def list_invites(unused_only: bool = False):
    """
    List all invite tokens.

    Args:
        unused_only: Only show unused invites
    """
    invites = backend.storage.registration.list_invite_tokens(used=False if unused_only else None)

    if not invites:
        print("No invite tokens found.")
        return

    print(f"\n{'='*80}")
    print(f"{'INVITE TOKENS':^80}")
    print(f"{'='*80}\n")

    for invite in invites:
        status = "✓ USED" if invite["used"] else "○ UNUSED"
        print(f"Token:      {invite['token']}")
        print(f"Email:      {invite.get('email', 'N/A')}")
        print(f"Status:     {status}")
        print(f"Created:    {invite['created_at']}")
        print(f"Expires:    {invite.get('expires_at', 'Never')}")

        if invite.get("used"):
            print(f"Used by:    {invite.get('used_by', 'Unknown')}")
            print(f"Used at:    {invite.get('used_at', 'Unknown')}")

        if invite.get("notes"):
            print(f"Notes:      {invite['notes']}")

        print(f"{'-'*80}\n")


def list_waitlist():
    """List all waitlist entries."""
    entries = backend.storage.registration.list_waitlist()

    if not entries:
        print("No waitlist entries found.")
        return

    print(f"\n{'='*80}")
    print(f"{'WAITLIST ENTRIES':^80}")
    print(f"{'='*80}\n")

    for entry in entries:
        status = "✓ INVITED" if entry["invited"] else "○ PENDING"
        print(f"Email:      {entry['email']}")
        print(f"Name:       {entry.get('name', 'N/A')}")
        print(f"Status:     {status}")
        print(f"Submitted:  {entry['submitted_at']}")

        if entry.get("invited"):
            print(f"Invited:    {entry.get('invited_at', 'Unknown')}")

        if entry.get("notes"):
            print(f"Notes:      {entry['notes']}")

        print(f"{'-'*80}\n")


def main():
    """Main CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate invite links for LLM Council registration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        "email",
        nargs="?",
        help="Email address to generate invite for"
    )

    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help=f"Expiration in days (default: {INVITE_TOKEN_EXPIRE_DAYS})"
    )

    parser.add_argument(
        "--notes",
        type=str,
        help="Optional notes for this invite"
    )

    parser.add_argument(
        "--list",
        action="store_true",
        help="List all invite tokens"
    )

    parser.add_argument(
        "--unused",
        action="store_true",
        help="Only show unused invites (with --list)"
    )

    parser.add_argument(
        "--waitlist",
        action="store_true",
        help="List waitlist entries"
    )

    parser.add_argument(
        "--base-url",
        type=str,
        default=API_BASE_URL,
        help="Base URL for invite links (default: http://localhost:5173)"
    )

    args = parser.parse_args()

    # List mode
    if args.list:
        list_invites(unused_only=args.unused)
        return

    # Waitlist mode
    if args.waitlist:
        list_waitlist()
        return

    # Generate mode
    if not args.email:
        parser.error("Email address is required (or use --list or --waitlist)")

    try:
        invite = generate_invite(args.email, args.days, args.notes)

        print(f"\n{'='*80}")
        print(f"{'INVITE LINK GENERATED':^80}")
        print(f"{'='*80}\n")

        print(f"Email:      {invite['email']}")
        print(f"Token:      {invite['token']}")
        print(f"Created:    {invite['created_at']}")
        print(f"Expires:    {invite['expires_at']}")

        if invite.get("notes"):
            print(f"Notes:      {invite['notes']}")

        invite_url = f"{args.base_url}/?invite={invite['token']}"
        print(f"\n{'INVITE LINK':^80}")
        print(f"{'-'*80}")
        print(f"{invite_url}")
        print(f"{'-'*80}\n")

        print("Send this link to the user to complete registration.")
        print(f"Link expires in {args.days or INVITE_TOKEN_EXPIRE_DAYS} days.")
        print()

    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
