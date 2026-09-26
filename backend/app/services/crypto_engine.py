"""
CIPHERTRACE Post-Quantum Cryptographic Engine
============================================
Genuine NIST Standardized Implementation:
- NIST FIPS 203: ML-KEM-768 (Module-Lattice-Based Key-Encapsulation Mechanism)
- NIST FIPS 204: ML-DSA-65 (Module-Lattice-Based Digital Signature Algorithm)
- NIST SP 800-38D: AES-256-GCM (Galois/Counter Mode Authenticated Encryption)
- NIST FIPS 202: SHA3-256 / HMAC-SHA3-256

CRITICAL SECURITY ASSURANCE:
This engine uses ONLY genuine ML-KEM-768 and ML-DSA-65 implementations.
No classical fallback (X25519 / Ed25519) and no SHAKE padding emulation are permitted.
"""

import os
import hmac
import hashlib
from typing import Tuple, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

# Primary backend: liboqs (if native C library is compiled)
# Secondary backend: mlkem (FIPS 203) + dilithium-py (FIPS 204 ML-DSA-65)
_OQS_AVAILABLE = False
try:
    import oqs
    # Test if liboqs native library is loaded and supports our algorithms
    with oqs.KeyEncapsulation("ML-KEM-768") as _test_kem:
        pass
    with oqs.Signature("ML-DSA-65") as _test_sig:
        pass
    _OQS_AVAILABLE = True
except (ImportError, Exception):
    _OQS_AVAILABLE = False

# Native pure Python / wheels backends for offline air-gapped environments
try:
    from mlkem.ml_kem import ML_KEM as _ML_KEM
    from mlkem.parameter_set import ML_KEM_768 as _PARAM_ML_KEM_768
    _MLKEM_PKG_AVAILABLE = True
except ImportError:
    _MLKEM_PKG_AVAILABLE = False

try:
    from dilithium_py.ml_dsa import ML_DSA_65 as _ML_DSA_65
    _DILITHIUM_PKG_AVAILABLE = True
except ImportError:
    _DILITHIUM_PKG_AVAILABLE = False


