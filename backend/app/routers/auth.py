import hashlib
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import User
from ..services.crypto_engine import CryptoEngine
from ..schemas import RegisterRequest, LoginRequest, UserSchema, AuthResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

SALT = "CIPHERTRACE_SECURE_AUTH_SALT_2026"
LEGACY_SALT = "CIPHERTRACE_MILITARY_AIRGAP_SALT_2026"

def hash_password(password: str, salt: str = SALT) -> str:
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()

def user_to_schema(u: User) -> UserSchema:
    return UserSchema(
        id=u.id,
        username=u.username,
        name=u.name,
        navy_id=u.navy_id,
        rank=u.rank,
        command_unit=u.command_unit,
        clearance_level=u.clearance_level,
        device_id=u.device_id,
        status=u.status,
        ml_kem_pub_preview=f"0x{u.kem_public_key[:16].hex()}... ({len(u.kem_public_key)} B)",
        ml_dsa_pub_preview=f"0x{u.dsa_public_key[:16].hex()}... ({len(u.dsa_public_key)} B)"
    )

@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Registers a new user account with real NIST PQC keypairs."""
    cleaned_username = req.username.strip().lower()
    if not cleaned_username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    if not req.password:
        raise HTTPException(status_code=400, detail="Password cannot be empty")

    # Check for existing username
    res = await db.execute(select(User).where(User.username == cleaned_username))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Username '{cleaned_username}' is already registered")

    navy_id = req.navy_id or f"USR-{cleaned_username.upper()}"
    res_navy = await db.execute(select(User).where(User.navy_id == navy_id))
    if res_navy.scalar_one_or_none():
        navy_id = f"USR-{cleaned_username.upper()}-{uuid.uuid4().hex[:4].upper()}"

    device_id = req.device_id or f"DEV-{uuid.uuid4().hex[:6].upper()}"

    # Generate real NIST PQC keypairs
    kem_pub, kem_priv = CryptoEngine.generate_kem_keypair()
    dsa_pub, dsa_priv = CryptoEngine.generate_signing_keypair()

    new_user = User(
        username=cleaned_username,
        password_hash=hash_password(req.password),
        name=req.display_name.strip() or cleaned_username.capitalize(),
        navy_id=navy_id,
        rank=req.rank or "User",
        command_unit=req.command_unit or "General Workspace",
        clearance_level=req.clearance_level or "Confidential",
        device_id=device_id,
        kem_public_key=kem_pub,
        kem_private_key=kem_priv,
        dsa_public_key=dsa_pub,
        dsa_private_key=dsa_priv,
        status="ACTIVE"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    user_schema = user_to_schema(new_user)
    return AuthResponse(
        user=user_schema,
        token=f"TOKEN-{new_user.id}-{uuid.uuid4().hex[:12]}",
        message=f"User '{new_user.name}' registered with fresh NIST ML-KEM-768 and ML-DSA-65 keypairs."
    )

@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticates user credentials against hashed account record."""
    cleaned_username = req.username.strip().lower()
    res = await db.execute(select(User).where(User.username == cleaned_username))
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Verify password against current salt or legacy salt
    is_valid = (user.password_hash == hash_password(req.password, SALT))
    if not is_valid and user.password_hash == hash_password(req.password, LEGACY_SALT):
        is_valid = True
        # Upgrade hash to current salt
        user.password_hash = hash_password(req.password, SALT)
        await db.commit()

    if not is_valid and user.password_hash == "test_hash":
        is_valid = True
        # Initialize password upon first login
        user.password_hash = hash_password(req.password, SALT)
        await db.commit()

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return AuthResponse(
        user=user_to_schema(user),
        token=f"TOKEN-{user.id}-{uuid.uuid4().hex[:12]}",
        message="Authentication successful"
    )

@router.get("/users", response_model=List[UserSchema])
async def list_users(db: AsyncSession = Depends(get_db)):
    """Lists all registered users for recipient selection."""
    res = await db.execute(select(User).order_by(User.id.asc()))
    users = res.scalars().all()
    return [user_to_schema(u) for u in users]

@router.get("/me", response_model=UserSchema)
async def get_current_user(user_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """Retrieves active user details."""
    if not user_id:
        # Fall back to first user if exists
        res = await db.execute(select(User).order_by(User.id.asc()))
        u = res.scalars().first()
        if not u:
            raise HTTPException(status_code=404, detail="No user accounts exist yet. Please register.")
        return user_to_schema(u)

    res = await db.execute(select(User).where(User.id == user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Operator not found")
    return user_to_schema(u)
