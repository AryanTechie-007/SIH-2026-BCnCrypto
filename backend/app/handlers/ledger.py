from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app import rpc
from app.models.database import LedgerBlock
from app.services.ledger_engine import LedgerEngine

ledger_engine = LedgerEngine()


@rpc.method("ledger.blocks")
async def get_all_blocks(db: AsyncSession) -> list:
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
