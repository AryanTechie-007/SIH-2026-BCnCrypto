#!/usr/bin/env python3
"""
manage_ledger.py -- Windows & Cross-Platform Ledger & Identity Manager for CIPHERTRACE
====================================================================================
Generates standard Hyperledger Fabric CA certificates, user ECDSA P-256 identities,
and login bundle zip archives for local testing and deployment on Windows, Linux, and macOS.
Does NOT require Docker, OpenSSL CLI, or WSL.
"""

import argparse
import datetime
import io
import json
import os
import re
import shutil
import sys
import zipfile

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLOCKCHAIN_DIR = os.path.join(REPO_ROOT, "blockchain")
CRYPTO_DIR = os.path.join(BLOCKCHAIN_DIR, "crypto")
BUNDLES_DIR = os.path.join(BLOCKCHAIN_DIR, "bundles")
DATA_DIR = os.path.join(BLOCKCHAIN_DIR, "data")
LOCAL_LEDGER_FILE = os.path.join(DATA_DIR, "local-ledger.json")

ORGS = {
    "Org1": {
        "domain": "org1.example.com",
        "msp_id": "Org1MSP",
        "ca_cn": "ca.org1.example.com",
        "tlsca_cn": "tlsca.org1.example.com",
    },
    "Org2": {
        "domain": "org2.example.com",
        "msp_id": "Org2MSP",
        "ca_cn": "ca.org2.example.com",
        "tlsca_cn": "tlsca.org2.example.com",
    },
}

USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def _get_org(name_or_domain: str):
    key = name_or_domain.capitalize()
    if key in ORGS:
        return ORGS[key]
    for org in ORGS.values():
        if org["domain"] == name_or_domain or org["msp_id"] == name_or_domain:
            return org
    raise ValueError(f"Unknown organization '{name_or_domain}'. Allowed: Org1, Org2")


def _ensure_dirs():
    os.makedirs(CRYPTO_DIR, exist_ok=True)
    os.makedirs(BUNDLES_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)


def init_ca():
    """Initializes root CA and TLS CA certificates for Org1 and Org2."""
    _ensure_dirs()
    print("==> Initializing Root & TLS Certificate Authorities...")

    for org_name, org in ORGS.items():
        domain = org["domain"]
        org_path = os.path.join(CRYPTO_DIR, "peerOrganizations", domain)
        ca_dir = os.path.join(org_path, "ca")
        tlsca_dir = os.path.join(org_path, "tlsca")
        os.makedirs(ca_dir, exist_ok=True)
        os.makedirs(tlsca_dir, exist_ok=True)

        ca_cert_path = os.path.join(ca_dir, f"ca.{domain}-cert.pem")
        ca_key_path = os.path.join(ca_dir, "priv_sk")

        if not os.path.exists(ca_cert_path) or not os.path.exists(ca_key_path):
            ca_key = ec.generate_private_key(ec.SECP256R1())
            ca_subject = x509.Name([
                x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
                x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "California"),
                x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, domain),
                x509.NameAttribute(NameOID.COMMON_NAME, org["ca_cn"]),
            ])
            ca_cert = (
                x509.CertificateBuilder()
                .subject_name(ca_subject)
                .issuer_name(ca_subject)
                .public_key(ca_key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1))
                .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=3650))
                .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
                .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False)
                .sign(ca_key, hashes.SHA256())
            )

            with open(ca_key_path, "wb") as f:
                f.write(ca_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                ))
            with open(ca_cert_path, "wb") as f:
                f.write(ca_cert.public_bytes(serialization.Encoding.PEM))

            # Mirror to tlsca
            tlsca_cert_path = os.path.join(tlsca_dir, f"tlsca.{domain}-cert.pem")
            with open(tlsca_cert_path, "wb") as f:
                f.write(ca_cert.public_bytes(serialization.Encoding.PEM))

            print(f"  [OK] Created CA for {org_name} ({domain})")
        else:
            print(f"  [EXISTS] CA for {org_name} already present")


