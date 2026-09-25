from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any
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

@router.get("/verify")
async def verify_ledger_integrity(db: AsyncSession = Depends(get_db)):
    """Executes cryptographic audit verifying hash chains, Merkle roots, and consensus endorsements."""
    await ledger_engine.init_genesis_block_if_needed(db)
    is_valid, report = await ledger_engine.verify_chain(db)
    return {
        "chain_integrity_valid": is_valid,
        "total_blocks": len(report),
        "audit_timestamp": "UTC",
        "detailed_block_report": report
    }

@router.post("/tamper")
async def simulate_insider_tamper(block_index: int = 1, db: AsyncSession = Depends(get_db)):
    """Simulates an insider rogue administrator modifying Block #1 to frame another officer."""
    result = await db.execute(select(LedgerBlock).where(LedgerBlock.id == block_index))
    block = result.scalar_one_or_none()
    if not block:
        # Fall back to tampering genesis if only 1 block exists
        result = await db.execute(select(LedgerBlock).order_by(LedgerBlock.id.desc()))
        block = result.scalars().first()
    if not block:
        raise HTTPException(status_code=404, detail="No ledger blocks available to tamper")

    block.is_tampered = True
    block.data = block.data.replace("NAVY-0001", "ROGUE_FORGERY_ATTEMPT_XXX")
    await db.commit()
    return {
        "status": "TAMPER_SIMULATION_ACTIVE",
        "message": f"Block #{block.id} was maliciously altered by simulated insider. Hash chain and signature validation will now detect violation.",
        "tampered_block_index": block.id
    }

@router.post("/restore")
async def restore_ledger_integrity(db: AsyncSession = Depends(get_db)):
    """Restores pristine cryptographic ledger state."""
    result = await db.execute(select(LedgerBlock).where(LedgerBlock.is_tampered == True))
    tampered_blocks = result.scalars().all()
    for b in tampered_blocks:
        b.is_tampered = False
        b.data = b.data.replace("ROGUE_FORGERY_ATTEMPT_XXX", "NAVY-0001")
    await db.commit()
    return {
        "status": "RESTORED",
        "message": "Ledger state restored to pristine mathematical consensus."
    }
