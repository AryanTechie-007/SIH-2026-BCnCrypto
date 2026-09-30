import os
import base64
import hashlib
import json
import logging
import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app import rpc
from app.config import settings
from app.errors import ApiError
from app.models.database import User
from app.services import bundle_store, ledger_cli, local_data, session_store
from app.services.bundle_store import BundleError
from app.services.crypto_engine import CryptoEngine
from app.services.keystore import KeystoreManager
from app.services.ledger_cli import LedgerCliError
from app.schemas import UserSchema, AuthResponse, CertificateInfo, LedgerIdentityStatus

logger = logging.getLogger("ciphertrace.auth")


MIN_PASSPHRASE_LENGTH = 12


def user_to_schema(u: User) -> UserSchema:
    kem_preview = f"0x{u.kem_public_key[:16].hex()}... ({len(u.kem_public_key)} B)" if u.kem_public_key else "0x0000... (0 B)"
    dsa_preview = f"0x{u.dsa_public_key[:16].hex()}... ({len(u.dsa_public_key)} B)" if u.dsa_public_key else "0x0000... (0 B)"
    return UserSchema(
        id=u.id,
        username=u.username or "",
        name=u.name,
        navy_id=u.navy_id,
        rank=u.rank or "User",
        command_unit=u.command_unit or "General",
        clearance_level=u.clearance_level or "Confidential",
        device_id=u.device_id,
        role=u.role or "USER",
        status=u.status,
        kem_key_id=u.kem_key_id or "",
        dsa_key_id=u.dsa_key_id or "",
        key_status=u.key_status or "ACTIVE",
        ml_kem_pub_preview=kem_preview,
        ml_dsa_pub_preview=dsa_preview,
        fabric_msp_id=u.fabric_msp_id,
        kem_key_fingerprint=hashlib.sha256(u.kem_public_key).hexdigest() if u.kem_public_key else "",
        dsa_key_fingerprint=hashlib.sha256(u.dsa_public_key).hexdigest() if u.dsa_public_key else "",
        keystore_file=os.path.basename(u.keystore_path) if u.keystore_path else None
    )


# ── Ledger identity sign-in ──────────────────────────────────────────────

def _ledger_error(err: LedgerCliError, action: str) -> ApiError:
    if err.kind == "network":
        return ApiError(503, f"Ledger unreachable: {err}. Is the Fabric network running?")
    if err.kind == "config":
        return ApiError(500, f"Ledger client is not set up: {err}")
    return ApiError(502, f"{action}: {err}")


def _keys_match(ledger_keys: dict, user: User) -> bool:
    try:
        return (base64.b64decode(ledger_keys["kem_public_key"]) == user.kem_public_key
                and base64.b64decode(ledger_keys["dsa_public_key"]) == user.dsa_public_key)
    except (KeyError, ValueError):
        return False


def _generate_keys(user: User, passphrase: str) -> None:
    """
    Generates the user's ML-KEM-768 and ML-DSA-65 keypairs: private keys go only
    into the local keystore, encrypted under the user's passphrase (which is not
    stored), and public keys into the users table. user.id must already be assigned.
    """
    kem_pub, kem_priv = CryptoEngine.generate_kem_keypair()
    dsa_pub, dsa_priv = CryptoEngine.generate_signing_keypair()

    keystore_path, kem_key_id, dsa_key_id = KeystoreManager.create_keystore(
        user_id=user.id,
        username=user.username,
        password=passphrase,
        kem_private_key=kem_priv,
        dsa_private_key=dsa_priv,
        kem_public_key=kem_pub,
        dsa_public_key=dsa_pub,
        key_version=1
    )

    user.kem_public_key = kem_pub
    user.kem_key_id = kem_key_id
    user.dsa_public_key = dsa_pub
    user.dsa_key_id = dsa_key_id
    user.key_version = 1
    user.key_status = "ACTIVE"
    user.keystore_path = keystore_path


def _local_keystores(username: str) -> List[str]:
    """This device's keystores for `username`, newest first, found by the username in each file's cleartext metadata."""
    kdir = settings.KEYSTORE_DIR
    if not os.path.isdir(kdir):
        return []
    found = []
    for name in os.listdir(kdir):
        path = os.path.join(kdir, name)
        if name.endswith(".keystore") and _keystore_metadata(path).get("username") == username:
            found.append(path)
    return sorted(found, key=os.path.getmtime, reverse=True)


