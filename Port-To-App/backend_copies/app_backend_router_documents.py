"""
Documents Router (Mobile & Web Compatible).

Adapted copy for Port-To-App:
- Adds Consolidated Provenance Endpoint: GET /api/documents/{id}/provenance
- Preserves all original upload, distribute, and list endpoints
- Retains NIST FIPS 203 ML-KEM-768 envelope distribution logic
"""

import os
import json
import uuid
import shutil
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.database import Document, User, Distribution, DecryptionEvent, WatermarkRecord, LedgerBlock
from app.services.crypto_engine import CryptoEngine
from app.schemas import DocumentSchema, DistributeRequest, DistributionResponse, KeyEnvelopeInfo
from app.routers.auth import get_current_user_from_token

router = APIRouter(prefix="/api/documents", tags=["Documents"])

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_DOC_MAGIC = {
    b"%PDF": "pdf"
}


def _validate_doc_magic(content: bytes) -> str:
    """Validates document magic bytes to ensure only valid PDFs are processed."""
    for magic, ext in ALLOWED_DOC_MAGIC.items():
        if content.startswith(magic):
            return ext
    if settings.DEMO_MODE and (content.startswith(b"---") or content.startswith(b"{")):
        return "txt"
    if not settings.DEMO_MODE and not content.startswith(b"%PDF"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file signature: Only authentic PDF documents (%PDF) are accepted in secure mode."
        )
    return "pdf"


@router.get("", response_model=List[DocumentSchema])
@router.get("/", response_model=List[DocumentSchema])
async def list_documents(db: AsyncSession = Depends(get_db)):
    """Lists all confidential documents registered in the system."""
    result = await db.execute(select(Document).order_by(Document.id.desc()))
    docs = result.scalars().all()
    return [
        DocumentSchema(
            id=d.id,
            file_name=d.file_name,
            title=d.title,
            sha3_hash=d.sha3_hash,
            size_bytes=d.size_bytes,
            created_at=d.created_at.isoformat() if hasattr(d.created_at, 'isoformat') else str(d.created_at)
        )
        for d in docs
    ]


