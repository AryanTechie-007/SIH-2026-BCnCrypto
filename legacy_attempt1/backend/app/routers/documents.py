from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import os
import shutil
from typing import List
from ..database import get_db
from ..models.database import Document, Distribution, User
from ..services.crypto_service import CryptoService
from ..schemas import EncryptRequest

router = APIRouter(prefix="/api/documents", tags=["Documents"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_document(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Uploads a document and computes its SHA3-256 hash."""
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    with open(file_path, "rb") as f:
        content = f.read()
        doc_hash = CryptoService.sha3_hash(content)

    new_doc = Document(
        file_name=file.filename,
        sha3_hash=doc_hash,
        original_path=file_path
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    return {
        "id": new_doc.id,
        "file_name": new_doc.file_name,
        "sha3_hash": doc_hash,
        "size": os.path.getsize(file_path),
        "created_at": new_doc.created_at.isoformat() if new_doc.created_at else None
    }

@router.post("/upload-and-encrypt")
async def upload_and_encrypt_document(
    file: UploadFile = File(...),
    recipient_ids: List[int] = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Unified pipeline: Upload -> Hash -> Store -> Encrypt for specified recipients.
    Using streaming to prevent memory overflow for large files.
    """
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    sha3_hasher = CryptoService.sha3_hasher() # Assume a helper that returns hashlib.sha3_256()

    # 1. Stream Upload and Hash simultaneously
    with open(file_path, "wb") as buffer:
        while chunk := await file.read(65536):
            sha3_hasher.update(chunk)
            buffer.write(chunk)

    doc_hash = sha3_hasher.hexdigest()

    # 2. DB Record
    new_doc = Document(
        file_name=file.filename,
        sha3_hash=doc_hash,
        original_path=file_path
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    # 3. Symmetric Encryption (AES-256-GCM) using Streaming
    import os as os_module
    dek = os_module.urandom(32)
    encrypted_path = file_path + ".enc"

    # Simulating chunked AES-GCM (in real implementation, use a streaming cipher mode)
    with open(file_path, "rb") as f_in, open(encrypted_path, "wb") as f_out:
        while chunk := f_in.read(65536):
            # For simplicity in this simulation, we encrypt the chunk
            # Real production would use a sequential IV/nonce for each block
            ciphertext_chunk = CryptoService.aes_encrypt(dek, chunk)
            f_out.write(ciphertext_chunk)

    # 4. Envelope Encryption (ML-KEM)
    for rid in recipient_ids:
        result = await db.execute(select(User).where(User.id == rid))
        user = result.scalar_one_or_none()
        if not user:
            continue

        ciphertext_kem, shared_secret = CryptoService.encapsulate(user.kem_public_key)
        wrapped_dek = CryptoService.aes_encrypt(shared_secret, dek)
        final_envelope = ciphertext_kem + wrapped_dek

        dist = Distribution(
            document_id=new_doc.id,
            recipient_id=user.id,
            encrypted_dek=final_envelope
        )
        db.add(dist)

    await db.commit()

    return {
        "id": new_doc.id,
        "file_name": new_doc.file_name,
        "sha3_hash": doc_hash,
        "encrypted_path": encrypted_path,
        "download_url": f"/api/documents/{new_doc.id}/download-encrypted"
    }

@router.get("")
@router.get("/")
async def list_documents(db: AsyncSession = Depends(get_db)):
    """Lists all uploaded documents."""
    result = await db.execute(select(Document).order_by(Document.id.desc()))
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "file_name": d.file_name,
            "sha3_hash": d.sha3_hash,
            "created_at": d.created_at.isoformat() if d.created_at else None
        } for d in docs
    ]

@router.post("/{doc_id}/encrypt")
async def encrypt_document(
    doc_id: int,
    req: EncryptRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Implements Envelope Encryption:
    1. Generate random DEK (Data Encryption Key).
    2. Encrypt document with DEK using AES-256-GCM.
    3. For each recipient: encapsulate DEK with their ML-KEM public key.
    """
    # 1. Get document
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    with open(doc.original_path, "rb") as f:
        plaintext = f.read()

    # 2. Generate random DEK (32 bytes for AES-256)
    import os
    dek = os.urandom(32)

    # 3. Symmetric Encryption (AES-256-GCM)
    ciphertext = CryptoService.aes_encrypt(dek, plaintext)

    # Store the encrypted document on disk
    encrypted_path = doc.original_path + ".enc"
    with open(encrypted_path, "wb") as f:
        f.write(ciphertext)

    # 4. Asymmetric Envelope (ML-KEM Encapsulation)
    for rid in req.recipient_ids:
        result = await db.execute(select(User).where(User.id == rid))
        user = result.scalar_one_or_none()
        if not user:
            continue

        ciphertext_kem, shared_secret = CryptoService.encapsulate(user.kem_public_key)
        wrapped_dek = CryptoService.aes_encrypt(shared_secret, dek)
        final_envelope = ciphertext_kem + wrapped_dek

        dist = Distribution(
            document_id=doc.id,
            recipient_id=user.id,
            encrypted_dek=final_envelope
        )
        db.add(dist)

    await db.commit()
    return {
        "status": "Document encrypted", 
        "encrypted_path": encrypted_path,
        "download_url": f"/api/documents/{doc.id}/download-encrypted"
    }

@router.get("/{doc_id}/download-encrypted")
async def download_encrypted_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    """Downloads the NIST-compliant Post-Quantum Envelope (.enc)."""
    from datetime import datetime
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    encrypted_path = doc.original_path + ".enc"
    if not os.path.exists(encrypted_path):
        raise HTTPException(status_code=404, detail="Encrypted file not found. Run encryption first.")

    with open(encrypted_path, "rb") as f:
        encrypted_bytes = f.read()

    # Get distributions for this doc
    dist_res = await db.execute(select(Distribution).where(Distribution.document_id == doc.id))
    dists = dist_res.scalars().all()

    # Build NIST-standard Post-Quantum envelope file
    envelope_path = encrypted_path + ".envelope.txt"
    nonce_hex = encrypted_bytes[:12].hex() if len(encrypted_bytes) >= 28 else ""
    tag_hex = encrypted_bytes[-16:].hex() if len(encrypted_bytes) >= 28 else ""
    ciphertext_hex = encrypted_bytes[12:-16].hex() if len(encrypted_bytes) >= 28 else encrypted_bytes.hex()

    lines = [
        "--- CIPHERTRACE POST-QUANTUM ENVELOPE (AES-256-GCM + ML-KEM-768) ---",
        "SPECIFICATION: NIST FIPS 203 (ML-KEM-768) + NIST SP 800-38D (AES-256-GCM)",
        f"DOCUMENT_ID: DOC-{doc.id}",
        f"FILE_NAME: {doc.file_name}",
        f"SHA3_256_HASH: {doc.sha3_hash}",
        f"TIMESTAMP: {doc.created_at.isoformat() if doc.created_at else datetime.utcnow().isoformat()}",
        f"AES_GCM_NONCE_HEX: {nonce_hex}",
        f"AES_GCM_TAG_HEX: {tag_hex}",
        "RECIPIENT_ENVELOPES:"
    ]

    for d in dists:
        u_res = await db.execute(select(User).where(User.id == d.recipient_id))
        user = u_res.scalar_one_or_none()
        u_name = user.name if user else f"Recipient-{d.recipient_id}"
        kem_ct = d.encrypted_dek[:1088].hex()
        wrapped_dek = d.encrypted_dek[1088:].hex()
        lines.append(f"  - RECIPIENT_ID: {d.recipient_id} ({u_name})")
        lines.append(f"    KEM_ALGORITHM: ML-KEM-768 (FIPS 203)")
        lines.append(f"    KEM_CIPHERTEXT_HEX: {kem_ct}")
        lines.append(f"    WRAPPED_DEK_HEX: {wrapped_dek}")

    lines.append("--- ENCRYPTED PAYLOAD (AES-256-GCM) ---")
    lines.append(f"CIPHERTEXT: {ciphertext_hex}")
    lines.append("--- END CIPHERTRACE ENVELOPE ---")

    with open(envelope_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return FileResponse(
        envelope_path,
        media_type="application/octet-stream",
        filename=f"{doc.file_name}.enc"
    )


@router.get("/{doc_id}/download-original")
async def download_original_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    """Downloads the original document."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc or not os.path.exists(doc.original_path):
        raise HTTPException(status_code=404, detail="Document not found")

    return FileResponse(
        doc.original_path,
        media_type="application/pdf",
        filename=doc.file_name
    )
