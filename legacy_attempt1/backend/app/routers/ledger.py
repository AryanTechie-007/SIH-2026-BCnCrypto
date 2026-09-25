from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import LedgerBlock

router = APIRouter(prefix="/api/ledger", tags=["Ledger"])

@router.get("/blocks")
async def get_blocks(db: AsyncSession = Depends(get_db)):
    """Lists all blocks in the ledger for the explorer UI."""
    result = await db.execute(select(LedgerBlock).order_by(LedgerBlock.id.asc()))
    blocks = result.scalars().all()
    return [
        {
            "blockIndex": b.id,
            "blockId": f"BLK-{b.id}",
            "timestamp": b.timestamp.isoformat(),
            "prevBlockHash": b.prev_block_hash,
            "merkleRoot": b.merkle_root,
            "data": b.data
        } for b in blocks
    ]

@router.get("/verify")
async def verify_ledger(db: AsyncSession = Depends(get_db)):
    """Verifies the integrity of the entire ledger chain."""
    from ..services.ledger_service import LedgerService
    ls = LedgerService()
    is_valid, broken_id = await ls.verify_integrity(db)
    return {
        "isValid": is_valid,
        "brokenBlockId": broken_id,
        "status": "INTEGRITY_VERIFIED" if is_valid else "TAMPER_DETECTED"
    }
