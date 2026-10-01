#!/usr/bin/env python3
"""
create_account.py -- Interactive and CLI Account Provisioning for CIPHERTRACE
=============================================================================
Creates a new cryptographic identity (ECDSA P-256 certificate signed by Org CA)
and packages it into a ready-to-use identity bundle (.zip) for friends or nodes.
"""

import os
import sys

# Ensure repository root is on path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(REPO_ROOT, "blockchain", "scripts"))

from manage_ledger import create_recipient, bundle_identity, BUNDLES_DIR, ORGS


def main():
    print("=" * 76)
    print("                     CIPHERTRACE ACCOUNT PROVISIONING")
    print("           Generate Cross-Device Identity Bundles for Friends")
    print("=" * 76)
    print()

    args = sys.argv[1:]
    username = ""
    org = "Org1"
    role = "client"

    if len(args) >= 1 and not args[0].startswith("-"):
        username = args[0].strip()
    if len(args) >= 2 and not args[1].startswith("-"):
        org = args[1].strip()
    if "--admin" in args or "admin" in args[2:]:
        role = "admin"

    if not username:
        try:
            username = input("Enter username for your friend (letters, numbers, hyphens): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    if not username:
        print("[ERROR] Username cannot be empty.")
        sys.exit(1)

    if len(args) < 2:
        print("\nSelect Organization:")
        print("  [1] Org1 (Default - Port 7051)")
        print("  [2] Org2 (Port 9051)")
        try:
            choice = input("Enter choice [1 or 2, default 1]: ").strip()
            if choice == "2":
                org = "Org2"
            else:
                org = "Org1"
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    print(f"\n[INFO] Generating cryptographic CA identity for '{username}' in {org} (role: {role})...")
    try:
        create_recipient(username, org, role=role)
        bundle_path = bundle_identity(username, org)
    except Exception as e:
        print(f"\n[ERROR] Failed to create account: {e}")
        sys.exit(1)

    print()
    print("=" * 76)
    print("                 IDENTITY BUNDLE SUCCESSFULLY GENERATED")
    print("=" * 76)
    print(f"Username        : {username}")
    print(f"Organization    : {org}")
    print(f"Role            : {role.upper()}")
    print(f"Bundle File     : {bundle_path}")
    print()
    print("-" * 76)
    print("HOW TO GIVE THIS TO YOUR FRIEND:")
    print("-" * 76)
    print(f"1. Send the file '{os.path.basename(bundle_path)}' to your friend (USB, email, chat, etc.).")
    print("2. When they launch CIPHERTRACE on their machine:")
    print(f"     - Username       : {username}")
    print(f"     - Identity Bundle: Click 'Select Identity Bundle' and choose '{os.path.basename(bundle_path)}'")
    print("     - Passphrase     : Enter a passphrase (at least 12 characters).")
    print("       (This encrypts their private ML-KEM/ML-DSA keys in their local keystore)")
    print("3. Their post-quantum keys are automatically generated on their device!")
    print("=" * 76)
    print()


if __name__ == "__main__":
    main()
