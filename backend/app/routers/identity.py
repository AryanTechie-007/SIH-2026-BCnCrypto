from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.database import User
from ..schemas import OfficerSchema

router = APIRouter(prefix="/api/identity", tags=["Identity"])

@router.get("/officers", response_model=List[OfficerSchema])
async def list_enrolled_officers(db: AsyncSession = Depends(get_db)):
    """Lists all enrolled recipients with their post-quantum public keys."""
    result = await db.execute(select(User).order_by(User.id.asc()))
    users = result.scalars().all()
    return [
        OfficerSchema(
            id=u.id,
            username=u.username,
            navy_id=u.navy_id,
            name=u.name,
            rank=u.rank,
            command_unit=u.command_unit,
            clearance_level=u.clearance_level,
            device_id=u.device_id,
            status=u.status,
            ml_kem_pub_preview=f"0x{u.kem_public_key[:16].hex()}... ({len(u.kem_public_key)} bytes)",
            ml_dsa_pub_preview=f"0x{u.dsa_public_key[:16].hex()}... ({len(u.dsa_public_key)} bytes)"
        )
        for u in users
    ]

@router.get("/officers/{officer_id}", response_model=OfficerSchema)
async def get_officer(officer_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves identity credentials for a specific recipient."""
    result = await db.execute(select(User).where(User.id == officer_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User identity token not found in registry")
    return OfficerSchema(
        id=u.id,
        username=u.username,
        navy_id=u.navy_id,
        name=u.name,
        rank=u.rank,
        command_unit=u.command_unit,
        clearance_level=u.clearance_level,
        device_id=u.device_id,
        status=u.status,
        ml_kem_pub_preview=f"0x{u.kem_public_key[:16].hex()}... ({len(u.kem_public_key)} bytes)",
        ml_dsa_pub_preview=f"0x{u.dsa_public_key[:16].hex()}... ({len(u.dsa_public_key)} bytes)"
    )
