from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import LedgerBlock
import random

router = APIRouter(prefix="/api/ledger/demo", tags=["Ledger Demo"])

@router.post("/tamper")
async def tamper_ledger(db: AsyncSession = Depends(get_db)):
    """
    Intentionally modifies a ledger record to demonstrate the tamper detection system.
    """
    # 1. Pick a random block
    result = await db.execute(select(LedgerBlock).order_by(LedgerBlock.id.desc()).limit(5))
    blocks = result.scalars().all()

    if not blocks:
        raise HTTPException(status_code=404, detail="No blocks found to tamper with")

    target_block = random.choice(blocks)

    # 2. Modify the data (flip a character)
    original_data = target_block.data
    tampered_data = "TAMPERED_" + original_data[9:] if len(original_data) > 9 else "TAMPERED"
    target_block.data = tampered_data

    await db.commit()

    return {
        "status": "Tampered",
        "block_id": target_block.id,
        "original_data_snippet": original_data[:20],
        "tampered_data_snippet": tampered_data[:20],
        "message": "Block intentionally corrupted. The next integrity check should fail."
    }
