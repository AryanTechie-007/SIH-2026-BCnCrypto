import os
import json
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import Document, User, Distribution, DecryptionEvent, WatermarkRecord, LedgerBlock
from ..services.crypto_engine import CryptoEngine
from ..services.watermark_engine import WatermarkEngine
from ..services.ledger_engine import LedgerEngine
from ..schemas import DecryptionRequest, DecryptionResponse

router = APIRouter(prefix="/api/decryption", tags=["Decryption"])

RETURNS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "returns"))
os.makedirs(RETURNS_DIR, exist_ok=True)

watermark_engine = WatermarkEngine()
ledger_engine = LedgerEngine()

@router.post("/decrypt", response_model=DecryptionResponse)
async def decrypt_document(req: DecryptionRequest, db: AsyncSession = Depends(get_db)):
    """
    Atomic Post-Quantum Decryption & Forensic Watermarking Sequence:
    1. Authorization Check: Ensures recipient possesses a valid ML-KEM-768 distribution envelope.
       STRICT: If unauthorized, returns HTTP 403 Forbidden with exact denial credentials.
    2. Decapsulation: Recovers ephemeral symmetric DEK using recipient's private lattice key.
    3. AES-256-GCM Decryption: Validates authentication tag and decrypts PDF payload.
    4. Session Synthesis: Generates cryptographically unique session nonce and event record.
    5. Invisible Watermarking: Derives session-bound HMAC-SHA3-256 payload and embeds via 2D DCT.
    6. Post-Quantum Signing: Recipient signs canonical viewing event hash with ML-DSA-65 private key.
    7. Ledger Commitment: Broadcasts and immutably commits event to distributed ledger.
    """
    # Verify user exists
    user_res = await db.execute(select(User).where(User.id == req.recipient_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Officer identity record not found in system registry")

    # Verify document exists
    doc_res = await db.execute(select(Document).where(Document.id == req.document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Requested classified document not found")

    # 1. STRICT ACCESS CONTROL CHECK: Query matching distribution record
    dist_res = await db.execute(
        select(Distribution).where(
            Distribution.document_id == req.document_id,
            Distribution.recipient_id == req.recipient_id
        ).order_by(Distribution.id.desc())
    )
    dist = dist_res.scalars().first()

    if not dist:
        raise HTTPException(
            status_code=403,
            detail=f"ACCESS DENIED: {user.name} ({user.navy_id}) was not designated as an authorized recipient during envelope distribution. No ML-KEM-768 key envelope exists for this officer."
        )

    # 2. Extract Envelope and Decapsulate DEK
    envelope = dist.encrypted_dek
    if len(envelope) < 1148:
        raise HTTPException(status_code=500, detail="Corrupted cryptographic key envelope in database")

    ct_kem = envelope[:1088]
    dek_nonce = envelope[1088:1100]
    wrapped_dek = envelope[1100:]

    try:
        shared_secret = CryptoEngine.decapsulate(user.kem_private_key, ct_kem)
        dek = CryptoEngine.aes_gcm_decrypt(shared_secret, dek_nonce, wrapped_dek)
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Post-Quantum decapsulation failed: {str(e)}")

    # 3. Decrypt Document
    raw_enc_path = doc.original_path + ".raw.enc"
    enc_path = doc.original_path + ".enc"
    env_path = doc.original_path + ".envelope.enc"

    file_data = None
    for p in [raw_enc_path, enc_path, env_path]:
        if os.path.exists(p):
            with open(p, "rb") as f:
                file_data = f.read()
            break

    if file_data is None:
        raise HTTPException(status_code=404, detail="Encrypted ciphertext payload missing from storage")

    if file_data.strip().startswith(b"{"):
        try:
            parsed = json.loads(file_data.decode("utf-8"))
            doc_nonce = bytes.fromhex(parsed["aes_nonce_hex"])
            doc_ciphertext_with_tag = bytes.fromhex(parsed["ciphertext_hex"])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse encrypted JSON container: {str(e)}")
    else:
        doc_nonce = file_data[:12]
        doc_ciphertext_with_tag = file_data[12:]

    try:
        plaintext = CryptoEngine.aes_gcm_decrypt(dek, doc_nonce, doc_ciphertext_with_tag, aad=doc.sha3_hash.encode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"AES-256-GCM authentication tag verification failed: {str(e)}")

    # 4. Generate Session Nonce and Canonical Event
    session_nonce = f"NONCE-{uuid.uuid4().hex[:16].upper()}"
    ts = datetime.utcnow()
    device_id = req.device_id or user.device_id

    canonical_msg = f"{doc.sha3_hash}|{user.navy_id}|{session_nonce}|{ts.isoformat()}|{device_id}".encode("utf-8")
    event_hash = CryptoEngine.sha3_256(canonical_msg)

    # 5. Sign Decryption Event using Officer's ML-DSA-65 Private Key
    signature = CryptoEngine.sign(user.dsa_private_key, canonical_msg)

    new_event = DecryptionEvent(
        distribution_id=dist.id,
        session_nonce=session_nonce,
        timestamp=ts,
        device_id=device_id,
        signature=signature,
        event_hash=event_hash
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    # 6. Synthesize and Embed Session Watermark into PDF
    secret = CryptoEngine.derive_system_secret()
    payload = CryptoEngine.derive_watermark_payload(secret, doc.sha3_hash, user.id, session_nonce, new_event.id)
    watermark_hex = payload.hex().upper()
    watermark_id = f"WM-{watermark_hex[:24]}"

    watermarked_filename = f"watermarked_evt_{new_event.id}_{doc.file_name}"
    watermarked_path = os.path.join(RETURNS_DIR, watermarked_filename)

    try:
        watermark_engine.embed_watermark(doc.original_path, payload, watermarked_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Watermark frequency embedding failed: {str(e)}")

    # Record watermark record
    wm_record = WatermarkRecord(
        event_id=new_event.id,
        watermark_payload=payload,
        watermark_hex=watermark_hex,
        watermarked_path=watermarked_path,
        created_at=ts
    )
    db.add(wm_record)
    await db.commit()

    # 7. Commit Decryption Event to Distributed Ledger
    committed_block = await ledger_engine.commit_decryption_event(db, new_event.id)

    return DecryptionResponse(
        event_id=new_event.id,
        document_id=doc.id,
        recipient_name=user.name,
        recipient_navy_id=user.navy_id,
        session_nonce=session_nonce,
        timestamp=ts.isoformat(),
        watermark_id=watermark_id,
        watermark_hex=watermark_hex,
        ml_dsa_signature_preview=f"ML-DSA-65-SIG[0x{signature[:16].hex()}...]",
        ledger_block_index=committed_block.id,
        ledger_block_hash=committed_block.block_hash,
        download_url=f"/api/decryption/download/{new_event.id}"
    )

@router.get("/download/{event_id}")
async def download_watermarked_document(event_id: int, db: AsyncSession = Depends(get_db)):
    """Downloads the decrypted document with invisible 2D DCT watermark."""
    res = await db.execute(select(WatermarkRecord).where(WatermarkRecord.event_id == event_id))
    record = res.scalar_one_or_none()
    if not record or not os.path.exists(record.watermarked_path):
        raise HTTPException(status_code=404, detail="Watermarked document not found")

    return FileResponse(
        record.watermarked_path,
        media_type="application/pdf",
        filename=os.path.basename(record.watermarked_path)
    )

@router.post("/decrypt-envelope", response_model=DecryptionResponse)
async def decrypt_uploaded_envelope(
    file: UploadFile = File(...),
    recipient_id: int = Form(...),
    device_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Cross-Device Decryption Workflow:
    Accepts an uploaded portable .enc envelope file, verifies if the target recipient
    has an authorized ML-KEM-768 key envelope, decapsulates the DEK, decrypts the payload,
    fuses an invisible 2D DCT watermark with the recipient's identity, signs with ML-DSA-65,
    commits the transaction to the ledger, and returns the downloadable watermarked PDF.
    """
    content = await file.read()
    try:
        enc_data = json.loads(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Corrupted or invalid .enc file format: {str(e)}")

    if enc_data.get("format") != "CIPHERTRACE_PQC_ENVELOPE":
        raise HTTPException(status_code=400, detail="Unsupported envelope container format. Expected CIPHERTRACE_PQC_ENVELOPE.")

    # Verify recipient exists
    user_res = await db.execute(select(User).where(User.id == recipient_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Recipient operator identity record not found in system registry")

    # Match recipient inside envelope
    recipients_list = enc_data.get("recipients", [])
    matched = None
    for r in recipients_list:
        if r.get("recipient_id") == user.id or r.get("username") == user.username:
            matched = r
            break

    if not matched:
        raise HTTPException(
            status_code=403,
            detail=f"ACCESS DENIED: Operator {user.name} ({user.navy_id}) was not designated as an authorized recipient in this encrypted .enc envelope."
        )

    # Decapsulate DEK
    try:
        ct_kem = bytes.fromhex(matched["ct_kem_hex"])
        dek_nonce = bytes.fromhex(matched["dek_nonce_hex"])
        wrapped_dek = bytes.fromhex(matched["wrapped_dek_hex"])
        aes_nonce = bytes.fromhex(enc_data["aes_nonce_hex"])
        ciphertext = bytes.fromhex(enc_data["ciphertext_hex"])
        file_name = enc_data.get("file_name", "classified_document.pdf")
        sha3_hash = enc_data.get("sha3_256", "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode cryptographic parameters from envelope: {str(e)}")

    try:
        shared_secret = CryptoEngine.decapsulate(user.kem_private_key, ct_kem)
        dek = CryptoEngine.aes_gcm_decrypt(shared_secret, dek_nonce, wrapped_dek)
        plaintext = CryptoEngine.aes_gcm_decrypt(dek, aes_nonce, ciphertext, aad=sha3_hash.encode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Cryptographic authentication verification failed: {str(e)}")

    # Ensure document record in DB
    doc_res = await db.execute(select(Document).where(Document.sha3_hash == sha3_hash))
    doc = doc_res.scalars().first()
    if not doc:
        source_doc_path = os.path.join(RETURNS_DIR, f"source_{sha3_hash[:12]}_{file_name}")
        with open(source_doc_path, "wb") as f:
            f.write(plaintext)
        doc = Document(
            file_name=file_name,
            title=f"CROSS-DEVICE PAYLOAD: {file_name}",
            sha3_hash=sha3_hash,
            original_path=source_doc_path,
            size_bytes=len(plaintext)
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

    # Ensure distribution record
    dist_res = await db.execute(
        select(Distribution).where(Distribution.document_id == doc.id, Distribution.recipient_id == user.id)
    )
    dist = dist_res.scalar_one_or_none()
    if not dist:
        dist = Distribution(
            document_id=doc.id,
            recipient_id=user.id,
            encrypted_dek=ct_kem + dek_nonce + wrapped_dek
        )
        db.add(dist)
        await db.commit()
        await db.refresh(dist)

    # Save temporary source PDF for watermark engine
    temp_plain_path = os.path.join(RETURNS_DIR, f"temp_dec_{uuid.uuid4().hex[:8]}_{file_name}")
    with open(temp_plain_path, "wb") as f:
        f.write(plaintext)

    session_nonce = f"NONCE-{uuid.uuid4().hex[:16].upper()}"
    ts = datetime.utcnow()
    eff_device = device_id or user.device_id

    canonical_msg = f"{sha3_hash}|{user.navy_id}|{session_nonce}|{ts.isoformat()}|{eff_device}".encode("utf-8")
    event_hash = CryptoEngine.sha3_256(canonical_msg)
    signature = CryptoEngine.sign(user.dsa_private_key, canonical_msg)

    new_event = DecryptionEvent(
        distribution_id=dist.id,
        session_nonce=session_nonce,
        timestamp=ts,
        device_id=eff_device,
        signature=signature,
        event_hash=event_hash
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    # Derive and embed watermark
    secret = CryptoEngine.derive_system_secret()
    payload = CryptoEngine.derive_watermark_payload(secret, sha3_hash, user.id, session_nonce, new_event.id)
    watermark_hex = payload.hex().upper()
    watermark_id = f"WM-{watermark_hex[:24]}"

    watermarked_filename = f"watermarked_evt_{new_event.id}_{file_name}"
    watermarked_path = os.path.join(RETURNS_DIR, watermarked_filename)

    try:
        watermark_engine.embed_watermark(temp_plain_path, payload, watermarked_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Watermark frequency embedding failed: {str(e)}")
    finally:
        if os.path.exists(temp_plain_path):
            try:
                os.remove(temp_plain_path)
            except Exception:
                pass

    wm_record = WatermarkRecord(
        event_id=new_event.id,
        watermark_payload=payload,
        watermark_hex=watermark_hex,
        watermarked_path=watermarked_path,
        created_at=ts
    )
    db.add(wm_record)
    await db.commit()

    committed_block = await ledger_engine.commit_decryption_event(db, new_event.id)

    return DecryptionResponse(
        event_id=new_event.id,
        document_id=doc.id,
        recipient_name=user.name,
        recipient_navy_id=user.navy_id,
        session_nonce=session_nonce,
        timestamp=ts.isoformat(),
        watermark_id=watermark_id,
        watermark_hex=watermark_hex,
        ml_dsa_signature_preview=f"ML-DSA-65-SIG[0x{signature[:16].hex()}...]",
        ledger_block_index=committed_block.id,
        ledger_block_hash=committed_block.block_hash,
        download_url=f"/api/decryption/download/{new_event.id}"
    )
