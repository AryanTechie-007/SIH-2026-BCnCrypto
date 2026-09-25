import os
import shutil
import zipfile
import io
from typing import Tuple
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..schemas import VaultExportRequest, VaultImportRequest
from ..services.crypto_engine import CryptoEngine

router = APIRouter(prefix="/api/system", tags=["System Administration"])

# Absolute paths to critical system state
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ciphertrace_v2.db"))
UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))

async def derive_vault_key(passphrase: str) -> bytes:
    """Derives a 256-bit AES key from a passphrase using a fixed system salt."""
    # In a production system, we'd use a unique salt per vault.
    # For this tactical air-gap system, we use a consistent derivation for simplicity.
    salt = b"CIPHERTRACE_VAULT_SALT_2026"
    # Using SHA3-256 to derive a key from passphrase + salt
    return CryptoEngine.sha3_256(passphrase.encode("utf-8") + salt).encode("utf-8")[:32]

@router.get("/health", response_model=None)
async def get_system_health():
    """Returns cryptographic health telemetry for the air-gapped terminal."""
    from datetime import datetime
    return {
        "status": "OPERATIONAL",
        "system": "CIPHERTRACE 2.0 Air-Gapped Forensic Platform",
        "version": "2.0.0-DEFENSE",
        "timestamp": datetime.utcnow().isoformat(),
        "cryptographic_suite": {
            "kem": "ML-KEM-768 (NIST FIPS 203)",
            "signature": "ML-DSA-65 (NIST FIPS 204)",
            "symmetric": "AES-256-GCM (NIST SP 800-38D)",
            "hashing": "SHA3-256 (NIST FIPS 202)",
            "ecc": "Reed-Solomon RS(255, 127)"
        },
        "consensus_endorsers": [
            "NAVY-NODE-ALPHA (Flagship)",
            "AIR-FORCE-NODE-BETA",
            "COAST-GUARD-NODE-GAMMA"
        ],
        "air_gap_mode": True
    }

@router.post("/export", response_model=None)
async def export_system_vault(req: VaultExportRequest):
    """
    Bundles the SQLite DB and uploads directory into a password-encrypted archive.
    The resulting .ct-vault file is a NIST-standard AES-256-GCM encrypted blob.
    """
    try:
        # 1. Create a temporary zip archive of the state
        temp_zip_path = "temp_vault.zip"
        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add DB
            if os.path.exists(DB_PATH):
                zipf.write(DB_PATH, arcname="ciphertrace_v2.db")
            # Add Uploads
            if os.path.exists(UPLOADS_DIR):
                for root, _, files in os.walk(UPLOADS_DIR):
                    for file in files:
                        full_path = os.path.join(root, file)
                        arcname = os.path.relpath(full_path, os.path.join(UPLOADS_DIR, ".."))
                        zipf.write(full_path, arcname)

        # 2. Encrypt the archive
        with open(temp_zip_path, "rb") as f:
            plaintext = f.read()

        key = await derive_vault_key(req.passphrase)
        ciphertext, nonce = CryptoEngine.aes_gcm_encrypt(key, plaintext)

        # Final vault format: [NONCE(12B)][CIPHERTEXT(VAR)]
        vault_data = nonce + ciphertext
        vault_path = "system_state.ct-vault"
        with open(vault_path, "wb") as f:
            f.write(vault_data)

        # Cleanup temp zip
        os.remove(temp_zip_path)

        return FileResponse(
            vault_path,
            filename="ciphertrace_system_vault.ct-vault",
            media_type="application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vault export failed: {str(e)}")

@router.post("/import", response_model=None)
async def import_system_vault(
    passphrase: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Decrypts a .ct-vault archive and restores the system state.
    WARNING: This will overwrite the existing database and uploads folder.
    """
    try:
        # 1. Read and decrypt vault
        vault_bytes = await file.read()
        nonce = vault_bytes[:12]
        ciphertext = vault_bytes[12:]

        key = await derive_vault_key(passphrase)

        try:
            plaintext = CryptoEngine.aes_gcm_decrypt(key, nonce, ciphertext)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid passphrase or corrupt vault file")

        # 2. Extract the zip archive
        temp_zip_path = "temp_import.zip"
        with open(temp_zip_path, "wb") as f:
            f.write(plaintext)

        with zipfile.ZipFile(temp_zip_path, 'r') as zipf:
            zipf.extractall(os.path.join(os.path.dirname(__file__), "..", ".."))

        os.remove(temp_zip_path)

        return JSONResponse(
            content={"message": "System state restored successfully. Please restart the server to apply changes."},
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vault import failed: {str(e)}")
