from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app import rpc
from app.models.database import User
from app.schemas import OfficerSchema


@rpc.method("identity.officers")
async def list_enrolled_officers(db: AsyncSession) -> List[OfficerSchema]:
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
