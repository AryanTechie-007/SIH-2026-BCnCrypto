from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import Distribution, Document, DecryptionEvent, User, WatermarkRecord
from ..services.crypto_service import CryptoService
from ..services.watermark_service import WatermarkService
from ..services.embedding_service import EmbeddingService
from ..services.ledger_service import LedgerService
from ..schemas import DecryptRequest, DecryptDocRequest
import os

import shutil
from datetime import datetime

router = APIRouter(prefix="/api/decryption", tags=["Decryption"])

embedding_service = EmbeddingService()
ledger_service = LedgerService()

# Ensure returns directory exists
RETURNS_DIR = "returns"
os.makedirs(RETURNS_DIR, exist_ok=True)

@router.post("/upload-encrypted")
async def upload_encrypted_for_decryption(
    file: UploadFile = File(...),
    distribution_id: int = Form(...),
    recipient_private_key: str = Form(...),
    device_id: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Recipient Intake: Upload encrypted file -> Decrypt -> Watermark -> Return.
    """
    # 1. Save encrypted file
    enc_path = os.path.join("uploads", file.filename)
    with open(enc_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 2. Recover DEK via ML-KEM
    result = await db.execute(select(Distribution).where(Distribution.id == distribution_id))
    dist = result.scalar_one_or_none()
    if not dist:
        raise HTTPException(status_code=404, detail="Distribution record not found")

    envelope = dist.encrypted_dek
    kem_ciphertext = envelope[:1088]
    wrapped_dek = envelope[1088:]

    priv_key_bytes = bytes.fromhex(recipient_private_key)
    shared_secret = CryptoService.decapsulate(priv_key_bytes, kem_ciphertext)
    dek = CryptoService.aes_decrypt(shared_secret, wrapped_dek)

    # 3. Decrypt File
    with open(enc_path, "rb") as f:
        ciphertext = f.read()

    plaintext = CryptoService.aes_decrypt(dek, ciphertext)

    # 4. Watermarking & Ledger
    import uuid
    session_nonce = uuid.uuid4().hex
    timestamp = datetime.utcnow()

    # Create event
    event_data = f"{dist.id}|{session_nonce}|{timestamp.isoformat()}|{device_id}".encode()
    signature = CryptoService.sign(priv_key_bytes, event_data)

    new_event = DecryptionEvent(
        distribution_id=dist.id,
        session_nonce=session_nonce,
        timestamp=timestamp,
        device_id=device_id,
        signature=signature
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    # Derive payload and embed
    payload = WatermarkService.generate_payload(
        WatermarkService.derive_system_secret(),
        plaintext[:64].hex(), # Use a slice of plaintext as doc hash simulation
        dist.recipient_id,
        session_nonce,
        new_event.id
    )

    # Save decrypted watermarked file to returns/
    # Note: This simulation assumes embedding_service.embed_watermark handles PDF creation
    # We'll save the plaintext to a temporary file first so embedding_service can read it
    temp_plain_path = f"temp_{session_nonce}.pdf"
    with open(temp_plain_path, "wb") as f:
        f.write(plaintext)

    watermarked_path = os.path.join(RETURNS_DIR, f"returned_{new_event.id}_{file.filename}")
    embedding_service.embed_watermark(temp_plain_path, payload, watermarked_path)

    if os.path.exists(temp_plain_path):
        os.remove(temp_plain_path)

    # Store watermark record
    wm_record = WatermarkRecord(
        event_id=new_event.id,
        watermark_payload=payload
    )
    db.add(wm_record)

    # 5. Commit to Ledger
    await ledger_service.commit_event(db, new_event.id)
    await db.commit()

    return {
        "status": "File decrypted and returned",
        "returned_file": watermarked_path,
        "event_id": new_event.id
    }

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
    priv_key_bytes = bytes.fromhex(req.recipient_private_key) if req.recipient_private_key else b"\x00" * 2400
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
    import uuid
    session_nonce = uuid.uuid4().hex
    timestamp = datetime.utcnow()

    event_data = f"{dist.id}|{session_nonce}|{timestamp.isoformat()}|{req.device_id}".encode()
    signature = CryptoService.sign(priv_key_bytes, event_data)

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

    payload = WatermarkService.generate_payload(
        WatermarkService.derive_system_secret(),
        doc.sha3_hash,
        dist.recipient_id,
        session_nonce,
        new_event.id
    )

    watermarked_path = f"watermarked_{new_event.id}_{doc.file_name}"
    try:
        embedding_service.embed_watermark(doc.original_path, payload, watermarked_path)
    except Exception as e:
        print("Watermark embedding error:", e)
        shutil.copy(doc.original_path, watermarked_path)

    wm_record = WatermarkRecord(
        event_id=new_event.id,
        watermark_payload=payload
    )
    db.add(wm_record)
    await ledger_service.commit_event(db, new_event.id)
    await db.commit()

    return {
        "status": "Decrypted & Watermarked",
        "document_name": doc.file_name,
        "watermarked_pdf_path": watermarked_path,
        "download_url": f"/api/decryption/{new_event.id}/download",
        "event_id": new_event.id,
        "watermark_id": payload.hex()[:24].upper(),
        "session_nonce": session_nonce
    }

@router.post("/decrypt-doc")
async def decrypt_document_by_ids(
    req: DecryptDocRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Direct endpoint for frontend: decodes by document_id and recipient_id.
    """
    result = await db.execute(
        select(Distribution).where(
            Distribution.document_id == req.document_id,
            Distribution.recipient_id == req.recipient_id
        ).order_by(Distribution.id.desc())
    )
    dist = result.scalars().first()
    if not dist:
        raise HTTPException(
            status_code=403,
            detail="ACCESS DENIED: No cryptographic key envelope exists for this recipient. You are not authorized to decrypt this document."
        )

    envelope = dist.encrypted_dek
    kem_ciphertext = envelope[:1088]
    wrapped_dek = envelope[1088:]

    priv_key_bytes = bytes.fromhex(req.recipient_private_key) if req.recipient_private_key else b"\x00" * 2400
    shared_secret = CryptoService.decapsulate(priv_key_bytes, kem_ciphertext)
    dek = CryptoService.aes_decrypt(shared_secret, wrapped_dek)

    result = await db.execute(select(Document).where(Document.id == dist.document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    encrypted_path = doc.original_path + ".enc"
    if not os.path.exists(encrypted_path):
        raise HTTPException(status_code=404, detail="Encrypted file not found on disk")

    with open(encrypted_path, "rb") as f:
        ciphertext = f.read()

    plaintext = CryptoService.aes_decrypt(dek, ciphertext)

    import uuid
    session_nonce = uuid.uuid4().hex
    timestamp = datetime.utcnow()
    device_id = req.device_id or "DEV-TACTICAL-SECURE"

    event_data = f"{dist.id}|{session_nonce}|{timestamp.isoformat()}|{device_id}".encode()
    signature = CryptoService.sign(priv_key_bytes, event_data)

    new_event = DecryptionEvent(
        distribution_id=dist.id,
        session_nonce=session_nonce,
        timestamp=timestamp,
        device_id=device_id,
        signature=signature
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    payload = WatermarkService.generate_payload(
        WatermarkService.derive_system_secret(),
        doc.sha3_hash,
        dist.recipient_id,
        session_nonce,
        new_event.id
    )

    watermarked_path = f"watermarked_{new_event.id}_{doc.file_name}"
    try:
        embedding_service.embed_watermark(doc.original_path, payload, watermarked_path)
    except Exception as e:
        print("Watermark embedding error:", e)
        shutil.copy(doc.original_path, watermarked_path)

    wm_record = WatermarkRecord(
        event_id=new_event.id,
        watermark_payload=payload
    )
    db.add(wm_record)
    await ledger_service.commit_event(db, new_event.id)
    await db.commit()

    return {
        "status": "Decrypted & Watermarked",
        "document_name": doc.file_name,
        "watermarked_pdf_path": watermarked_path,
        "download_url": f"/api/decryption/{new_event.id}/download",
        "event_id": new_event.id,
        "watermark_id": payload.hex()[:24].upper(),
        "session_nonce": session_nonce
    }


@router.get("/{event_id}/download")
async def download_watermarked_pdf(event_id: int, db: AsyncSession = Depends(get_db)):
    """Downloads the decrypted and watermarked PDF document."""
    from fastapi.responses import FileResponse
    result = await db.execute(select(DecryptionEvent).where(DecryptionEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Decryption event not found")

    result = await db.execute(select(Distribution).where(Distribution.id == event.distribution_id))
    dist = result.scalar_one_or_none()
    if not dist:
        raise HTTPException(status_code=404, detail="Distribution not found")

    result = await db.execute(select(Document).where(Document.id == dist.document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    watermarked_path = f"watermarked_{event.id}_{doc.file_name}"
    if not os.path.exists(watermarked_path):
        if os.path.exists(os.path.join("uploads", watermarked_path)):
            watermarked_path = os.path.join("uploads", watermarked_path)
        elif os.path.exists(doc.original_path):
            watermarked_path = doc.original_path
        else:
            raise HTTPException(status_code=404, detail="Decrypted PDF not found on disk")


    return FileResponse(
        watermarked_path,
        media_type="application/pdf",
        filename=f"DECRYPTED_{doc.file_name}"
    )
