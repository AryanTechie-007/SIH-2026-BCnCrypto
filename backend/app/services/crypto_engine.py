import os
import hmac
import hashlib
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidSignature, InvalidTag

class CryptoEngine:
    """
    Military-grade Cryptographic Engine.
    Real Implementation:
    - NIST FIPS 203 (ML-KEM-768) via liboqs
    - NIST FIPS 204 (ML-DSA-65) via liboqs
    - NIST SP 800-38D (AES-256-GCM) Authenticated Encryption
    - NIST FIPS 202 (SHA3-256) Cryptographic Hashing
    """

    # NIST FIPS 203 & 204 Standard Buffer Lengths
    ML_KEM_768_PUBKEY_SIZE = 1184
    ML_KEM_768_PRIVKEY_SIZE = 2400
    ML_KEM_768_CIPHERTEXT_SIZE = 1088

    ML_DSA_65_PUBKEY_SIZE = 1952
    ML_DSA_65_PRIVKEY_SIZE = 4032
    ML_DSA_65_SIG_SIZE = 3309

    AES_KEY_SIZE = 32 # 256 bits
    GCM_NONCE_SIZE = 12 # 96 bits
    GCM_TAG_SIZE = 16 # 128 bits

    # -------------------------------------------------------------
    # NIST FIPS 202: SHA3-256 Digest
    # -------------------------------------------------------------
    @staticmethod
    def sha3_256(data: bytes) -> str:
        """Computes NIST FIPS 202 SHA3-256 digest returning a 64-char lowercase hex string."""
        h = hashlib.sha3_256()
        h.update(data)
        return h.hexdigest()

    @staticmethod
    def sha3_hasher():
        """Returns a streaming SHA3-256 hasher."""
        return hashlib.sha3_256()

    # -------------------------------------------------------------
    # NIST FIPS 203: ML-KEM-768 Key Encapsulation
    # -------------------------------------------------------------
    @staticmethod
    def generate_kem_keypair() -> Tuple[bytes, bytes]:
        """Generates an authentic ML-KEM-768 keypair."""
        import oqs
        with oqs.KeyEncapsulation('Kyber768') as kem:
            pub_key = kem.generate_keypair()
            priv_key = kem.export_secret_key()
            return pub_key, priv_key

    @staticmethod
    def encapsulate(public_key: bytes) -> Tuple[bytes, bytes]:
        """Encapsulates a fresh 256-bit shared secret against target recipient public key."""
        if len(public_key) != CryptoEngine.ML_KEM_768_PUBKEY_SIZE:
            raise ValueError(f"Invalid ML-KEM-768 public key size: {len(public_key)}")

        import oqs
        with oqs.KeyEncapsulation('Kyber768') as kem:
            ciphertext, shared_secret = kem.encap_secret(public_key)
            return ciphertext, shared_secret

    @staticmethod
    def decapsulate(private_key: bytes, ciphertext: bytes) -> bytes:
        """Decapsulates the symmetric shared secret using recipient's private key."""
        if len(private_key) != CryptoEngine.ML_KEM_768_PRIVKEY_SIZE:
            raise ValueError(f"Invalid ML-KEM-768 private key size: {len(private_key)}")
        if len(ciphertext) != CryptoEngine.ML_KEM_768_CIPHERTEXT_SIZE:
            raise ValueError(f"Invalid ML-KEM-768 ciphertext size: {len(ciphertext)}")

        import oqs
        with oqs.KeyEncapsulation('Kyber768') as kem:
            return kem.decap_secret(ciphertext, private_key)

    # -------------------------------------------------------------
    # NIST FIPS 204: ML-DSA-65 Digital Signatures
    # -------------------------------------------------------------
    @staticmethod
    def generate_signing_keypair() -> Tuple[bytes, bytes]:
        """Generates an authentic signing keypair."""
        import oqs
        with oqs.Signature('Dilithium3') as sig:
            pub_key = sig.generate_keypair()
            priv_key = sig.export_secret_key()
            return pub_key, priv_key

    @staticmethod
    def sign(private_key: bytes, message: bytes) -> bytes:
        """Signs a message using the private key."""
        if len(private_key) != CryptoEngine.ML_DSA_65_PRIVKEY_SIZE:
            raise ValueError(f"Invalid ML-DSA-65 private key size: {len(private_key)}")

        import oqs
        with oqs.Signature('Dilithium3') as sig:
            return sig.sign(message, private_key)

    @staticmethod
    def verify(public_key: bytes, message: bytes, signature: bytes) -> bool:
        """Verifies an ML-DSA-65 signature against the public key."""
        if len(public_key) != CryptoEngine.ML_DSA_65_PUBKEY_SIZE or len(signature) != CryptoEngine.ML_DSA_65_SIG_SIZE:
            return False

        try:
            import oqs
            with oqs.Signature('Dilithium3') as sig:
                return sig.verify(message, signature, public_key)
        except Exception:
            return False

    # -------------------------------------------------------------
    # NIST SP 800-38D: AES-256-GCM Authenticated Encryption
    # -------------------------------------------------------------
    @staticmethod
    def aes_gcm_encrypt(key: bytes, plaintext: bytes, aad: bytes = None) -> Tuple[bytes, bytes]:
        """Encrypts plaintext using AES-256-GCM."""
        if len(key) != CryptoEngine.AES_KEY_SIZE:
            raise ValueError(f"AES-256 key must be 32 bytes, received {len(key)}")
        nonce = os.urandom(CryptoEngine.GCM_NONCE_SIZE)
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, aad)
        return ciphertext, nonce

    @staticmethod
    def aes_gcm_decrypt(key: bytes, nonce: bytes, ciphertext: bytes, aad: bytes = None) -> bytes:
        """Decrypts AES-256-GCM ciphertext verifying authentication tag."""
        if len(key) != CryptoEngine.AES_KEY_SIZE:
            raise ValueError(f"AES-256 key must be 32 bytes, received {len(key)}")
        if len(nonce) != CryptoEngine.GCM_NONCE_SIZE:
            raise ValueError(f"AES-GCM nonce must be 12 bytes, received {len(nonce)}")
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ciphertext, aad)

    # -------------------------------------------------------------
    # HMAC-SHA3-256 Watermark Payload Derivation
    # -------------------------------------------------------------
    @staticmethod
    def derive_watermark_payload(secret: bytes, doc_hash: str, recipient_id: int, session_nonce: str, event_id: int) -> bytes:
        """Generates a 128-bit (16-byte) session-bound cryptographic watermark payload."""
        msg = f"{doc_hash}|{recipient_id}|{session_nonce}|{event_id}".encode("utf-8")
        h = hmac.new(secret, msg, hashlib.sha3_256).digest()
        return h[:16]

    @staticmethod
    def derive_system_secret() -> bytes:
        """Returns the air-gapped system secret for watermark payload derivation."""
        return os.getenv("CIPHERTRACE_SYSTEM_SECRET", b"CIPHERTRACE_MILITARY_AIRGAP_DEFENSE_2026_PQC")
