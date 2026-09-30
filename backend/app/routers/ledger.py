from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import LedgerBlock
from ..services.ledger_engine import LedgerEngine

router = APIRouter(prefix="/api/ledger", tags=["Ledger"])

ledger_engine = LedgerEngine()

@router.get("/blocks")
async def get_all_blocks(db: AsyncSession = Depends(get_db)):
    """Retrieves all blocks on the permissioned air-gapped ledger."""
    await ledger_engine.init_genesis_block_if_needed(db)
    result = await db.execute(select(LedgerBlock).order_by(LedgerBlock.id.asc()))
    blocks = result.scalars().all()
    return [
        {
            "block_index": b.id,
            "block_hash": b.block_hash,
            "prev_block_hash": b.prev_block_hash,
            "merkle_root": b.merkle_root,
            "timestamp": b.timestamp.isoformat() if hasattr(b.timestamp, 'isoformat') else str(b.timestamp),
            "data": b.data,
            "endorsers": b.endorsers.split(","),
            "is_tampered": b.is_tampered
        }
        for b in blocks
    ]
