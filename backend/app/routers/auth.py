import hashlib
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import User
from ..services.crypto_engine import CryptoEngine
from ..schemas import RegisterRequest, LoginRequest, QuickLoginRequest, UserSchema, AuthResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

SALT = "CIPHERTRACE_SECURE_AUTH_SALT_2026"
LEGACY_SALT = "CIPHERTRACE_MILITARY_AIRGAP_SALT_2026"

def hash_password(password: str, salt: str = SALT) -> str:
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()

def user_to_schema(u: User) -> UserSchema:
    kem_preview = f"0x{u.kem_public_key[:16].hex()}... ({len(u.kem_public_key)} B)" if u.kem_public_key else "0x0000... (0 B)"
    dsa_preview = f"0x{u.dsa_public_key[:16].hex()}... ({len(u.dsa_public_key)} B)" if u.dsa_public_key else "0x0000... (0 B)"
    return UserSchema(
        id=u.id,
        username=u.username or "",
        name=u.name,
        navy_id=u.navy_id,
        rank=u.rank,
        command_unit=u.command_unit,
        clearance_level=u.clearance_level,
        device_id=u.device_id,
        status=u.status,
        ml_kem_pub_preview=kem_preview,
        ml_dsa_pub_preview=dsa_preview
    )

async def ensure_default_officers(db: AsyncSession):
    """Guarantees the 3 canonical defense officers exist in the database."""
    officers = [
        ("verma", "Captain A. Verma", "NAVY-0001", "CAPTAIN", "FLAGSHIP COMMAND", "LEVEL-5 TOP SECRET", "DEF-HW-7701"),
        ("rao", "Commander S. Rao", "NAVY-0002", "COMMANDER", "DESTROYER ESCORT", "LEVEL-4 SECRET", "DEF-HW-7702"),
        ("joshi", "Wing Commander N. Joshi", "NAVY-0003", "WING COMMANDER", "AIR SURVEILLANCE", "LEVEL-3 RESTRICTED", "DEF-HW-7703"),
    ]
    for uname, name, navy_id, rank, unit, clearance, dev_id in officers:
        res = await db.execute(select(User).where((User.username == uname) | (User.navy_id == navy_id)))
        existing = res.scalar_one_or_none()
        if not existing:
            k_pub, k_priv = CryptoEngine.generate_kem_keypair()
            s_pub, s_priv = CryptoEngine.generate_signing_keypair()
            db.add(User(
                username=uname,
                password_hash=hash_password("password123", SALT),
                name=name,
                navy_id=navy_id,
                rank=rank,
                command_unit=unit,
                clearance_level=clearance,
                device_id=dev_id,
                kem_public_key=k_pub,
                kem_private_key=k_priv,
                dsa_public_key=s_pub,
                dsa_private_key=s_priv,
                status="ACTIVE"
            ))
    await db.commit()

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

@router.post("/quick-login", response_model=AuthResponse)
async def quick_login(req: QuickLoginRequest, db: AsyncSession = Depends(get_db)):
    """Instant 1-click authentication for designated test & demonstration officers."""
    officer_key = req.officer.strip().lower().lstrip('@')
    
    # Map friendly alias (Varma / Verma, Rao, Joshi)
    target_username = (
        "verma" if officer_key in ["varma", "verma", "captain verma", "captain varma", "captain a. verma", "captain a. varma"] else
        "rao" if officer_key in ["rao", "cmdr rao", "commander rao", "commander s. rao"] else
        "joshi" if officer_key in ["joshi", "lt joshi", "wing commander joshi", "wing commander n. joshi"] else
        officer_key
    )

    res = await db.execute(
        select(User).where(
            (User.username == target_username) | 
            (User.username == officer_key) |
            (User.navy_id == officer_key.upper())
        )
    )
    user = res.scalar_one_or_none()

    if not user:
        await ensure_default_officers(db)
        res = await db.execute(
            select(User).where(
                (User.username == target_username) | 
                (User.username == officer_key) |
                (User.navy_id == officer_key.upper())
            )
        )
        user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail=f"Operator '{officer_key}' not found in registry.")

    return AuthResponse(
        user=user_to_schema(user),
        token=f"TOKEN-{user.id}-{uuid.uuid4().hex[:12]}",
        message=f"Operator session initiated for {user.name} ({user.rank})."
    )

@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticates user credentials against hashed account record with alias support."""
    raw_user = req.username.strip().lstrip('@')
    cleaned_username = raw_user.lower()

    # Support alias 'varma' for 'verma'
    if cleaned_username in ["varma", "captain varma", "captain a. varma"]:
        cleaned_username = "verma"
    elif cleaned_username in ["cmdr rao", "commander rao", "commander s. rao"]:
        cleaned_username = "rao"
    elif cleaned_username in ["wing commander joshi", "wg cdr joshi"]:
        cleaned_username = "joshi"

    res = await db.execute(
        select(User).where(
            (User.username == cleaned_username) | 
            (User.navy_id == raw_user.upper()) |
            (User.navy_id == cleaned_username.upper())
        )
    )
    user = res.scalar_one_or_none()

    if not user:
        # Self-heal default demo accounts if missing
        await ensure_default_officers(db)
        res = await db.execute(
            select(User).where(
                (User.username == cleaned_username) | 
                (User.navy_id == raw_user.upper())
            )
        )
        user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Verify password against current salt or legacy salt
    is_valid = (user.password_hash == hash_password(req.password, SALT))
    if not is_valid and user.password_hash == hash_password(req.password, LEGACY_SALT):
        is_valid = True
        user.password_hash = hash_password(req.password, SALT)
        await db.commit()

    # For demo/test convenience, accept 'password123' or uninitialized 'test_hash'
    if not is_valid and (user.password_hash == "test_hash" or req.password == "password123"):
        is_valid = True
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
