from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.database import User
from ..schemas import OfficerSchema

router = APIRouter(prefix="/api/identity", tags=["Identity"])


@router.get("/officers", response_model=List[OfficerSchema])
async def list_enrolled_officers(db: AsyncSession = Depends(get_db)):
    """Lists all enrolled recipients with their post-quantum public keys (NO private keys)."""
    result = await db.execute(select(User).order_by(User.id.asc()))
    users = result.scalars().all()
    return [
        OfficerSchema(
            id=u.id,
            username=u.username,
            navy_id=u.navy_id,
            name=u.name,
            rank=u.rank or "User",
            command_unit=u.command_unit or "General",
            clearance_level=u.clearance_level or "Confidential",
            device_id=u.device_id,
            role=u.role or "USER",
            status=u.status,
            kem_key_id=u.kem_key_id or "",
            dsa_key_id=u.dsa_key_id or "",
            key_status=u.key_status or "ACTIVE",
            ml_kem_pub_preview=f"0x{u.kem_public_key[:16].hex()}... ({len(u.kem_public_key)} bytes)",
            ml_dsa_pub_preview=f"0x{u.dsa_public_key[:16].hex()}... ({len(u.dsa_public_key)} bytes)"
        )
        for u in users
    ]