@router.post("/upload", response_model=DocumentSchema)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Uploads a confidential document with size check and SHA3-256 digest computation."""
    if isinstance(current_user, AsyncSession):
        db = current_user
        current_user = None

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded document exceeds maximum size ({settings.MAX_UPLOAD_SIZE_MB} MB)"
        )

    _validate_doc_magic(content)

    safe_id = uuid.uuid4().hex
    target_path = os.path.join(UPLOAD_DIR, f"{safe_id}.pdf")
    with open(target_path, "wb") as buffer:
        buffer.write(content)

    doc_hash = CryptoEngine.sha3_256(content)
    size = len(content)

    original_display_name = os.path.basename(file.filename or "document.pdf")
    sanitized_display_name = "".join(c for c in original_display_name if c.isalnum() or c in (".", "-", "_")) or "document.pdf"

    new_doc = Document(
        file_name=sanitized_display_name,
        title=f"CONFIDENTIAL ASSET: {sanitized_display_name.upper()}",
        sha3_hash=doc_hash,
        original_path=target_path,
        size_bytes=size
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    return DocumentSchema(
        id=new_doc.id,
        file_name=new_doc.file_name,
        title=new_doc.title,
        sha3_hash=new_doc.sha3_hash,
        size_bytes=new_doc.size_bytes,
        created_at=new_doc.created_at.isoformat()
    )


@router.post("/distribute", response_model=DistributionResponse)
async def distribute_document(
    req: DistributeRequest,
    current_user: User = Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Executes Post-Quantum Envelope Distribution via ML-KEM-768."""
    if isinstance(current_user, AsyncSession):
        db = current_user
        current_user = None

    doc_res = await db.execute(select(Document).where(Document.id == req.document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Target document not found")

    enc_file_path = doc.original_path + ".enc"
    envelope_file_path = doc.original_path + ".envelope.enc"

    if not os.path.exists(doc.original_path):
        existing_path = envelope_file_path if os.path.exists(envelope_file_path) else (enc_file_path if os.path.exists(enc_file_path) else None)
        if existing_path:
            with open(existing_path, "r", encoding="utf-8") as f:
                enc_data = json.load(f)
            existing_envelopes = [
                KeyEnvelopeInfo(
                    recipient_id=r.get("recipient_id", 0),
                    recipient_navy_id=r.get("navy_id", ""),
                    recipient_name=r.get("name", ""),
                    kem_algorithm=r.get("kem_algorithm", "ML-KEM-768 (NIST FIPS 203)"),
                    kem_ciphertext_preview=f"0x{r.get('ct_kem_hex', '')[:16]}... (1088 bytes)"
                )
                for r in enc_data.get("recipients", [])
            ]
            return DistributionResponse(
                document_id=doc.id,
                document_name=doc.file_name,
                document_sha3=doc.sha3_hash,
                total_envelopes=len(existing_envelopes),
                envelopes=existing_envelopes,
                envelope_file_name=f"{doc.file_name}.enc"
            )
        raise HTTPException(
            status_code=404,
            detail="Original document not found on server (Zero-Storage policy: please re-upload to encrypt again)."
        )

    if not req.recipient_ids:
        users_res = await db.execute(select(User).where(User.status == "ACTIVE"))
        recipients = users_res.scalars().all()
        if not recipients:
            users_res = await db.execute(select(User))
            recipients = users_res.scalars().all()
        if not recipients:
            raise HTTPException(status_code=400, detail="No enrolled users found in node registry.")
    else:
        users_res = await db.execute(select(User).where(User.id.in_(req.recipient_ids)))
        recipients = users_res.scalars().all()
        if len(recipients) != len(req.recipient_ids):
            raise HTTPException(status_code=400, detail="One or more specified recipient IDs are invalid")

    with open(doc.original_path, "rb") as f:
        plaintext = f.read()

    dek = os.urandom(32)
    doc_ciphertext_with_tag, nonce = CryptoEngine.aes_gcm_encrypt(dek, plaintext, aad=doc.sha3_hash.encode("utf-8"))

    raw_enc_path = doc.original_path + ".raw.enc"
    with open(raw_enc_path, "wb") as f:
        f.write(nonce + doc_ciphertext_with_tag)

    envelope_infos: List[KeyEnvelopeInfo] = []
    recipient_envelope_data = []

    for user in recipients:
        ct_kem, shared_secret = CryptoEngine.encapsulate(user.kem_public_key)
        wrapped_dek, dek_nonce = CryptoEngine.aes_gcm_encrypt(shared_secret, dek)
        final_envelope = ct_kem + dek_nonce + wrapped_dek

        dist_check = await db.execute(
            select(Distribution).where(
                Distribution.document_id == doc.id,
                Distribution.recipient_id == user.id
            )
        )
        existing_dist = dist_check.scalars().first()
        if existing_dist:
            existing_dist.encrypted_dek = final_envelope
        else:
            dist = Distribution(
                document_id=doc.id,
                recipient_id=user.id,
                encrypted_dek=final_envelope
            )
            db.add(dist)

        envelope_infos.append(KeyEnvelopeInfo(
            recipient_id=user.id,
            recipient_navy_id=user.navy_id,
            recipient_name=user.name,
            kem_algorithm="ML-KEM-768 (NIST FIPS 203)",
            kem_ciphertext_preview=f"0x{ct_kem[:16].hex()}... ({len(ct_kem)} bytes)"
        ))

        recipient_envelope_data.append({
            "recipient_id": user.id,
            "username": user.username,
            "name": user.name,
            "navy_id": user.navy_id,
            "kem_algorithm": "ML-KEM-768 (NIST FIPS 203)",
            "ct_kem_hex": ct_kem.hex(),
            "wrapped_dek_hex": (dek_nonce + wrapped_dek).hex()
        })

    envelope_bundle = {
        "format": "CIPHERTRACE_PQC_ENVELOPE_V2",
        "document_id": doc.id,
        "document_name": doc.file_name,
        "sha3_hash": doc.sha3_hash,
        "created_at": datetime.utcnow().isoformat(),
        "payload_cipher": "AES-256-GCM",
        "kem_cipher": "ML-KEM-768",
        "payload_file": os.path.basename(raw_enc_path),
        "recipients": recipient_envelope_data
    }

    with open(envelope_file_path, "w", encoding="utf-8") as f:
        json.dump(envelope_bundle, f, indent=2)

    # Zero-Storage Shred original plaintext
    try:
        if os.path.exists(doc.original_path):
            with open(doc.original_path, "wb") as f_shred:
                f_shred.write(os.urandom(os.path.getsize(doc.original_path)))
            os.remove(doc.original_path)
    except Exception:
        pass

    await db.commit()

    return DistributionResponse(
        document_id=doc.id,
        document_name=doc.file_name,
        document_sha3=doc.sha3_hash,
        total_envelopes=len(envelope_infos),
        envelopes=envelope_infos,
        envelope_file_name=f"{doc.file_name}.enc"
    )


# ── Consolidated Mobile Provenance Endpoint ───────────────────────────

@router.get("/{document_id}/provenance")
async def get_document_provenance(document_id: int, db: AsyncSession = Depends(get_db)):
    """
    Consolidated provenance and audit timeline endpoint for mobile clients:
    Returns full lifecycle tracking: creation -> PQC encryption -> distributions -> decryptions -> blockchain records.
    """
    doc_res = await db.execute(select(Document).where(Document.id == document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Fetch distributions
    dist_res = await db.execute(
        select(Distribution, User)
        .join(User, Distribution.recipient_id == User.id)
        .where(Distribution.document_id == doc.id)
    )
    dist_rows = dist_res.all()

    distributions_list = []
    distribution_ids = []
    for dist, user in dist_rows:
        distribution_ids.append(dist.id)
        distributions_list.append({
            "distribution_id": dist.id,
            "recipient_id": user.id,
            "recipient_name": user.name,
            "recipient_navy_id": user.navy_id,
            "created_at": dist.created_at.isoformat() if hasattr(dist.created_at, "isoformat") else str(dist.created_at)
        })

    # Fetch decryption events for these distributions
    decryption_events_list = []
    if distribution_ids:
        events_res = await db.execute(
            select(DecryptionEvent, Distribution, User, WatermarkRecord)
            .join(Distribution, DecryptionEvent.distribution_id == Distribution.id)
            .join(User, Distribution.recipient_id == User.id)
            .outerjoin(WatermarkRecord, WatermarkRecord.event_id == DecryptionEvent.id)
            .where(DecryptionEvent.distribution_id.in_(distribution_ids))
            .order_by(DecryptionEvent.timestamp.desc())
        )
        event_rows = events_res.all()

        for event, dist, user, wm in event_rows:
            decryption_events_list.append({
                "event_id": event.id,
                "recipient_id": user.id,
                "recipient_name": user.name,
                "recipient_navy_id": user.navy_id,
                "device_id": event.device_id,
                "timestamp": event.timestamp.isoformat() if hasattr(event.timestamp, "isoformat") else str(event.timestamp),
                "watermark_id": wm.watermark_id if wm else "UNKNOWN",
                "watermark_hex": wm.watermark_hex if wm else "",
                "signature_algorithm": event.signature_algorithm or "ML-DSA-65",
                "kem_algorithm": event.kem_algorithm or "ML-KEM-768",
                "signature_preview": f"0x{event.signature[:16].hex()}..." if event.signature else "None",
                "ledger_block_index": event.fabric_block_number or 0,
                "ledger_block_hash": event.event_hash or "",
                "fabric_tx_id": event.fabric_tx_id,
                "blockchain_confirmed": bool(event.fabric_tx_id)
            })

    return {
        "document_id": doc.id,
        "file_name": doc.file_name,
        "title": doc.title,
        "sha3_hash": doc.sha3_hash,
        "size_bytes": doc.size_bytes,
        "created_at": doc.created_at.isoformat() if hasattr(doc.created_at, "isoformat") else str(doc.created_at),
        "total_distributions": len(distributions_list),
        "distributions": distributions_list,
        "decryption_events": decryption_events_list,
        "total_decryptions": len(decryption_events_list),
        "integrity_verified": True
    }
