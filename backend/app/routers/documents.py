import os
import json
import shutil
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..database import get_db
from ..models.database import Document, User, Distribution
from ..services.crypto_engine import CryptoEngine
from ..schemas import DocumentSchema, DistributeRequest, DistributionResponse, KeyEnvelopeInfo

router = APIRouter(prefix="/api/documents", tags=["Documents"])

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
async def upload_document(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Uploads a confidential document, computes SHA3-256 digest, and stores it in secure storage."""
    target_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    with open(target_path, "rb") as f:
        content = f.read()

    doc_hash = CryptoEngine.sha3_256(content)
    size = len(content)

    new_doc = Document(
        file_name=file.filename,
        title=f"CONFIDENTIAL ASSET: {file.filename.upper()}",
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
async def distribute_document(req: DistributeRequest, db: AsyncSession = Depends(get_db)):
    """
    Executes Post-Quantum Envelope Distribution:
    1. Generates ephemeral 256-bit Document Encryption Key (DEK).
    2. Encrypts document payload once with AES-256-GCM.
    3. For EACH specified recipient:
       - Encapsulates DEK using ML-KEM-768 lattice cryptography.
       - Stores isolated Distribution record in database.
    4. Generates standardized NIST FIPS 203 Post-Quantum Envelope (.enc).
    """
    doc_res = await db.execute(select(Document).where(Document.id == req.document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Target document not found")

    enc_file_path = doc.original_path + ".enc"
    envelope_file_path = doc.original_path + ".envelope.enc"

    # If the unencrypted document was already encrypted and shredded under Zero-Storage:
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
        raise HTTPException(status_code=404, detail="Original document not found on server (Zero-Storage policy: please re-upload to encrypt again).")

    # Load recipients (if none specified, automatically encrypt for all enrolled organization identities)
    if not req.recipient_ids:
        users_res = await db.execute(select(User).where(User.status == "ACTIVE"))
        recipients = users_res.scalars().all()
        if not recipients:
            users_res = await db.execute(select(User))
            recipients = users_res.scalars().all()
        if not recipients:
            raise HTTPException(status_code=400, detail="No enrolled users found in node registry to encapsulate keys.")
    else:
        users_res = await db.execute(select(User).where(User.id.in_(req.recipient_ids)))
        recipients = users_res.scalars().all()
        if len(recipients) != len(req.recipient_ids):
            raise HTTPException(status_code=400, detail="One or more specified recipient IDs are invalid")

    # 1. Read document content and generate 256-bit DEK
    with open(doc.original_path, "rb") as f:
        plaintext = f.read()

    dek = os.urandom(32) # 256-bit symmetric DEK
    doc_ciphertext_with_tag, nonce = CryptoEngine.aes_gcm_encrypt(dek, plaintext, aad=doc.sha3_hash.encode("utf-8"))

    # Save raw encrypted payload
    raw_enc_path = doc.original_path + ".raw.enc"
    with open(raw_enc_path, "wb") as f:
        f.write(nonce + doc_ciphertext_with_tag)

    # 2. Encapsulate DEK per recipient
    envelope_infos: List[KeyEnvelopeInfo] = []
    recipient_envelope_data = []

    for user in recipients:
        ct_kem, shared_secret = CryptoEngine.encapsulate(user.kem_public_key)
        # Wrap DEK under shared secret
        wrapped_dek, dek_nonce = CryptoEngine.aes_gcm_encrypt(shared_secret, dek)
        final_envelope = ct_kem + dek_nonce + wrapped_dek # 1088 + 12 + 48 = 1148 bytes

        # Record distribution in database
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
            "dek_nonce_hex": dek_nonce.hex(),
            "wrapped_dek_hex": wrapped_dek.hex()
        })

    await db.commit()

    # Create portable self-contained .enc package (cross-device shareable)
    enc_package = {
        "format": "CIPHERTRACE_PQC_ENVELOPE",
        "version": "2.0.0",
        "document_id": doc.id,
        "file_name": doc.file_name,
        "sha3_256": doc.sha3_hash,
        "size_bytes": len(plaintext),
        "timestamp": datetime.utcnow().isoformat(),
        "aes_nonce_hex": nonce.hex(),
        "ciphertext_hex": doc_ciphertext_with_tag.hex(),
        "recipients": recipient_envelope_data
    }

    envelope_file_path = doc.original_path + ".envelope.enc"
    enc_file_path = doc.original_path + ".enc"
    package_json = json.dumps(enc_package, indent=2)

    with open(envelope_file_path, "w", encoding="utf-8") as f:
        f.write(package_json)

    with open(enc_file_path, "w", encoding="utf-8") as f:
        f.write(package_json)

    # ZERO-STORAGE SECURITY POLICY:
    # Shred unencrypted source document from the server disk immediately.
    # The server only holds the encrypted .enc distribution artifact and SHA3 anchor.
    if os.path.exists(doc.original_path):
        try:
            os.remove(doc.original_path)
        except Exception:
            pass

    return DistributionResponse(
        document_id=doc.id,
        document_name=doc.file_name,
        document_sha3=doc.sha3_hash,
        total_envelopes=len(envelope_infos),
        envelopes=envelope_infos,
        envelope_file_name=f"{doc.file_name}.enc"
    )

@router.get("/{document_id}/download-envelope")
async def download_envelope(document_id: int, db: AsyncSession = Depends(get_db)):
    """Downloads the portable NIST FIPS 203 encrypted envelope (.enc)."""
    doc_res = await db.execute(select(Document).where(Document.id == document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    envelope_file_path = doc.original_path + ".envelope.enc"
    enc_file_path = doc.original_path + ".enc"
    target_path = envelope_file_path if os.path.exists(envelope_file_path) else (enc_file_path if os.path.exists(enc_file_path) else None)
    if not target_path:
        raise HTTPException(status_code=404, detail="Envelope file not yet generated. Distribute document first.")

    return FileResponse(
        target_path,
        media_type="application/json",
        filename=f"{doc.file_name}.enc"
    )