def _keystore_metadata(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f).get("metadata") or {}
    except (OSError, ValueError, AttributeError):
        return {}


def _keystore_matches(path: str, ledger_keys: dict) -> bool:
    """Whether the keystore holds the keys the ledger registered, compared by the key IDs in its metadata."""
    meta = _keystore_metadata(path)
    try:
        kem_pub = base64.b64decode(ledger_keys["kem_public_key"])
        dsa_pub = base64.b64decode(ledger_keys["dsa_public_key"])
    except (KeyError, ValueError):
        return False
    return (meta.get("kem_key_id") == CryptoEngine.sha3_256(kem_pub)[:32]
            and meta.get("signing_key_id") == CryptoEngine.sha3_256(dsa_pub)[:32])


def _use_keystore(user: User, keystore_path: str, passphrase: str, ledger_keys: Optional[dict]) -> None:
    """
    Points the user at an existing keystore and fills in its public keys: from the
    key registry when the keys are registered (they were matched to the keystore
    above), otherwise from the keystore itself so they can be published.
    """
    if ledger_keys is not None:
        kem_pub = base64.b64decode(ledger_keys["kem_public_key"])
        dsa_pub = base64.b64decode(ledger_keys["dsa_public_key"])
    else:
        contents = KeystoreManager._read_and_decrypt(keystore_path, passphrase)
        kem_pub = base64.b64decode(contents["kem_public_key_b64"])
        dsa_pub = base64.b64decode(contents["dsa_public_key_b64"])
        del contents  # also holds the private keys
    user.kem_public_key = kem_pub
    user.kem_key_id = CryptoEngine.sha3_256(kem_pub)[:32]
    user.dsa_public_key = dsa_pub
    user.dsa_key_id = CryptoEngine.sha3_256(dsa_pub)[:32]
    user.key_status = "ACTIVE"
    user.keystore_path = keystore_path


def _public_key_record(user: User) -> dict:
    """The keyregistry chaincode's input for this user."""
    return {
        "username": user.username,
        "kem_algorithm": CryptoEngine.KEM_ALGORITHM,
        "kem_public_key": base64.b64encode(user.kem_public_key).decode("ascii"),
        "dsa_algorithm": CryptoEngine.SIGNATURE_ALGORITHM,
        "dsa_public_key": base64.b64encode(user.dsa_public_key).decode("ascii"),
    }


async def _unique_navy_id(db: AsyncSession, username: str) -> str:
    navy_id = f"USR-{username.upper()}"
    res = await db.execute(select(User).where(User.navy_id == navy_id))
    if res.scalar_one_or_none():
        navy_id = f"USR-{username.upper()}-{uuid.uuid4().hex[:4].upper()}"
    return navy_id


async def _new_user(db: AsyncSession, username: str, kem_pub: bytes, dsa_pub: bytes, device_id: str) -> User:
    user = User(
        username=username,
        name=username,
        navy_id=await _unique_navy_id(db, username),
        rank="User",
        command_unit="General Workspace",
        clearance_level="Confidential",
        device_id=device_id,
        role="USER",
        kem_public_key=kem_pub,
        kem_key_id=CryptoEngine.sha3_256(kem_pub)[:32] if kem_pub else "",
        dsa_public_key=dsa_pub,
        dsa_key_id=CryptoEngine.sha3_256(dsa_pub)[:32] if dsa_pub else "",
        key_version=1,
        key_status="ACTIVE",
        status="ACTIVE"
    )
    db.add(user)
    await db.flush()  # assigns user.id
    return user


async def _sync_directory(db: AsyncSession, bundle_path: str, username: str) -> None:
    """
    Mirrors the key registry into the users table so every registered user can be
    chosen as a recipient. Users whose keystore is on this device are left alone.
    Best effort: a failure here does not block sign-in.
    """
    try:
        entries = await ledger_cli.get_all_keys(bundle_path, username)
    except LedgerCliError as e:
        logger.warning(f"Recipient directory sync skipped: {e}")
        return

    for entry in entries or []:
        name = entry.get("username")
        if not name or not bundle_store.is_valid_username(name):
            continue
        try:
            kem_pub = base64.b64decode(entry["kem_public_key"], validate=True)
            dsa_pub = base64.b64decode(entry["dsa_public_key"], validate=True)
        except (KeyError, ValueError):
            continue
        if len(kem_pub) != CryptoEngine.ML_KEM_768_PUBKEY_SIZE or len(dsa_pub) != CryptoEngine.ML_DSA_65_PUBKEY_SIZE:
            continue

        res = await db.execute(select(User).where(User.username == name))
        user = res.scalar_one_or_none()
        if user is None:
            user = await _new_user(db, name, kem_pub, dsa_pub, device_id="REMOTE")
        elif user.keystore_path and os.path.exists(user.keystore_path):
            if user.kem_public_key != kem_pub or user.dsa_public_key != dsa_pub:
                logger.warning(f"Key registry entry for '{name}' differs from this device's keystore; keeping local keys")
            continue
        else:
            user.kem_public_key = kem_pub
            user.kem_key_id = CryptoEngine.sha3_256(kem_pub)[:32]
            user.dsa_public_key = dsa_pub
            user.dsa_key_id = CryptoEngine.sha3_256(dsa_pub)[:32]
        user.fabric_msp_id = entry.get("msp_id")

    await db.commit()


