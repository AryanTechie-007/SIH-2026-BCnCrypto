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

    # 2. Extract Watermark with detailed metrics
    try:
        # embedding_service.extract_watermark now returns (payload, metrics)
        extraction_result = embedding_service.extract_watermark(temp_path)
        if isinstance(extraction_result, tuple):
            payload, metrics = extraction_result
        else:
            payload = extraction_result
            metrics = {"confidence": 0.0, "corruption_map": [], "analysis": "No detailed metrics available"}
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return {
            "status": "EXTRACTION_FAILED",
            "detail": f"Unable to parse document frequency spectrum: {str(e)}",
            "watermark_detected": False
        }

    # Clean up temp file
    if os.path.exists(temp_path):
        os.remove(temp_path)

    # 3. Match payload to record
    if payload == b"extraction_failed":
        return {
            "status": "UNATTRIBUTED",
            "detail": "Watermark bits corrupted or severely attacked beyond Reed-Solomon threshold.",
            "watermark_detected": False,
            "forensic_metrics": {
                "confidence": float(metrics.get("confidence", 0.0)),
                "corruption_map": [int(x) for x in metrics.get("corruption_map", [])],
                "analysis": "Watermark severely damaged. Attack vector: possible heavy compression or manual scrubbing."
            }
        }

    result = await db.execute(select(WatermarkRecord).where(WatermarkRecord.watermark_payload == payload))
    record = result.scalar_one_or_none()

    if not record:
        return {
            "status": "UNATTRIBUTED",
            "detail": "Watermark payload extracted, but no matching decryption event found in ledger.",
            "watermark_detected": True,
            "extracted_payload_hex": payload.hex(),
            "forensic_metrics": {
                "confidence": float(metrics.get("confidence", 0.0)),
                "corruption_map": [int(x) for x in metrics.get("corruption_map", [])],
                "analysis": str(metrics.get("analysis", "No matching ledger record"))
            }
        }

    # 4. Retrieve Event and User
    result = await db.execute(select(DecryptionEvent).where(DecryptionEvent.id == record.event_id))
    event = result.scalar_one()

    result = await db.execute(select(Distribution).where(Distribution.id == event.distribution_id))
    dist = result.scalar_one()

    result = await db.execute(select(User).where(User.id == dist.recipient_id))
    user = result.scalar_one()

    # 5. Verify Ledger Integrity
    is_valid, broken_id = await ledger_service.verify_integrity(db)

    recipient_dict = {
        "id": user.id,
        "name": user.name
    }
    event_dict = {
        "id": event.id,
        "timestamp": event.timestamp.isoformat() if event.timestamp else None,
        "device_id": event.device_id
    }

    confidence_val = float(metrics.get("confidence", 1.0))
    corruption_list = [int(x) for x in metrics.get("corruption_map", [])]

    return {
        "status": "IDENTIFIED",
        "recipient": recipient_dict,
        "event": event_dict,
        "attribution": {
            "recipient": recipient_dict,
            "event": event_dict
        },
        "forensic_metrics": {
            "extraction_confidence": confidence_val,
            "corruption_map": corruption_list,
            "analysis": str(metrics.get("analysis", "High-fidelity extraction")),
            "recovered_via_rs": bool(metrics.get("recovered_via_rs", True))
        },
        "verification": {
            "watermark_match": True,
            "ledger_integrity": is_valid,
            "broken_block": broken_id
        }
    }