def create_recipient(username: str, org_name: str = "Org1", role: str = "client"):
    """Generates a recipient ECDSA identity signed by the Org's CA."""
    if not USERNAME_RE.match(username) or username.startswith("."):
        raise ValueError(f"Invalid username '{username}'. Only letters, digits, '.', '_', '-' allowed.")

    org = _get_org(org_name)
    domain = org["domain"]
    org_path = os.path.join(CRYPTO_DIR, "peerOrganizations", domain)
    ca_dir = os.path.join(org_path, "ca")

    ca_cert_path = os.path.join(ca_dir, f"ca.{domain}-cert.pem")
    ca_key_path = os.path.join(ca_dir, "priv_sk")

    if not os.path.exists(ca_cert_path) or not os.path.exists(ca_key_path):
        init_ca()

    with open(ca_key_path, "rb") as f:
        ca_key = serialization.load_pem_private_key(f.read(), password=None)
    with open(ca_cert_path, "rb") as f:
        ca_cert = x509.load_pem_x509_certificate(f.read())

    full_name = f"{username}@{domain}"
    users_dir = os.path.join(org_path, "users", full_name, "msp")
    signcerts_dir = os.path.join(users_dir, "signcerts")
    keystore_dir = os.path.join(users_dir, "keystore")
    os.makedirs(signcerts_dir, exist_ok=True)
    os.makedirs(keystore_dir, exist_ok=True)

    # Generate user EC keypair
    user_key = ec.generate_private_key(ec.SECP256R1())
    user_subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "California"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, role),
        x509.NameAttribute(NameOID.COMMON_NAME, full_name),
    ])

    user_cert = (
        x509.CertificateBuilder()
        .subject_name(user_subject)
        .issuer_name(ca_cert.subject)
        .public_key(user_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1))
        .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(user_key.public_key()), critical=False)
        .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
        .sign(ca_key, hashes.SHA256())
    )

    cert_path = os.path.join(signcerts_dir, f"{full_name}-cert.pem")
    key_path = os.path.join(keystore_dir, "priv_sk")

    with open(cert_path, "wb") as f:
        f.write(user_cert.public_bytes(serialization.Encoding.PEM))
    with open(key_path, "wb") as f:
        f.write(user_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    # Add config.yaml
    config_yaml_path = os.path.join(users_dir, "config.yaml")
    with open(config_yaml_path, "w", encoding="utf-8") as f:
        f.write("NodeOUs:\n  Enable: true\n")

    print(f"==> Created recipient identity: {full_name} ({org['msp_id']}, role: {role})")
    return cert_path, key_path


def bundle_identity(username: str, org_name: str = "Org1", out_zip: str = None) -> str:
    """Packages the user identity into a standard login bundle zip archive."""
    org = _get_org(org_name)
    domain = org["domain"]
    full_name = f"{username}@{domain}"
    org_path = os.path.join(CRYPTO_DIR, "peerOrganizations", domain)
    user_msp = os.path.join(org_path, "users", full_name, "msp")
    tlsca_cert = os.path.join(org_path, "tlsca", f"tlsca.{domain}-cert.pem")

    if not os.path.exists(user_msp):
        create_recipient(username, org_name)

    if not out_zip:
        out_zip = os.path.join(BUNDLES_DIR, f"{username}.zip")

    # Layout required by bundle_store.py:
    # test-network/organizations/peerOrganizations/<domain>/
    #     tlsca/tlsca.<domain>-cert.pem
    #     users/<full_name>/msp/signcerts/<full_name>-cert.pem
    #     users/<full_name>/msp/keystore/priv_sk
    base_prefix = f"test-network/organizations/peerOrganizations/{domain}"

    with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # tlsca
        zf.write(tlsca_cert, arcname=f"{base_prefix}/tlsca/tlsca.{domain}-cert.pem")

        # user cert
        user_cert_src = os.path.join(user_msp, "signcerts", f"{full_name}-cert.pem")
        zf.write(user_cert_src, arcname=f"{base_prefix}/users/{full_name}/msp/signcerts/{full_name}-cert.pem")

        # user private key
        user_key_src = os.path.join(user_msp, "keystore", "priv_sk")
        zf.write(user_key_src, arcname=f"{base_prefix}/users/{full_name}/msp/keystore/priv_sk")

        # config.yaml
        config_yaml_src = os.path.join(user_msp, "config.yaml")
        if os.path.exists(config_yaml_src):
            zf.write(config_yaml_src, arcname=f"{base_prefix}/users/{full_name}/msp/config.yaml")

    print(f"==> Identity bundle written to: {out_zip}")
    return out_zip


def init_local_ledger_state():
    """Initializes clean local ledger state JSON file."""
    _ensure_dirs()
    if not os.path.exists(LOCAL_LEDGER_FILE):
        with open(LOCAL_LEDGER_FILE, "w", encoding="utf-8") as f:
            json.dump({"records": {}, "keys": {}}, f, indent=2)
        print(f"  [OK] Initialized ledger state file: {LOCAL_LEDGER_FILE}")
    else:
        print(f"  [EXISTS] Ledger state file already present: {LOCAL_LEDGER_FILE}")


def setup_all():
    """One-click setup for local ledger development on Windows."""
    print("============================================================================")
    print("           CIPHERTRACE - Windows Local Ledger Initialization")
    print("============================================================================")
    _ensure_dirs()
    init_local_ledger_state()
    init_ca()

    print("\n==> Provisioning standard test identities...")
    create_recipient("alice", "Org1")
    bundle_identity("alice", "Org1")

    create_recipient("bob", "Org2")
    bundle_identity("bob", "Org2")

    create_recipient("user-042", "Org1")
    bundle_identity("user-042", "Org1")

    print("\n============================================================================")
    print("             SUCCESS: LOCAL LEDGER IS CONFIGURED & READY")
    print("============================================================================")
    print("User identity bundles generated:")
    print(f"  - Alice (Org1): {os.path.join(BUNDLES_DIR, 'alice.zip')}")
    print(f"  - Bob   (Org2): {os.path.join(BUNDLES_DIR, 'bob.zip')}")
    print(f"  - User  (Org1): {os.path.join(BUNDLES_DIR, 'user-042.zip')}")
    print("\nYou can now log in to the CIPHERTRACE desktop application with:")
    print("  Username: alice")
    print(f"  Bundle:   blockchain\\bundles\\alice.zip")
    print("============================================================================")


def teardown():
    """Resets local ledger state."""
    print("==> Tearing down local ledger data...")
    if os.path.exists(LOCAL_LEDGER_FILE):
        os.remove(LOCAL_LEDGER_FILE)
        print(f"  [OK] Removed {LOCAL_LEDGER_FILE}")
    print("Local ledger state cleared.")


def run_smoke_test():
    """Runs end-to-end smoke test on the ledger interface."""
    import base64
    import subprocess
    import uuid

    print("============================================================================")
    print("                 CIPHERTRACE LEDGER END-TO-END SMOKE TEST")
    print("============================================================================")

    # Ensure ledger is initialized
    setup_all()

    cli_path = os.path.join(BLOCKCHAIN_DIR, "client", "cli.js")
    node_cmd = "node"

    passed = 0
    failed = 0

    def ok(msg):
        nonlocal passed
        passed += 1
        print(f"  [PASS] {msg}")

    def bad(msg):
        nonlocal failed
        failed += 1
        print(f"  [FAIL] {msg}")

    def run_cli(*args):
        env = os.environ.copy()
        env["USE_LOCAL_LEDGER"] = "true"
        cmd = [node_cmd, cli_path] + list(args)
        proc = subprocess.run(cmd, cwd=os.path.join(BLOCKCHAIN_DIR, "client"),
                              capture_output=True, text=True, env=env)
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()

    # 1. WhoAmI Alice
    code, stdout, _ = run_cli("whoami", "alice")
    if code == 0 and '"username": "alice"' in stdout and '"msp_id": "Org1MSP"' in stdout:
        ok("whoami alice returns Org1MSP and username alice")
    else:
        bad(f"whoami alice failed: {stdout}")

    # 2. WhoAmI Bob
    code, stdout, _ = run_cli("whoami", "bob")
    if code == 0 and '"username": "bob"' in stdout and '"msp_id": "Org2MSP"' in stdout:
        ok("whoami bob returns Org2MSP and username bob")
    else:
        bad(f"whoami bob failed: {stdout}")

    # 3. Register Keys for user-042
    test_user = f"user-{uuid.uuid4().hex[:6]}"
    create_recipient(test_user, "Org1")
    dummy_kem = base64.b64encode(b"K" * 1184).decode()
    dummy_dsa = base64.b64encode(b"S" * 1952).decode()
    keys_payload = {
        "username": test_user,
        "kem_algorithm": "ML-KEM-768",
        "kem_public_key": dummy_kem,
        "dsa_algorithm": "ML-DSA-65",
        "dsa_public_key": dummy_dsa,
    }
    tmp_keys = os.path.join(DATA_DIR, f"temp_keys_{test_user}.json")
    with open(tmp_keys, "w", encoding="utf-8") as f:
        json.dump(keys_payload, f)

    code, stdout, stderr = run_cli("keys-register", tmp_keys, test_user)
    if code == 0 and test_user in stdout:
        ok("keys-register succeeded for " + test_user)
    else:
        bad(f"keys-register failed: {stdout} {stderr}")

    # 4. Get Keys
    code, stdout, _ = run_cli("keys-get", test_user, test_user)
    if code == 0 and test_user in stdout:
        ok("keys-get retrieved registered public keys")
    else:
        bad(f"keys-get failed: {stdout}")

    # 5. Submit Decryption Record
    wm_id = uuid.uuid4().hex[:20].lower()
    doc_hash = "a" * 64
    wm_hash = "b" * 64
    record_payload = {
        "record_id": f"rec-{wm_id}",
        "watermark_id": wm_id,
        "recipient_id": test_user,
        "document_hash": doc_hash,
        "watermarked_doc_hash": wm_hash,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pqc_algorithm": "ML-DSA-65",
        "signature": base64.b64encode(b"mock-sig").decode(),
        "recipient_pubkey_fingerprint": doc_hash,
    }
    tmp_rec = os.path.join(DATA_DIR, f"temp_rec_{wm_id}.json")
    with open(tmp_rec, "w", encoding="utf-8") as f:
        json.dump(record_payload, f)

    code, stdout, stderr = run_cli("submit", tmp_rec, test_user)
    if code == 0 and wm_id in stdout:
        ok(f"submit committed record for watermark {wm_id}")
    else:
        bad(f"submit failed: {stdout} {stderr}")

    # 6. Query Record
    code, stdout, _ = run_cli("query", wm_id, test_user)
    if code == 0 and wm_id in stdout:
        ok("query retrieved the committed record")
    else:
        bad(f"query failed: {stdout}")

    # 7. Reject duplicate watermark
    code, _, stderr = run_cli("submit", tmp_rec, test_user)
    if code != 0 or "duplicate" in stderr or "already exists" in stderr or "already exists" in stdout:
        ok("chaincode rejected duplicate watermark ID")
    else:
        bad("duplicate watermark submission was unexpectedly accepted")

    # 8. Reject identity mismatch
    record_payload["watermark_id"] = uuid.uuid4().hex[:20].lower()
    record_payload["recipient_id"] = "someone-else"
    with open(tmp_rec, "w", encoding="utf-8") as f:
        json.dump(record_payload, f)
    code, _, _ = run_cli("submit", tmp_rec, test_user)
    if code != 0:
        ok("chaincode rejected record with recipient_id mismatch")
    else:
        bad("identity mismatch submission was unexpectedly accepted")

    # Clean up temp files
    if os.path.exists(tmp_keys): os.remove(tmp_keys)
    if os.path.exists(tmp_rec): os.remove(tmp_rec)

    print("\n============================================================================")
    print(f"SMOKE TEST SUMMARY: {passed} PASSED, {failed} FAILED")
    print("============================================================================")
    return failed == 0


def main():
    parser = argparse.ArgumentParser(description="CIPHERTRACE Windows Ledger Manager")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("setup", help="Initialize CAs, local ledger, and default users (alice, bob)")
    subparsers.add_parser("init-ca", help="Initialize Certificate Authorities")
    subparsers.add_parser("teardown", help="Reset local ledger state")
    subparsers.add_parser("smoke-test", help="Run end-to-end smoke tests")

    p_new = subparsers.add_parser("new-recipient", help="Create new recipient identity")
    p_new.add_argument("name", help="Username / Recipient ID")
    p_new.add_argument("org", nargs="?", default="Org1", help="Org1 or Org2")
    p_new.add_argument("--role", default="client", choices=["client", "admin"])

    p_bundle = subparsers.add_parser("bundle-identity", help="Package identity into login bundle zip")
    p_bundle.add_argument("name", help="Username")
    p_bundle.add_argument("org", nargs="?", default="Org1", help="Org1 or Org2")
    p_bundle.add_argument("out", nargs="?", default=None, help="Output zip path")

    args = parser.parse_args()

    if args.command == "setup" or not args.command:
        setup_all()
    elif args.command == "init-ca":
        init_ca()
    elif args.command == "new-recipient":
        create_recipient(args.name, args.org, args.role)
    elif args.command == "bundle-identity":
        bundle_identity(args.name, args.org, args.out)
    elif args.command == "smoke-test":
        success = run_smoke_test()
        sys.exit(0 if success else 1)
    elif args.command == "teardown":
        teardown()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

