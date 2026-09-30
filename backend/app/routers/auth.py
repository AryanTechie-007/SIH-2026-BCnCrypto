import os
import base64
import logging
import secrets
import uuid
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException, Header, Response, Cookie, Form, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.database import get_db
from app.models.database import User
from app.services import bundle_store, ledger_cli
from app.services.bundle_store import BundleError
from app.services.crypto_engine import CryptoEngine
from app.services.keystore import KeystoreManager
from app.services.ledger_cli import LedgerCliError
from app.schemas import UserSchema, AuthResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
logger = logging.getLogger("ciphertrace.auth")


def create_access_token(user_id: int, username: str, role: str) -> str:
    """Issues signed JWT access token."""
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRY_MINUTES),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def user_to_schema(u: User, include_secret: bool = True) -> UserSchema:
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
        keystore_password=(u.keystore_password or "") if include_secret else "",
        fabric_msp_id=u.fabric_msp_id
    )


async def get_current_user_from_token(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency: extracts and verifies JWT identity from Authorization header or Cookie."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif access_token:
        token = access_token

    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required")

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = int(payload.get("sub"))
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Authentication token has expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User account no longer exists")
    if user.status != "ACTIVE":
        raise HTTPException(status_code=403, detail="User account is deactivated")
    if user.key_status == "REVOKED":
        raise HTTPException(status_code=403, detail="User cryptographic key has been revoked")

    return user


def require_role(allowed_roles: List[str]):
    """Enforces role-based authorization check."""
    async def role_checker(current_user: User = Depends(get_current_user_from_token)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Action requires one of roles {allowed_roles}, your role is {current_user.role}"
            )
        return current_user
    return role_checker


# ── Ledger identity sign-in ──────────────────────────────────────────────

def _ledger_http_error(err: LedgerCliError, action: str) -> HTTPException:
    if err.kind == "network":
        return HTTPException(status_code=503, detail=f"Ledger unreachable: {err}. Is the Fabric network running?")
    if err.kind == "config":
        return HTTPException(status_code=500, detail=f"Ledger client is not set up: {err}")
    return HTTPException(status_code=502, detail=f"{action}: {err}")


def _keys_match(ledger_keys: dict, user: User) -> bool:
    try:
        return (base64.b64decode(ledger_keys["kem_public_key"]) == user.kem_public_key
                and base64.b64decode(ledger_keys["dsa_public_key"]) == user.dsa_public_key)
    except (KeyError, ValueError):
        return False


def _generate_keys(user: User) -> None:
    """
    Generates the user's ML-KEM-768 and ML-DSA-65 keypairs, exactly as registration
    used to: private keys go only into the encrypted local keystore, public keys
    into the users table. user.id must already be assigned.
    """
    kem_pub, kem_priv = CryptoEngine.generate_kem_keypair()
    dsa_pub, dsa_priv = CryptoEngine.generate_signing_keypair()

    # 16-bit pseudorandom keystore passcode (0x0000 to 0xFFFF)
    keystore_secret = f"0x{secrets.randbelow(65536):04X}"

    keystore_path, kem_key_id, dsa_key_id = KeystoreManager.create_keystore(
        user_id=user.id,
        username=user.username,
        password=keystore_secret,
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
    user.keystore_password = keystore_secret


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


@router.post("/ledger-login", response_model=AuthResponse)
async def ledger_login(
    response: Response,
    username: str = Form(...),
    bundle: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Signs in with a ledger identity: the username plus the bundle zip produced by
    blockchain/scripts/bundle-identity.sh. There is no password and no sign-up here;
    identities are issued on the ledger side with new-recipient.sh.

    1. The bundle must hold exactly one identity, and it must be `username`.
    2. `cli.js whoami` must succeed with it. The peer only answers requests signed
       by a key whose certificate its org CA issued, so this proves the caller holds
       that identity's private key; the username the peer reports must match.
    3. On first sign-in the user's ML-KEM / ML-DSA keys are generated into a local
       keystore and their public halves published to the keyregistry chaincode.
    4. The recipient directory is refreshed from the key registry.
    """
    username = username.strip()
    if not bundle_store.is_valid_username(username):
        raise HTTPException(status_code=400, detail="Username may only contain letters, digits, dots, underscores and hyphens")

    try:
        staged = bundle_store.stage_bundle(await bundle.read())
    except BundleError as e:
        raise HTTPException(status_code=400, detail=f"Invalid identity bundle: {e}")

    try:
        if staged.username != username:
            raise HTTPException(
                status_code=401,
                detail=f"This bundle is the identity of '{staged.username}', not '{username}'"
            )
        try:
            who = await ledger_cli.whoami(staged.root, username)
        except LedgerCliError as e:
            if e.kind in ("network", "config"):
                raise _ledger_http_error(e, "Ledger sign-in failed")
            raise HTTPException(
                status_code=401,
                detail=f"The ledger rejected this identity: {e}. "
                       "Bundles stop working when the network is rebuilt with setup.sh; request a new one."
            )
        if who.get("username") != username:
            raise HTTPException(
                status_code=401,
                detail=f"The ledger sees this identity as '{who.get('username')}', not '{username}'"
            )
        bundle_path = bundle_store.install_bundle(staged)
    finally:
        bundle_store.discard(staged)

    try:
        ledger_keys = await ledger_cli.get_keys(bundle_path, username, username)
    except LedgerCliError as e:
        raise _ledger_http_error(e, "Could not read your public keys from the ledger")

    res = await db.execute(select(User).where(User.username == username))
    user = res.scalar_one_or_none()
    has_keystore = bool(user and user.keystore_path and os.path.exists(user.keystore_path))

    if ledger_keys is not None and not has_keystore:
        raise HTTPException(
            status_code=409,
            detail=f"'{username}' already published keys to the ledger from another installation, "
                   "and the matching private keys are not on this device."
        )
    if ledger_keys is not None and not _keys_match(ledger_keys, user):
        raise HTTPException(
            status_code=409,
            detail=f"The public keys registered on the ledger for '{username}' do not match this device's keystore."
        )

    if user is None:
        user = await _new_user(db, username, b"", b"", device_id=f"DEV-{uuid.uuid4().hex[:6].upper()}")
        _generate_keys(user)
    elif not has_keystore:
        _generate_keys(user)

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
            raise _ledger_http_error(e, "Could not publish your public keys to the ledger")

    await _sync_directory(db, bundle_path, username)
    await db.refresh(user)

    token = create_access_token(user.id, user.username, user.role)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.DEMO_MODE,
        max_age=settings.JWT_EXPIRY_MINUTES * 60
    )

    return AuthResponse(
        user=user_to_schema(user),
        token=token,
        message=f"Signed in as {username} ({user.fabric_msp_id})."
    )


@router.post("/logout")
async def logout(response: Response):
    """Clears authentication session cookies."""
    response.delete_cookie(key="access_token")
    return {"message": "Session terminated successfully"}


@router.get("/users", response_model=List[UserSchema])
async def list_users(db: AsyncSession = Depends(get_db)):
    """Lists registered users (public cryptographic metadata only; NO private keys)."""
    res = await db.execute(select(User).order_by(User.id.asc()))
    users = res.scalars().all()
    return [user_to_schema(u, include_secret=False) for u in users]


@router.get("/me", response_model=UserSchema)
async def get_current_user(
    current_user: User = Depends(get_current_user_from_token)
):
    """Retrieves active user details for the authenticated session."""
    return user_to_schema(current_user)