@rpc.method("auth.ledger_login")
async def ledger_login(
    db: AsyncSession,
    username: str,
    bundle_file: str,
    passphrase: str = "",
    passphrase_confirm: Optional[str] = None
) -> AuthResponse:
    """
    Signs in with a ledger identity: the username plus the bundle zip produced by
    blockchain/scripts/bundle-identity.sh, and the keystore passphrase. There is no
    sign-up here; identities are issued on the ledger side with new-recipient.sh.

    1. The bundle must hold exactly one identity, and it must be `username`.
    2. `cli.js whoami` must succeed with it. The peer only answers requests signed
       by a key whose certificate its org CA issued, so this proves the caller holds
       that identity's private key; the username the peer reports must match.
    3. The passphrase must unlock the user's keystore on this device. Sent without a
       passphrase (the form's first step), the call stops here with 428 and
       detail.code saying what to ask for next:
         PASSPHRASE_REQUIRED        a keystore exists; ask for its passphrase
         PASSPHRASE_SETUP_REQUIRED  no keystore yet; ask for a new passphrase and
                                    `passphrase_confirm`, then the user's ML-KEM /
                                    ML-DSA keys are generated into a new keystore
                                    under it and their public halves published to
                                    the keyregistry chaincode.
    4. The recipient directory is refreshed from the key registry.

    The passphrase is never stored: it stays in memory for the session only.
    """
    username = username.strip()
    if not bundle_store.is_valid_username(username):
        raise ApiError(400, "Username may only contain letters, digits, dots, underscores and hyphens")

    try:
        with open(bundle_file, "rb") as f:
            bundle_bytes = f.read()
    except OSError as e:
        raise ApiError(400, f"Could not read the identity bundle: {e.strerror or e}")

    try:
        staged = bundle_store.stage_bundle(bundle_bytes)
    except BundleError as e:
        raise ApiError(400, f"Invalid identity bundle: {e}")

    try:
        if staged.username != username:
            raise ApiError(401, f"This bundle is the identity of '{staged.username}', not '{username}'")
        try:
            who = await ledger_cli.whoami(staged.root, username)
        except LedgerCliError as e:
            if e.kind in ("network", "config"):
                raise _ledger_error(e, "Ledger sign-in failed")
            raise ApiError(401, f"The ledger rejected this identity: {e}. "
                           "Bundles stop working when the network is rebuilt with setup.sh; request a new one.")
        if who.get("username") != username:
            raise ApiError(401, f"The ledger sees this identity as '{who.get('username')}', not '{username}'")
        bundle_path = bundle_store.install_bundle(staged)
    finally:
        bundle_store.discard(staged)

    try:
        ledger_keys = await ledger_cli.get_keys(bundle_path, username, username)
    except LedgerCliError as e:
        raise _ledger_error(e, "Could not read your public keys from the ledger")

    res = await db.execute(select(User).where(User.username == username))
    user = res.scalar_one_or_none()

    # The database is wiped at every sign-out, so the keystore is found on disk.
    keystores = _local_keystores(username)
    if ledger_keys is not None:
        keystore_path = next((k for k in keystores if _keystore_matches(k, ledger_keys)), None)
        if keystore_path is None and keystores:
            raise ApiError(409, f"The public keys registered on the ledger for '{username}' do not match "
                                "any keystore on this device.")
        if keystore_path is None:
            raise ApiError(409, f"'{username}' already published keys to the ledger from another installation, "
                                "and the matching private keys are not on this device.")
    else:
        # Not registered yet (for example, a rebuilt network): reuse the newest keystore and publish its keys.
        keystore_path = keystores[0] if keystores else None
    has_keystore = keystore_path is not None

    if has_keystore:
        if not passphrase:
            raise ApiError(428, {"code": "PASSPHRASE_REQUIRED", "message": "Enter your keystore passphrase."})
        if not KeystoreManager.verify_password(keystore_path, passphrase):
            raise ApiError(401, "Incorrect keystore passphrase")
    else:
        # First sign-in on this device: the user chooses the passphrase that will protect their keys.
        if not passphrase or passphrase_confirm is None:
            raise ApiError(428, {
                "code": "PASSPHRASE_SETUP_REQUIRED",
                "message": "There is no keystore on this device yet. Choose a passphrase to create one."
            })
        if len(passphrase) < MIN_PASSPHRASE_LENGTH:
            raise ApiError(400, f"Passphrase must be at least {MIN_PASSPHRASE_LENGTH} characters")
        if passphrase != passphrase_confirm:
            raise ApiError(400, "Passphrases do not match")

    if user is None:
        user = await _new_user(db, username, b"", b"", device_id=f"DEV-{uuid.uuid4().hex[:6].upper()}")
    if has_keystore:
        _use_keystore(user, keystore_path, passphrase, ledger_keys)
    else:
        _generate_keys(user, passphrase)

    user.fabric_msp_id = who.get("msp_id")
    user.bundle_path = bundle_path
    user.role = "ADMIN" if who.get("is_admin") else "USER"
    await db.commit()
    await db.refresh(user)

    if ledger_keys is None:
        # If this fails the keystore stays; the next sign-in retries the publish.
        try:
            await ledger_cli.register_keys(bundle_path, username, _public_key_record(user))
        except LedgerCliError as e:
            raise _ledger_error(e, "Could not publish your public keys to the ledger")

    await _sync_directory(db, bundle_path, username)
    await db.refresh(user)

    rpc.sign_in(session_store.create(user.id, passphrase, settings.SESSION_TTL_MINUTES * 60), user.id)

    return AuthResponse(
        user=user_to_schema(user),
        message=f"Signed in as {username} ({user.fabric_msp_id})."
    )


