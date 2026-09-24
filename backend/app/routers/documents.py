from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
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

    return {"id": new_doc.id, "sha3_hash": doc_hash}

@router.get("")
@router.get("/")
async def list_documents(db: AsyncSession = Depends(get_db)):
    """Lists all uploaded documents."""
    result = await db.execute(select(Document))
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
    return {"status": "Document encrypted", "encrypted_path": encrypted_path}