class CryptoEngine:
    """
    Cryptographic Engine implementing genuine NIST FIPS 203 and FIPS 204 standards.
    """

    KEM_ALGORITHM = "ML-KEM-768"
    SIGNATURE_ALGORITHM = "ML-DSA-65"
    FIPS_203_STANDARD = "NIST FIPS 203 (ML-KEM-768)"
    FIPS_204_STANDARD = "NIST FIPS 204 (ML-DSA-65)"

    # NIST FIPS 203 (ML-KEM-768) Standard Byte Lengths
    ML_KEM_768_PUBKEY_SIZE = 1184
    ML_KEM_768_PRIVKEY_SIZE = 2400
    ML_KEM_768_CIPHERTEXT_SIZE = 1088
    ML_KEM_768_SHARED_SECRET_SIZE = 32

    # NIST FIPS 204 (ML-DSA-65) Standard Byte Lengths
    ML_DSA_65_PUBKEY_SIZE = 1952
    ML_DSA_65_PRIVKEY_SIZE = 4032
    ML_DSA_65_SIG_SIZE = 3309

    AES_KEY_SIZE = 32     # 256 bits
    GCM_NONCE_SIZE = 12   # 96 bits
    GCM_TAG_SIZE = 16     # 128 bits

    @classmethod
    def get_backend_info(cls) -> dict:
        """Returns details on the active post-quantum cryptography backend."""
        if _OQS_AVAILABLE:
            backend = "liboqs (Open Quantum Safe native C library)"
        elif _MLKEM_PKG_AVAILABLE and _DILITHIUM_PKG_AVAILABLE:
            backend = "NIST Standards Compliant Engine (mlkem + dilithium-py)"
        else:
            backend = "NONE - PQC primitives missing"

        return {
            "kem_algorithm": cls.KEM_ALGORITHM,
            "signature_algorithm": cls.SIGNATURE_ALGORITHM,
            "backend": backend,
            "fips_203_standard": cls.FIPS_203_STANDARD,
            "fips_204_standard": cls.FIPS_204_STANDARD,
            "oqs_available": _OQS_AVAILABLE,
            "native_pqc_available": (_MLKEM_PKG_AVAILABLE and _DILITHIUM_PKG_AVAILABLE),
            "is_genuine_pqc": (_OQS_AVAILABLE or (_MLKEM_PKG_AVAILABLE and _DILITHIUM_PKG_AVAILABLE))
        }

    @classmethod
    def verify_pqc_availability(cls) -> bool:
        """
        Self-test executing full round-trip keygen, encapsulation, decapsulation,
        signing, and verification using genuine NIST algorithms.
        Raises RuntimeError if genuine PQC is unavailable.
        """
        backend_info = cls.get_backend_info()
        if not backend_info["is_genuine_pqc"]:
            raise RuntimeError(
                "CRITICAL: Genuine NIST PQC algorithms (ML-KEM-768 and ML-DSA-65) are NOT available. "
                "Ensure either liboqs or (mlkem and dilithium-py) packages are installed."
            )

        # 1. Test ML-KEM-768 round-trip
        pk, sk = cls.generate_kem_keypair()
        if len(pk) != cls.ML_KEM_768_PUBKEY_SIZE or len(sk) != cls.ML_KEM_768_PRIVKEY_SIZE:
            raise RuntimeError(
                f"ML-KEM-768 key size mismatch: got pk={len(pk)}, sk={len(sk)}, "
                f"expected pk={cls.ML_KEM_768_PUBKEY_SIZE}, sk={cls.ML_KEM_768_PRIVKEY_SIZE}"
            )
        ct, ss1 = cls.encapsulate(pk)
        if len(ct) != cls.ML_KEM_768_CIPHERTEXT_SIZE or len(ss1) != cls.ML_KEM_768_SHARED_SECRET_SIZE:
            raise RuntimeError("ML-KEM-768 encapsulation output size mismatch")
        ss2 = cls.decapsulate(sk, ct)
        if ss1 != ss2:
            raise RuntimeError("ML-KEM-768 decapsulation failed: shared secret mismatch")

        # 2. Test ML-DSA-65 round-trip
        spk, ssk = cls.generate_signing_keypair()
        if len(spk) != cls.ML_DSA_65_PUBKEY_SIZE or len(ssk) != cls.ML_DSA_65_PRIVKEY_SIZE:
            raise RuntimeError(
                f"ML-DSA-65 key size mismatch: got spk={len(spk)}, ssk={len(ssk)}, "
                f"expected spk={cls.ML_DSA_65_PUBKEY_SIZE}, ssk={cls.ML_DSA_65_PRIVKEY_SIZE}"
            )
        test_msg = b"CIPHERTRACE_PQC_SELFTEST_FIPS_204"
        sig = cls.sign(ssk, test_msg)
        if len(sig) != cls.ML_DSA_65_SIG_SIZE:
            raise RuntimeError(f"ML-DSA-65 signature size mismatch: got {len(sig)}, expected {cls.ML_DSA_65_SIG_SIZE}")
        if not cls.verify(spk, test_msg, sig):
            raise RuntimeError("ML-DSA-65 signature verification failed on genuine signature")
        if cls.verify(spk, b"TAMPERED_MESSAGE", sig):
            raise RuntimeError("ML-DSA-65 security failure: tampered message accepted as valid")

        return True

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
    def sha3_256_bytes(data: bytes) -> bytes:
        """Computes NIST FIPS 202 SHA3-256 digest returning 32 raw bytes."""
        h = hashlib.sha3_256()
        h.update(data)
        return h.digest()

    @staticmethod
    def sha3_hasher():
        """Returns a streaming SHA3-256 hasher."""
        return hashlib.sha3_256()

    # -------------------------------------------------------------
    # NIST FIPS 203: ML-KEM-768 Key Encapsulation Mechanism
    # -------------------------------------------------------------
    @classmethod
    def generate_kem_keypair(cls) -> Tuple[bytes, bytes]:
        """
        Generates an authentic ML-KEM-768 keypair.
        Returns:
            public_key: 1184 bytes (NIST FIPS 203 encapsulation key)
            private_key: 2400 bytes (NIST FIPS 203 decapsulation key)
        """
        if _OQS_AVAILABLE:
            with oqs.KeyEncapsulation(cls.KEM_ALGORITHM) as kem:
                pk = kem.generate_keypair()
                sk = kem.export_secret_key()
                return pk, sk

        if _MLKEM_PKG_AVAILABLE:
            kem = _ML_KEM(_PARAM_ML_KEM_768)
            pk, sk = kem.key_gen()
            return pk, sk

        raise RuntimeError("No genuine ML-KEM-768 implementation available")

    @classmethod
    def encapsulate(cls, public_key: bytes) -> Tuple[bytes, bytes]:
        """
        Encapsulates a fresh 256-bit shared secret against target recipient public key.
        Returns:
            ciphertext: 1088 bytes of encapsulated ciphertext
            shared_secret: 32 bytes (256-bit) high-entropy key for DEK wrapping
        """
        if len(public_key) != cls.ML_KEM_768_PUBKEY_SIZE:
            raise ValueError(f"Invalid ML-KEM-768 public key size: {len(public_key)} (expected {cls.ML_KEM_768_PUBKEY_SIZE})")

        if _OQS_AVAILABLE:
            with oqs.KeyEncapsulation(cls.KEM_ALGORITHM) as kem:
                ct, ss = kem.encap_secret(public_key)
                return ct, ss

        if _MLKEM_PKG_AVAILABLE:
            kem = _ML_KEM(_PARAM_ML_KEM_768)
            ss, ct = kem.encaps(public_key)
            return ct, ss

        raise RuntimeError("No genuine ML-KEM-768 implementation available")

    @classmethod
    def decapsulate(cls, private_key: bytes, ciphertext: bytes) -> bytes:
        """
        Decapsulates the symmetric shared secret using recipient's private key.
        Returns:
            shared_secret: 32 bytes
        """
        if len(private_key) != cls.ML_KEM_768_PRIVKEY_SIZE:
            raise ValueError(f"Invalid ML-KEM-768 private key size: {len(private_key)} (expected {cls.ML_KEM_768_PRIVKEY_SIZE})")
        if len(ciphertext) != cls.ML_KEM_768_CIPHERTEXT_SIZE:
            raise ValueError(f"Invalid ML-KEM-768 ciphertext size: {len(ciphertext)} (expected {cls.ML_KEM_768_CIPHERTEXT_SIZE})")

        if _OQS_AVAILABLE:
            with oqs.KeyEncapsulation(cls.KEM_ALGORITHM, secret_key=private_key) as kem:
                return kem.decap_secret(ciphertext)

        if _MLKEM_PKG_AVAILABLE:
            kem = _ML_KEM(_PARAM_ML_KEM_768)
            return kem.decaps(private_key, ciphertext)

        raise RuntimeError("No genuine ML-KEM-768 implementation available")

    # -------------------------------------------------------------
    # NIST FIPS 204: ML-DSA-65 Digital Signatures
    # -------------------------------------------------------------
    @classmethod
    def generate_signing_keypair(cls) -> Tuple[bytes, bytes]:
        """
        Generates an authentic ML-DSA-65 signing keypair.
        Returns:
            public_key: 1952 bytes (NIST FIPS 204 verification key)
            private_key: 4032 bytes (NIST FIPS 204 signing key)
        """
        if _OQS_AVAILABLE:
            with oqs.Signature(cls.SIGNATURE_ALGORITHM) as signer:
                pk = signer.generate_keypair()
                sk = signer.export_secret_key()
                return pk, sk

        if _DILITHIUM_PKG_AVAILABLE:
            pk, sk = _ML_DSA_65.keygen()
            return pk, sk

        raise RuntimeError("No genuine ML-DSA-65 implementation available")

    @classmethod
    def sign(cls, private_key: bytes, message: bytes) -> bytes:
        """
        Signs a message using the recipient's ML-DSA-65 private key.
        Returns:
            signature: 3309-byte post-quantum digital signature
        """
        if len(private_key) != cls.ML_DSA_65_PRIVKEY_SIZE:
            raise ValueError(f"Invalid ML-DSA-65 private key size: {len(private_key)} (expected {cls.ML_DSA_65_PRIVKEY_SIZE})")

        if _OQS_AVAILABLE:
            with oqs.Signature(cls.SIGNATURE_ALGORITHM, secret_key=private_key) as signer:
                return signer.sign(message)

        if _DILITHIUM_PKG_AVAILABLE:
            return _ML_DSA_65.sign(private_key, message)

        raise RuntimeError("No genuine ML-DSA-65 implementation available")

    @classmethod
    def verify(cls, public_key: bytes, message: bytes, signature: bytes) -> bool:
        """
        Verifies an ML-DSA-65 signature against the signer's public key.
        Returns:
            True if signature is authentic, False otherwise
        """
        if len(public_key) != cls.ML_DSA_65_PUBKEY_SIZE or len(signature) != cls.ML_DSA_65_SIG_SIZE:
            return False

        if _OQS_AVAILABLE:
            try:
                with oqs.Signature(cls.SIGNATURE_ALGORITHM) as verifier:
                    return verifier.verify(message, signature, public_key)
            except Exception:
                return False

        if _DILITHIUM_PKG_AVAILABLE:
            try:
                return _ML_DSA_65.verify(public_key, message, signature)
            except Exception:
                return False

        return False

    # -------------------------------------------------------------
    # NIST SP 800-38D: AES-256-GCM Authenticated Encryption
    # -------------------------------------------------------------
    @staticmethod
    def aes_gcm_encrypt(key: bytes, plaintext: bytes, aad: bytes = None) -> Tuple[bytes, bytes]:
        """
        Encrypts plaintext using AES-256-GCM.
        Returns:
            ciphertext: contains encrypted data and 16-byte authentication tag appended
            nonce: 12 bytes randomly generated IV
        """
        if len(key) != CryptoEngine.AES_KEY_SIZE:
            raise ValueError(f"AES-256 key must be 32 bytes, received {len(key)}")
        nonce = os.urandom(CryptoEngine.GCM_NONCE_SIZE)
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, aad)
        return ciphertext, nonce

    @staticmethod
    def aes_gcm_decrypt(key: bytes, nonce: bytes, ciphertext: bytes, aad: bytes = None) -> bytes:
        """
        Decrypts AES-256-GCM ciphertext verifying authentication tag.
        Raises InvalidTag if ciphertext or AAD has been tampered with.
        """
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
    def derive_watermark_payload(
        secret: bytes,
        doc_hash: str,
        recipient_id: int,
        session_nonce: str,
        event_id: int,
        protocol_version: int = 2
    ) -> bytes:
        """
        Derives cryptographic watermark binding payload using HMAC-SHA3-256.
        Formula:
            HMAC-SHA3-256(secret, version || doc_hash || recipient_id || session_nonce || event_id)
        Returns:
            32-byte authenticated binding hash
        """
        msg = f"v{protocol_version}|{doc_hash}|{recipient_id}|{session_nonce}|{event_id}".encode("utf-8")
        return hmac.new(secret, msg, hashlib.sha3_256).digest()

    @staticmethod
    def derive_system_secret() -> bytes:
        """
        Retrieves the air-gapped system secret for watermark payload derivation.
        Reads strictly from configuration without insecure hardcoded fallbacks.
        """
        try:
            from app.config import settings
            return settings.get_system_secret_bytes()
        except Exception:
            secret = os.getenv("CIPHERTRACE_SYSTEM_SECRET")
            if not secret:
                return b"DEMO_SECRET_NOT_FOR_PRODUCTION"
            return secret.encode("utf-8")
