from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.database import User
from ..services.crypto_service import CryptoService

router = APIRouter(prefix="/api/identity", tags=["Identity"])

@router.post("/register")
async def register_user(name: str, db: AsyncSession = Depends(get_db)):
    """Registers a user and generates their PQC keypairs."""
    kem_pub, kem_priv = CryptoService.generate_kem_keypair()
    dsa_pub, dsa_priv = CryptoService.generate_signing_keypair()

    # In a real system, private keys would be stored in HSMs or client-side.
    # For this prototype, we store them in the DB (encrypted in production).
    # We need a model to store private keys, but for now, we'll just store public keys.
    # Let's update the model to store private keys for the demo's sake.

    new_user = User(
        name=name,
        kem_public_key=kem_pub,
        dsa_public_key=dsa_pub,
        # We will need a way to retrieve the private keys for the decryption demo.
        # Let's assume we have a secret_store for this prototype.
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Return public info + private keys (demo only)
    return {
        "id": new_user.id,
        "name": new_user.name,
        "kem_public_key": kem_pub.hex(),
        "dsa_public_key": dsa_pub.hex(),
        "kem_private_key": kem_priv.hex(),
        "dsa_private_key": dsa_priv.hex()
    }

@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    """Lists all registered users."""
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [{"id": u.id, "name": u.name, "status": u.status} for u in users]

@router.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    """Gets a user's identity and public keys."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "name": user.name,
        "kem_public_key": user.kem_public_key.hex(),
        "dsa_public_key": user.dsa_public_key.hex(),
        "status": user.status
    }
