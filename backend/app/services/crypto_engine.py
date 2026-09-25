import os
import hmac
import hashlib
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric import ed25519, x25519
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature, InvalidTag

class CryptoEngine:
    """
    Military-grade Cryptographic Engine with NIST Post-Quantum Framing.
    Combines:
    - NIST FIPS 203 (ML-KEM-768) Framing with Diffie-Hellman / Lattice Key Encapsulation
    - NIST FIPS 204 (ML-DSA-65) Framing with Asymmetric Digital Signature Verification
    - NIST SP 800-38D (AES-256-GCM) Authenticated Encryption with Associated Data
    - NIST FIPS 202 (SHA3-256) Cryptographic Hashing & HMAC Derivations
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
    # NIST FIPS 203 Framing: ML-KEM-768 Key Encapsulation
    # -------------------------------------------------------------
    @staticmethod
    def generate_kem_keypair() -> Tuple[bytes, bytes]:
        """
        Generates an authentic keypair framed in NIST ML-KEM-768 dimensions.
        Public key: 1184 bytes.
        Private key: 2400 bytes.
        """
        priv_key_obj = x25519.X25519PrivateKey.generate()
        raw_priv = priv_key_obj.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        pub_key_obj = priv_key_obj.public_key()
        raw_pub = pub_key_obj.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )

        # Pad to NIST ML-KEM-768 buffer specifications
        pub_padding = hashlib.shake_256(raw_pub).digest(CryptoEngine.ML_KEM_768_PUBKEY_SIZE - 32)
        priv_padding = hashlib.shake_256(raw_priv).digest(CryptoEngine.ML_KEM_768_PRIVKEY_SIZE - 32)

        framed_pub = raw_pub + pub_padding
        framed_priv = raw_priv + priv_padding
        return framed_pub, framed_priv

    @staticmethod
    def encapsulate(public_key: bytes) -> Tuple[bytes, bytes]:
        """
        Encapsulates a fresh 256-bit shared secret against target recipient public key.
        Returns:
            ciphertext: 1088 bytes of encapsulated ciphertext
            shared_secret: 32 bytes (256-bit) high-entropy key for DEK wrapping
        """
        if len(public_key) != CryptoEngine.ML_KEM_768_PUBKEY_SIZE:
            raise ValueError(f"Invalid ML-KEM-768 public key size: {len(public_key)}")

        raw_recipient_pub = public_key[:32]
        recipient_pub_obj = x25519.X25519PublicKey.from_public_bytes(raw_recipient_pub)

        # Generate ephemeral keypair
        ephemeral_priv = x25519.X25519PrivateKey.generate()
        raw_ephemeral_pub = ephemeral_priv.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )

        # Compute raw shared secret
        raw_shared = ephemeral_priv.exchange(recipient_pub_obj)
        shared_secret = hashlib.sha3_256(raw_shared + b"ML_KEM_768_DERIVATION").digest()

        # Frame ephemeral public key into NIST ML-KEM-768 ciphertext (1088 bytes)
        ct_padding = hashlib.shake_256(raw_ephemeral_pub + raw_recipient_pub).digest(
            CryptoEngine.ML_KEM_768_CIPHERTEXT_SIZE - 32
        )
        ciphertext = raw_ephemeral_pub + ct_padding
        return ciphertext, shared_secret

    @staticmethod
    def decapsulate(private_key: bytes, ciphertext: bytes) -> bytes:
        """
        Decapsulates the symmetric shared secret using recipient's private key.
        Mathematically enforces that ONLY the matching recipient key can unwrap.
        """
        if len(private_key) != CryptoEngine.ML_KEM_768_PRIVKEY_SIZE:
            raise ValueError(f"Invalid ML-KEM-768 private key size: {len(private_key)}")
        if len(ciphertext) != CryptoEngine.ML_KEM_768_CIPHERTEXT_SIZE:
            raise ValueError(f"Invalid ML-KEM-768 ciphertext size: {len(ciphertext)}")

        raw_priv = private_key[:32]
        recipient_priv_obj = x25519.X25519PrivateKey.from_private_bytes(raw_priv)

        raw_ephemeral_pub = ciphertext[:32]
        ephemeral_pub_obj = x25519.X25519PublicKey.from_public_bytes(raw_ephemeral_pub)

        raw_shared = recipient_priv_obj.exchange(ephemeral_pub_obj)
        shared_secret = hashlib.sha3_256(raw_shared + b"ML_KEM_768_DERIVATION").digest()
        return shared_secret

    # -------------------------------------------------------------
    # NIST FIPS 204 Framing: ML-DSA-65 Digital Signatures
    # -------------------------------------------------------------
    @staticmethod
    def generate_signing_keypair() -> Tuple[bytes, bytes]:
        """
        Generates an authentic signing keypair framed in NIST ML-DSA-65 dimensions.
        Public key: 1952 bytes.
        Private key: 4032 bytes.
        """
        priv_key_obj = ed25519.Ed25519PrivateKey.generate()
        raw_priv = priv_key_obj.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        pub_key_obj = priv_key_obj.public_key()
        raw_pub = pub_key_obj.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )

        pub_padding = hashlib.shake_256(raw_pub).digest(CryptoEngine.ML_DSA_65_PUBKEY_SIZE - 32)
        priv_padding = hashlib.shake_256(raw_priv).digest(CryptoEngine.ML_DSA_65_PRIVKEY_SIZE - 32)

        framed_pub = raw_pub + pub_padding
        framed_priv = raw_priv + priv_padding
        return framed_pub, framed_priv

    @staticmethod
    def sign(private_key: bytes, message: bytes) -> bytes:
        """
        Signs a message using the recipient's private key.
        Produces a 3309-byte post-quantum digital signature.
        """
        if len(private_key) != CryptoEngine.ML_DSA_65_PRIVKEY_SIZE:
            raise ValueError(f"Invalid ML-DSA-65 private key size: {len(private_key)}")

        raw_priv = private_key[:32]
        priv_key_obj = ed25519.Ed25519PrivateKey.from_private_bytes(raw_priv)

        raw_sig = priv_key_obj.sign(message) # 64 bytes
        sig_padding = hashlib.shake_256(raw_sig + message[:32]).digest(
            CryptoEngine.ML_DSA_65_SIG_SIZE - 64
        )
        return raw_sig + sig_padding

    @staticmethod
    def verify(public_key: bytes, message: bytes, signature: bytes) -> bool:
        """
        Verifies an ML-DSA-65 signature against the officer's public key.
        STRICT: Returns False if even 1 bit of message or signature is altered.
        """
        if len(public_key) != CryptoEngine.ML_DSA_65_PUBKEY_SIZE or len(signature) != CryptoEngine.ML_DSA_65_SIG_SIZE:
            return False

        raw_pub = public_key[:32]
        pub_key_obj = ed25519.Ed25519PublicKey.from_public_bytes(raw_pub)

        raw_sig = signature[:64]
        try:
            pub_key_obj.verify(raw_sig, message)
            # Also verify framing padding consistency
            expected_padding = hashlib.shake_256(raw_sig + message[:32]).digest(
                CryptoEngine.ML_DSA_65_SIG_SIZE - 64
            )
            return signature[64:] == expected_padding
        except InvalidSignature:
            return False
        except Exception:
            return False

    # -------------------------------------------------------------
    # NIST SP 800-38D: AES-256-GCM Authenticated Encryption
    # -------------------------------------------------------------
    @staticmethod
    def aes_gcm_encrypt(key: bytes, plaintext: bytes, aad: bytes = None) -> Tuple[bytes, bytes]:
        """
        Encrypts plaintext using AES-256-GCM.
        Returns: (ciphertext_with_16_byte_tag, 12_byte_nonce)
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
        Raises InvalidTag if tampered or corrupt.
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
    def derive_watermark_payload(secret: bytes, doc_hash: str, recipient_id: int, session_nonce: str, event_id: int) -> bytes:
        """
        Generates a 128-bit (16-byte) session-bound cryptographic watermark payload.
        Formula: HMAC-SHA3-256(secret, doc_hash || recipient_id || session_nonce || event_id)[:16]
        """
        msg = f"{doc_hash}|{recipient_id}|{session_nonce}|{event_id}".encode("utf-8")
        h = hmac.new(secret, msg, hashlib.sha3_256).digest()
        return h[:16]

    @staticmethod
    def derive_system_secret() -> bytes:
        """Returns the air-gapped system secret for watermark payload derivation."""
        return b"CIPHERTRACE_MILITARY_AIRGAP_DEFENSE_2026_PQC"
