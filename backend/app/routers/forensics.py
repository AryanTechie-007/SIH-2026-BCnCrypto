from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import WatermarkRecord, DecryptionEvent, User, Distribution
from ..services.watermark_service import WatermarkService
from ..services.embedding_service import EmbeddingService
from ..services.ledger_service import LedgerService
from ..services.crypto_service import CryptoService

router = APIRouter(prefix="/api/forensics", tags=["Forensics"])

embedding_service = EmbeddingService()
ledger_service = LedgerService()

@router.post("/analyze")
async def analyze_leak(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """
    The Forensic Analysis Pipeline:
    1. Extract watermark from PDF.
    2. Decode ECC.
    3. Match payload to event in DB.
    4. Verify Ledger record & Signature.
    5. Identify Recipient.
    """
    # 1. Save uploaded leaked file
    import os
    temp_path = f"temp_leak_{file.filename}"
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())

    # 2. Extract Watermark
    try:
        payload = embedding_service.extract_watermark(temp_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Watermark extraction failed: {str(e)}")

    # 3. Match payload to record
    result = await db.execute(select(WatermarkRecord).where(WatermarkRecord.watermark_payload == payload))
    record = result.scalar_one_or_none()

    if not record:
        return {"status": "UNKNOWN", "detail": "No matching watermark found in ledger."}

    # 4. Retrieve Event and User
    result = await db.execute(select(DecryptionEvent).where(DecryptionEvent.id == record.event_id))
    event = result.scalar_one()

    result = await db.execute(select(Distribution).where(Distribution.id == event.distribution_id))
    dist = result.scalar_one()

    result = await db.execute(select(User).where(User.id == dist.recipient_id))
    user = result.scalar_one()

    # 5. Verify Ledger Integrity
    is_valid, broken_id = await ledger_service.verify_integrity(db)

    return {
        "status": "IDENTIFIED",
        "recipient": {
            "id": user.id,
            "name": user.name
        },
        "event": {
            "id": event.id,
            "timestamp": event.timestamp,
            "device_id": event.device_id
        },
        "verification": {
            "watermark_match": True,
            "ledger_integrity": is_valid,
            "broken_block": broken_id
        }
    }
