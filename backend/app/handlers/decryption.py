import os
import json
import shutil
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app import rpc
from app.config import settings
from app.errors import ApiError
from app.models.database import Document, User, Distribution, DecryptionEvent, WatermarkRecord
from app.services.crypto_engine import CryptoEngine
from app.services.watermark_engine import WatermarkEngine
from app.services.ledger_engine import LedgerEngine, LedgerCommitError
from app.services.keystore import KeystoreManager, KeystoreAuthenticationError
from app.schemas import DecryptionResponse

RETURNS_DIR = settings.RETURNS_DIR
os.makedirs(RETURNS_DIR, exist_ok=True)

watermark_engine = WatermarkEngine()
ledger_engine = LedgerEngine()


def _keystore_path_for(user: User) -> str:
    """Resolves the recipient keystore file, prioritizing canonical naming and tolerating foreign paths."""
    canonical = KeystoreManager.get_keystore_path(user.id, user.username)
    if os.path.exists(canonical):
        return canonical
    alt = KeystoreManager.get_keystore_path(user.id)
    if os.path.exists(alt):
        return alt
    stored = user.keystore_path or ""
    if stored and os.path.exists(stored):
        return stored
    name = stored.replace("\\", "/").rsplit("/", 1)[-1] if stored else os.path.basename(canonical)
    local_target = os.path.join(settings.KEYSTORE_DIR, name)
    if os.path.exists(local_target):
        return local_target
    return canonical


def _safe_remove(file_path: str):
    """Safely removes temporary files."""
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass


@rpc.method("decryption.save_copy")
async def save_watermarked_document(db: AsyncSession, event_id: int, dest: str) -> dict:
    """Writes the watermarked copy to `dest`, chosen in a save dialog, then deletes the app's own copy."""
    res = await db.execute(select(WatermarkRecord).where(WatermarkRecord.event_id == event_id))
    record = res.scalar_one_or_none()
    if not record or not os.path.exists(record.watermarked_path):
        raise ApiError(404, "Watermarked document expired or not found")

    shutil.copyfile(record.watermarked_path, dest)
    _safe_remove(record.watermarked_path)
    return {"saved_to": dest}


@rpc.method("decryption.decrypt_envelope")
async def decrypt_uploaded_envelope(
    db: AsyncSession,
    current_user: User,
    session_passphrase: str,
    path: str,
    recipient_id: int,
    device_id: Optional[str] = None
) -> DecryptionResponse:
    """
    Cross-Device Decryption Workflow:
    Reads a portable .enc envelope file from `path`, verifies if the target recipient
    has an authorized ML-KEM-768 key envelope, unlocks recipient keystore with the session's
    passphrase, decapsulates the DEK, decrypts the payload, fuses an invisible 2D DCT watermark,
    signs with ML-DSA-65, and commits transaction to the distributed ledger.
    """
    # Only the signed-in user may decrypt, and only as themselves: the ledger record is
    # signed with their keys and submitted with their Fabric identity.
    if current_user.id != recipient_id:
        raise ApiError(403, f"ACCESS DENIED: Cannot decrypt document on behalf of recipient ID {recipient_id}.")

    try:
        with open(path, "rb") as f:
            content = f.read()
    except OSError as e:
        raise ApiError(400, f"Could not read {os.path.basename(path)}: {e.strerror or e}")
    text_content = content.decode("utf-8", errors="ignore").strip()

    try:
        enc_data = json.loads(text_content)
    except Exception as e:
        raise ApiError(400, f"Corrupted or invalid .enc file format: {str(e)}")

    if enc_data.get("format") != "CIPHERTRACE_PQC_ENVELOPE":
        raise ApiError(400, "Unsupported envelope container format. Expected CIPHERTRACE_PQC_ENVELOPE.")

    user_res = await db.execute(select(User).where(User.id == recipient_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise ApiError(404, "Recipient user identity record not found in system registry")

    recipients_list = enc_data.get("recipients", [])
    matched = None
    for r in recipients_list:
        if r.get("recipient_id") == user.id or r.get("username") == user.username:
            matched = r
            break

    if not matched:
        raise ApiError(403, f"ACCESS DENIED: {user.name} ({user.navy_id}) was not designated as an authorized recipient in this encrypted .enc envelope.")

    keystore_path = _keystore_path_for(user)
    if not os.path.exists(keystore_path):
        raise ApiError(500, "Recipient local keystore not found")

    password = session_passphrase

    try:
        ct_kem = bytes.fromhex(matched["ct_kem_hex"])
        dek_nonce = bytes.fromhex(matched["dek_nonce_hex"])
        wrapped_dek = bytes.fromhex(matched["wrapped_dek_hex"])
        aes_nonce = bytes.fromhex(enc_data["aes_nonce_hex"])
        ciphertext = bytes.fromhex(enc_data["ciphertext_hex"])
        file_name = enc_data.get("file_name", "classified_document.pdf")
        sha3_hash = enc_data.get("sha3_256", "")
    except Exception as e:
        raise ApiError(400, f"Failed to decode cryptographic parameters: {str(e)}")

    # Decapsulate and decrypt inside keystore boundary
    try:
        shared_secret = KeystoreManager.decapsulate(keystore_path, password, ct_kem)
        dek = CryptoEngine.aes_gcm_decrypt(shared_secret, dek_nonce, wrapped_dek)
        plaintext = CryptoEngine.aes_gcm_decrypt(dek, aes_nonce, ciphertext, aad=sha3_hash.encode("utf-8"))
    except KeystoreAuthenticationError:
        raise ApiError(401, "Your session's passphrase no longer unlocks your keystore. Sign in again.")
    except Exception as e:
        raise ApiError(403, f"Cryptographic authentication verification failed: {str(e)}")

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
        protocol_version=WatermarkEngine.PROTOCOL_VERSION,
        reed_solomon_profile=WatermarkEngine.ECC_STRATEGY,
        watermarked_path=watermarked_path,
        created_at=ts
    )
    db.add(wm_record)
    await db.commit()

    try:
        committed_block = await ledger_engine.commit_decryption_event(
            db, new_event.id,
            sign=lambda message: KeystoreManager.sign(keystore_path, password, message)
        )
    except LedgerCommitError as e:
        raise ApiError(503, f"BLOCKCHAIN COMMIT FAILED: document withheld. {str(e)}")

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
        fabric_tx_id=committed_block.fabric_tx_id
    )
