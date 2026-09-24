import hmac
import hashlib
from typing import Tuple
from ..services.crypto_service import CryptoService

class WatermarkService:
    """
    Handles the derivation of the session-bound cryptographic watermark payload.
    """

    @staticmethod
    def generate_payload(secret: bytes, doc_hash: str, recipient_id: int, session_nonce: str, event_id: int) -> bytes:
        """
        Generates a 128-bit (16 byte) payload using HMAC-SHA3-256.
        Formula: HMAC-SHA3-256(secret, doc_hash || recipient_id || session_nonce || event_id)
        """
        msg = f"{doc_hash}|{recipient_id}|{session_nonce}|{event_id}".encode()

        # Use hashlib.sha3_256 for the HMAC implementation
        # Since Python's hmac module takes a digestmod, we pass hashlib.sha3_256
        payload = hmac.new(secret, msg, hashlib.sha3_256).digest()

        # Truncate to 128 bits (16 bytes) as per plan for DCT embedding capacity
        return payload[:16]

    @staticmethod
    def derive_system_secret() -> bytes:
        """Derives the system secret used for watermarking (should be in config)."""
        # In production, this would be a secure key from environment variables
        return b"CIPHERTRACE_SYSTEM_SECRET_2026_PQC"
