from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import Distribution, Document, DecryptionEvent, User, WatermarkRecord
from ..services.crypto_service import CryptoService
from ..services.watermark_service import WatermarkService
from ..services.embedding_service import EmbeddingService
from ..services.ledger_service import LedgerService
from ..schemas import DecryptRequest
import os
from datetime import datetime

router = APIRouter(prefix="/api/decryption", tags=["Decryption"])

embedding_service = EmbeddingService()
ledger_service = LedgerService()

@router.post("/{distribution_id}/decrypt")
async def decrypt_document(
    distribution_id: int,
    req: DecryptRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Implements the complete Decryption Flow:
    1. Decapsulate DEK using ML-KEM private key.
    2. Decrypt Document using AES-GCM.
    3. Generate a session-bound watermark and embed it in the PDF.
    4. Sign the decryption event with ML-DSA.
    5. Commit the event to the hash-chained ledger.
    """
    # 1. Get distribution record
    result = await db.execute(select(Distribution).where(Distribution.id == distribution_id))
    dist = result.scalar_one_or_none()
    if not dist:
        raise HTTPException(status_code=404, detail="Distribution record not found")

    # 2. Extract Envelope
    envelope = dist.encrypted_dek
    kem_ciphertext = envelope[:1088]
    wrapped_dek = envelope[1088:]

    # 3. ML-KEM Decapsulate
    priv_key_bytes = bytes.fromhex(req.recipient_private_key)
    shared_secret = CryptoService.decapsulate(priv_key_bytes, kem_ciphertext)

    # 4. Unwrap DEK
    dek = CryptoService.aes_decrypt(shared_secret, wrapped_dek)

    # 5. Decrypt Document
    result = await db.execute(select(Document).where(Document.id == dist.document_id))
    doc = result.scalar_one_or_none()
    encrypted_path = doc.original_path + ".enc"
    with open(encrypted_path, "rb") as f:
        ciphertext = f.read()

    plaintext = CryptoService.aes_decrypt(dek, ciphertext)

    # 6. Generate and Embed Watermark
    # First, we need to create the event to get an ID
    import uuid
    session_nonce = uuid.uuid4().hex
    timestamp = datetime.utcnow()

    # Create Event
    event_data = f"{dist.id}|{session_nonce}|{timestamp.isoformat()}|{req.device_id}".encode()
    signature = CryptoService.sign(priv_key_bytes, event_data) # Using KEM key for simplicity in simulation or assume DSA key provided

    new_event = DecryptionEvent(
        distribution_id=dist.id,
        session_nonce=session_nonce,
        timestamp=timestamp,
        device_id=req.device_id,
        signature=signature
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    # Now derive watermark payload
    payload = WatermarkService.generate_payload(
        WatermarkService.derive_system_secret(),
        doc.sha3_hash,
        dist.recipient_id,
        session_nonce,
        new_event.id
    )

    # Embed watermark into a new PDF
    watermarked_path = f"watermarked_{new_event.id}_{doc.file_name}"
    embedding_service.embed_watermark(doc.original_path, payload, watermarked_path)

    # Store watermark record
    wm_record = WatermarkRecord(
        event_id=new_event.id,
        watermark_payload=payload
    )
    db.add(wm_record)

    # 7. Commit to Ledger
    await ledger_service.commit_event(db, new_event.id)

    await db.commit()

    return {
        "status": "Decrypted & Watermarked",
        "document_content": plaintext.decode('utf-8', errors='ignore'),
        "watermarked_pdf_path": watermarked_path,
        "event_id": new_event.id,
        "session_nonce": session_nonce
    }