@rpc.method("auth.logout")
async def logout() -> dict:
    """Ends the session: forgets its keystore passphrase and wipes this device's local data."""
    rpc.sign_out()
    await local_data.wipe()
    return {"message": "Session terminated successfully"}


@rpc.method("auth.me")
async def get_current_user(current_user: User) -> UserSchema:
    """The signed-in user's account details."""
    return user_to_schema(current_user)


def _certificate_info(bundle_path: str) -> Optional[CertificateInfo]:
    from cryptography import x509
    from cryptography.x509.oid import NameOID

    cert_path = bundle_store.certificate_path(bundle_path)
    if not cert_path:
        return None
    with open(cert_path, "rb") as f:
        cert = x509.load_pem_x509_certificate(f.read())

    def first(name, oid):
        values = name.get_attributes_for_oid(oid)
        return values[0].value if values else ""

    return CertificateInfo(
        common_name=first(cert.subject, NameOID.COMMON_NAME),
        role=first(cert.subject, NameOID.ORGANIZATIONAL_UNIT_NAME),
        issuer=first(cert.issuer, NameOID.COMMON_NAME),
        expires_at=cert.not_valid_after_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    )


@rpc.method("auth.me_ledger")
async def get_ledger_identity(current_user: User) -> LedgerIdentityStatus:
    """The signed-in user's ledger certificate and key-registry status, read live from the ledger."""
    bundle_path = current_user.bundle_path
    if not bundle_path or not os.path.isdir(bundle_path):
        return LedgerIdentityStatus(key_registry_status="UNAVAILABLE", detail="No identity bundle on this device")

    certificate = _certificate_info(bundle_path)
    try:
        ledger_keys = await ledger_cli.get_keys(bundle_path, current_user.username, current_user.username)
    except LedgerCliError as e:
        return LedgerIdentityStatus(certificate=certificate, key_registry_status="UNAVAILABLE", detail=str(e))

    if ledger_keys is None:
        return LedgerIdentityStatus(certificate=certificate, key_registry_status="NOT_REGISTERED")
    return LedgerIdentityStatus(
        certificate=certificate,
        key_registry_status="REGISTERED" if _keys_match(ledger_keys, current_user) else "MISMATCH",
        registered_at=ledger_keys.get("registered_at")
    )
