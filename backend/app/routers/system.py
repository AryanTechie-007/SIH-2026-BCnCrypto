from datetime import datetime
from fastapi import APIRouter

from app.config import settings
from ..services import ledger_client
from ..services.crypto_engine import CryptoEngine
from ..services.watermark_engine import WatermarkEngine

router = APIRouter(prefix="/api/system", tags=["System Administration"])


@router.get("/health", response_model=None)
async def get_system_health():
    """Returns accurate cryptographic health telemetry for the air-gapped terminal."""
    backend_info = CryptoEngine.get_backend_info()
    ledger_status = ledger_client.get_ledger_status()

    return {
        "status": "OPERATIONAL",
        "system": "CIPHERTRACE Confidential Document Security & Provenance",
        "version": "1.0.0-ENTERPRISE",
        "server_boot_id": settings.BOOT_ID,
        "mode": settings.get_mode_label(),
        "timestamp": datetime.utcnow().isoformat(),
        "cryptographic_suite": {
            "kem": f"{backend_info['kem_algorithm']} ({backend_info['fips_203_standard']})",
            "signature": f"{backend_info['signature_algorithm']} ({backend_info['fips_204_standard']})",
            "backend": backend_info["backend"],
            "symmetric": "AES-256-GCM (NIST SP 800-38D)",
            "hashing": "SHA3-256 (NIST FIPS 202)",
            "ecc": WatermarkEngine.ECC_STRATEGY
        },
        "ledger": ledger_status,
        "keystore_storage": "Encrypted Recipient Keystores (Argon2id + AES-256-GCM)",
        "air_gap_mode": True
    }
