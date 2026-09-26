import os
import json
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.database import get_db
from app.models.database import Document, User, Distribution, DecryptionEvent, WatermarkRecord, LedgerBlock
from app.services.crypto_engine import CryptoEngine
from app.services.watermark_engine import WatermarkEngine
from app.services.ledger_engine import LedgerEngine
from app.services.keystore import KeystoreManager, KeystoreAuthenticationError, KeystoreNotFoundError
from app.schemas import DecryptionRequest, DecryptionResponse
from app.routers.auth import get_current_user_from_token

router = APIRouter(prefix="/api/decryption", tags=["Decryption"])

RETURNS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "returns"))
os.makedirs(RETURNS_DIR, exist_ok=True)

watermark_engine = WatermarkEngine()
ledger_engine = LedgerEngine()

# Standard demo credentials for automated demo convenience
DEMO_PASSWORDS = [
    "CommanderVerma2026!",
    "LieutenantRao2026!",
    "CommanderJoshi2026!",
    "password123",
    "OfficerAuth2026!"
]


def _resolve_keystore_password(req_password: Optional[str], user: User) -> str:
    """Resolves password to unlock local encrypted recipient keystore."""
    if req_password:
        return req_password

    if settings.DEMO_MODE:
        # Try known demo passwords
        keystore_path = user.keystore_path or KeystoreManager.get_keystore_path(user.id, user.username)
        if os.path.exists(keystore_path):
            for pwd in DEMO_PASSWORDS:
                if KeystoreManager.verify_password(keystore_path, pwd):
                    return pwd

    raise HTTPException(
        status_code=401,
        detail=f"Keystore password required to unlock local ML-KEM-768 and ML-DSA-65 keys for recipient {user.name}."
    )


def _safe_remove(file_path: str):
    """Safely removes temporary files."""
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass


@router.post("/decrypt", response_model=DecryptionResponse)
async def decrypt_document(
    req: DecryptionRequest,
    current_user: User = Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Recipient-Side Post-Quantum Decryption & Forensic Watermarking Sequence:
    1. Recipient Authentication: Identity verified via authenticated session.
    2. Recipient Keystore Unlocking: Local encrypted keystore unlocked on recipient boundary.
       Raw private keys NEVER touch database or network.
    3. ML-KEM-768 Decapsulation: Shared secret unwrapped inside keystore boundary.
    4. AES-256-GCM Decryption: DEK unwrapped, ciphertext decrypted, auth tag verified.
    5. Session Watermark Synthesis: 127-byte authenticated frame + RS(255, 127) ECC embedded via 2D DCT.
    6. Local ML-DSA-65 Signing: Recipient's local private key signs viewing event hash.
    7. Consortium Blockchain Commit: Event committed to Hyperledger Fabric with multi-org endorsement.
    """
    if isinstance(current_user, AsyncSession):
        db = current_user
        current_user = None

    # Authorization: Ensure authenticated user matches recipient (or has ADMIN role)
    if current_user and current_user.role != "ADMIN" and current_user.id != req.recipient_id:
        raise HTTPException(
            status_code=403,
            detail=f"ACCESS DENIED: Cannot decrypt document on behalf of recipient ID {req.recipient_id}."
        )

    # Fetch recipient record
    user_res = await db.execute(select(User).where(User.id == req.recipient_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Recipient user identity record not found in system registry")

    if user.status != "ACTIVE":
        raise HTTPException(status_code=403, detail="Recipient account is deactivated")
    if user.key_status == "REVOKED":
        raise HTTPException(status_code=403, detail="Recipient cryptographic key has been revoked")

    # Verify document exists
    doc_res = await db.execute(select(Document).where(Document.id == req.document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Requested confidential document not found")

    # Access control: Verify recipient possesses a distribution envelope for this document
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
            detail=f"ACCESS DENIED: {user.name} ({user.navy_id}) was not designated as an authorized recipient for this document. No ML-KEM-768 key envelope exists."
        )

    # Resolve keystore
    keystore_path = user.keystore_path or KeystoreManager.get_keystore_path(user.id, user.username)
    if not os.path.exists(keystore_path):
        raise HTTPException(
            status_code=500,
            detail=f"Local keystore file not found at {keystore_path}. Please re-register or run migration."
        )

    password = _resolve_keystore_password(req.keystore_password, user)

    # Extract Envelope
    envelope = dist.encrypted_dek
    if len(envelope) < 1148:
        raise HTTPException(status_code=500, detail="Corrupted cryptographic key envelope in database")

    ct_kem = envelope[:1088]
    dek_nonce = envelope[1088:1100]
    wrapped_dek = envelope[1100:]

    # Decapsulate DEK within the Keystore Boundary
    try:
        shared_secret = KeystoreManager.decapsulate(keystore_path, password, ct_kem)
        dek = CryptoEngine.aes_gcm_decrypt(shared_secret, dek_nonce, wrapped_dek)
    except KeystoreAuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid keystore password: could not unlock private keys")
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Post-Quantum decapsulation failed: {str(e)}")

    # Decrypt Document Payload
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
        plaintext = CryptoEngine.aes_gcm_decrypt(
            dek,
            doc_nonce,
            doc_ciphertext_with_tag,
            aad=doc.sha3_hash.encode("utf-8")
        )
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"AES-256-GCM authentication tag verification failed: {str(e)}")

    # Generate Session Nonce and Canonical Event
    session_nonce = f"NONCE-{uuid.uuid4().hex[:16].upper()}"
    ts = datetime.utcnow()
    device_id = req.device_id or user.device_id

    canonical_msg = f"{doc.sha3_hash}|{user.navy_id}|{session_nonce}|{ts.isoformat()}|{device_id}".encode("utf-8")
    event_hash = CryptoEngine.sha3_256(canonical_msg)

    # Sign viewing event using Officer's ML-DSA-65 Private Key within Keystore Boundary
    try:
        signature = KeystoreManager.sign(keystore_path, password, canonical_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Local ML-DSA-65 signing failed: {str(e)}")

    new_event = DecryptionEvent(
        distribution_id=dist.id,
        session_nonce=session_nonce,
        timestamp=ts,
        device_id=device_id,
        signature=signature,
        signature_algorithm="ML-DSA-65",
        kem_algorithm="ML-KEM-768",
        event_hash=event_hash
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    # Derive 128-bit Watermark Payload & 20-hex char authoritative Watermark ID
    secret = CryptoEngine.derive_system_secret()
    payload = CryptoEngine.derive_watermark_payload(secret, doc.sha3_hash, user.id, session_nonce, new_event.id)
    watermark_hex = payload.hex().lower()
    watermark_id = watermark_hex[:20]  # 20 lowercase hex chars per Fabric schema

    # Build authenticated 127-byte forensic frame
    recipient_fp = user.dsa_key_id if user.dsa_key_id else CryptoEngine.sha3_256(user.dsa_public_key)[:32]
    watermark_frame = watermark_engine.build_watermark_frame(
        watermark_id=watermark_id,
        event_id=str(new_event.id),
        document_hash=doc.sha3_hash,
        recipient_key_id=recipient_fp,
        session_nonce=session_nonce,
        secret=secret
    )

    watermarked_filename = f"watermarked_evt_{new_event.id}_{doc.file_name}"
    watermarked_path = os.path.join(RETURNS_DIR, watermarked_filename)

    # Write decrypted plaintext temporarily for watermarking
    temp_plain_path = os.path.join(RETURNS_DIR, f"temp_dec_{uuid.uuid4().hex[:8]}_{doc.file_name}")
    try:
        with open(temp_plain_path, "wb") as f:
            f.write(plaintext)

        watermark_engine.embed_watermark(
            temp_plain_path,
            watermark_frame,
            watermarked_path
        )
    finally:
        _safe_remove(temp_plain_path)

    # Record watermark record
    wm_record = WatermarkRecord(
        event_id=new_event.id,
        watermark_id=watermark_id,
        watermark_payload=payload,
        watermark_hex=watermark_hex,
        protocol_version=2,
        reed_solomon_profile="RS(255,127)",
        watermarked_path=watermarked_path,
        created_at=ts
    )
    db.add(wm_record)
    await db.commit()

    # Commit Decryption Event to Distributed Ledger (Hyperledger Fabric)
    # Fail-closed in SECURE_MODE if Fabric is unavailable
    try:
        committed_block = await ledger_engine.commit_decryption_event(db, new_event.id)
    except Exception as e:
        # In SECURE_MODE, commit failure blocks the operation
        if settings.SECURE_MODE:
            raise HTTPException(
                status_code=503,
                detail=f"BLOCKCHAIN OFFLINE: Decryption commit failed to reach consensus. Operation blocked: {str(e)}"
            )
        raise

    return DecryptionResponse(
        event_id=new_event.id,
        document_id=doc.id,
        recipient_name=user.name,
        recipient_navy_id=user.navy_id,
        session_nonce=session_nonce,
        timestamp=ts.isoformat(),
        watermark_id=watermark_id,
        watermark_hex=watermark_hex,
        signature_algorithm="ML-DSA-65",
        kem_algorithm="ML-KEM-768",
        ml_dsa_signature_preview=f"ML-DSA-65-SIG[0x{signature[:16].hex()}...]",
        ledger_block_index=committed_block.id,
        ledger_block_hash=committed_block.block_hash,
        fabric_tx_id=committed_block.fabric_tx_id,
        download_url=f"/api/decryption/download/{new_event.id}"
    )


@router.get("/download/{event_id}")
async def download_watermarked_document(
    event_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Downloads the decrypted document with invisible 2D DCT watermark. Cleaned up immediately after delivery."""
    res = await db.execute(select(WatermarkRecord).where(WatermarkRecord.event_id == event_id))
    record = res.scalar_one_or_none()
    if not record or not os.path.exists(record.watermarked_path):
        raise HTTPException(status_code=404, detail="Watermarked document expired or not found")

    # Clean up decrypted watermarked PDF once delivered
    background_tasks.add_task(_safe_remove, record.watermarked_path)

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
    keystore_password: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Cross-Device Decryption Workflow:
    Accepts an uploaded portable .enc envelope file, verifies if the target recipient
    has an authorized ML-KEM-768 key envelope, unlocks recipient keystore, decapsulates the DEK,
    decrypts the payload, fuses an invisible 2D DCT watermark with RS(255, 127) ECC,
    signs with ML-DSA-65, and commits transaction to the distributed ledger.
    """
    if isinstance(keystore_password, AsyncSession):
        db = keystore_password
        keystore_password = None

    content = await file.read()
    text_content = content.decode("utf-8", errors="ignore").strip()

    try:
        enc_data = json.loads(text_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Corrupted or invalid .enc file format: {str(e)}")

    if enc_data.get("format") != "CIPHERTRACE_PQC_ENVELOPE":
        raise HTTPException(status_code=400, detail="Unsupported envelope container format. Expected CIPHERTRACE_PQC_ENVELOPE.")

    user_res = await db.execute(select(User).where(User.id == recipient_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Recipient user identity record not found in system registry")

    recipients_list = enc_data.get("recipients", [])
    matched = None
    for r in recipients_list:
        if r.get("recipient_id") == user.id or r.get("username") == user.username:
            matched = r
            break

    if not matched:
        raise HTTPException(
            status_code=403,
            detail=f"ACCESS DENIED: {user.name} ({user.navy_id}) was not designated as an authorized recipient in this encrypted .enc envelope."
        )

    keystore_path = user.keystore_path or KeystoreManager.get_keystore_path(user.id, user.username)
    if not os.path.exists(keystore_path):
        raise HTTPException(status_code=500, detail="Recipient local keystore not found")

    password = _resolve_keystore_password(keystore_password, user)

    try:
        ct_kem = bytes.fromhex(matched["ct_kem_hex"])
        dek_nonce = bytes.fromhex(matched["dek_nonce_hex"])
        wrapped_dek = bytes.fromhex(matched["wrapped_dek_hex"])
        aes_nonce = bytes.fromhex(enc_data["aes_nonce_hex"])
        ciphertext = bytes.fromhex(enc_data["ciphertext_hex"])
        file_name = enc_data.get("file_name", "classified_document.pdf")
        sha3_hash = enc_data.get("sha3_256", "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode cryptographic parameters: {str(e)}")

    # Decapsulate and decrypt inside keystore boundary
    try:
        shared_secret = KeystoreManager.decapsulate(keystore_path, password, ct_kem)
        dek = CryptoEngine.aes_gcm_decrypt(shared_secret, dek_nonce, wrapped_dek)
        plaintext = CryptoEngine.aes_gcm_decrypt(dek, aes_nonce, ciphertext, aad=sha3_hash.encode("utf-8"))
    except KeystoreAuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid keystore password")
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
        select(Distribution).where(
            Distribution.document_id == doc.id,
            Distribution.recipient_id == user.id
        ).order_by(Distribution.id.desc())
    )
    dist = dist_res.scalars().first()
    if not dist:
        dist = Distribution(
            document_id=doc.id,
            recipient_id=user.id,
            encrypted_dek=ct_kem + dek_nonce + wrapped_dek
        )
        db.add(dist)
        await db.commit()
        await db.refresh(dist)

    temp_plain_path = os.path.join(RETURNS_DIR, f"temp_dec_{uuid.uuid4().hex[:8]}_{file_name}")
    with open(temp_plain_path, "wb") as f:
        f.write(plaintext)

    session_nonce = f"NONCE-{uuid.uuid4().hex[:16].upper()}"
    ts = datetime.utcnow()
    eff_device = device_id or user.device_id

    canonical_msg = f"{sha3_hash}|{user.navy_id}|{session_nonce}|{ts.isoformat()}|{eff_device}".encode("utf-8")
    event_hash = CryptoEngine.sha3_256(canonical_msg)
    signature = KeystoreManager.sign(keystore_path, password, canonical_msg)

    new_event = DecryptionEvent(
        distribution_id=dist.id,
        session_nonce=session_nonce,
        timestamp=ts,
        device_id=eff_device,
        signature=signature,
        signature_algorithm="ML-DSA-65",
        kem_algorithm="ML-KEM-768",
        event_hash=event_hash
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    # Derive watermark & build frame
    secret = CryptoEngine.derive_system_secret()
    payload = CryptoEngine.derive_watermark_payload(secret, sha3_hash, user.id, session_nonce, new_event.id)
    watermark_hex = payload.hex().lower()
    watermark_id = watermark_hex[:20]

    recipient_fp = user.dsa_key_id if user.dsa_key_id else CryptoEngine.sha3_256(user.dsa_public_key)[:32]
    watermark_frame = watermark_engine.build_watermark_frame(
        watermark_id=watermark_id,
        event_id=str(new_event.id),
        document_hash=sha3_hash,
        recipient_key_id=recipient_fp,
        session_nonce=session_nonce,
        secret=secret
    )

    watermarked_filename = f"watermarked_evt_{new_event.id}_{file_name}"
    watermarked_path = os.path.join(RETURNS_DIR, watermarked_filename)

    try:
        watermark_engine.embed_watermark(temp_plain_path, watermark_frame, watermarked_path)
    finally:
        _safe_remove(temp_plain_path)

    wm_record = WatermarkRecord(
        event_id=new_event.id,
        watermark_id=watermark_id,
        watermark_payload=payload,
        watermark_hex=watermark_hex,
        protocol_version=2,
        reed_solomon_profile="RS(255,127)",
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
        signature_algorithm="ML-DSA-65",
        kem_algorithm="ML-KEM-768",
        ml_dsa_signature_preview=f"ML-DSA-65-SIG[0x{signature[:16].hex()}...]",
        ledger_block_index=committed_block.id,
        ledger_block_hash=committed_block.block_hash,
        fabric_tx_id=committed_block.fabric_tx_id,
        download_url=f"/api/decryption/download/{new_event.id}"
    )
