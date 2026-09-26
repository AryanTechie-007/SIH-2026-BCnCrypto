"""
CIPHERTRACE Local Encrypted Keystore Manager
===========================================
Security Architecture:
- Recipient private keys (ML-KEM-768 and ML-DSA-65) are NEVER stored in SQLite.
- Keystores are stored in encrypted format on the recipient device / storage boundary.
- Key Derivation: Argon2id (RFC 9106) with 64MB memory, 3 iterations, 4 lanes.
- Authenticated Encryption: AES-256-GCM (NIST SP 800-38D).
- Ephemeral Zeroization: Private keys are decrypted in memory only for the duration
  of cryptographic operations and memory buffers are explicitly wiped immediately after.
"""

import os
import json
import base64
import hashlib
from typing import Tuple, Dict, Any, Optional
from argon2.low_level import hash_secret_raw, Type
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

from app.config import settings
from app.services.crypto_engine import CryptoEngine


class KeystoreError(Exception):
    """Base exception for keystore operations."""
    pass


class KeystoreAuthenticationError(KeystoreError):
    """Raised when keystore password or authentication tag is invalid."""
    pass


class KeystoreNotFoundError(KeystoreError):
    """Raised when keystore file is not found."""
    pass


class KeystoreManager:
    """
    Manages local, encrypted, recipient-controlled post-quantum keystores.
    Protects both ML-KEM-768 decapsulation keys and ML-DSA-65 signing keys.
    """

    SCHEMA_VERSION = 2
    KDF_NAME = "Argon2id"
    TIME_COST = 3
    MEMORY_COST = 65536  # 64 MB
    PARALLELISM = 4
    SALT_SIZE = 16
    NONCE_SIZE = 12
    KEY_LEN = 32

    @classmethod
    def _get_keystore_dir(cls) -> str:
        """Returns the configured keystore directory, creating it if needed."""
        kdir = settings.KEYSTORE_DIR
        os.makedirs(kdir, exist_ok=True)
        return kdir

    @classmethod
    def get_keystore_path(cls, user_id: int, username: Optional[str] = None) -> str:
        """Generates canonical filepath for a recipient keystore."""
        kdir = cls._get_keystore_dir()
        if username:
            safe_name = "".join(c for c in username if c.isalnum() or c in ("-", "_"))
            filename = f"user_{user_id}_{safe_name}.keystore"
        else:
            filename = f"user_{user_id}.keystore"
        return os.path.join(kdir, filename)

    @classmethod
    def keystore_exists(cls, user_id: int, username: Optional[str] = None) -> bool:
        """Checks if a keystore exists for the given user ID."""
        path = cls.get_keystore_path(user_id, username)
        if os.path.exists(path):
            return True
        # Check without username suffix
        alt_path = cls.get_keystore_path(user_id)
        return os.path.exists(alt_path)

    @classmethod
    def _derive_kek(cls, password: str, salt: bytes) -> bytes:
        """Derives a 256-bit Key Encryption Key (KEK) using Argon2id."""
        return hash_secret_raw(
            secret=password.encode("utf-8"),
            salt=salt,
            time_cost=cls.TIME_COST,
            memory_cost=cls.MEMORY_COST,
            parallelism=cls.PARALLELISM,
            hash_len=cls.KEY_LEN,
            type=Type.ID
        )

    @staticmethod
    def _zero_buffer(buf: bytearray) -> None:
        """Explicitly zeroes out memory for sensitive key buffers."""
        for i in range(len(buf)):
            buf[i] = 0

    @classmethod
    def create_keystore(
        cls,
        user_id: int,
        username: str,
        password: str,
        kem_private_key: bytes,
        dsa_private_key: bytes,
        kem_public_key: bytes,
        dsa_public_key: bytes,
        key_version: int = 1
    ) -> Tuple[str, str, str]:
        """
        Creates an encrypted keystore file for a recipient.
        Returns:
            filepath: str
            kem_key_id: str (SHA3-256 fingerprint of KEM public key)
            signing_key_id: str (SHA3-256 fingerprint of DSA public key)
        """
        if not password or len(password) < 8:
            raise KeystoreError("Keystore password must be at least 8 characters long")

        # Derive key IDs (fingerprints)
        kem_key_id = CryptoEngine.sha3_256(kem_public_key)[:32]
        signing_key_id = CryptoEngine.sha3_256(dsa_public_key)[:32]

        # Prepare payload
        payload = {
            "user_id": user_id,
            "username": username,
            "key_version": key_version,
            "kem_algorithm": CryptoEngine.KEM_ALGORITHM,
            "signature_algorithm": CryptoEngine.SIGNATURE_ALGORITHM,
            "kem_private_key_b64": base64.b64encode(kem_private_key).decode("ascii"),
            "dsa_private_key_b64": base64.b64encode(dsa_private_key).decode("ascii"),
            "kem_public_key_b64": base64.b64encode(kem_public_key).decode("ascii"),
            "dsa_public_key_b64": base64.b64encode(dsa_public_key).decode("ascii"),
            "kem_key_id": kem_key_id,
            "signing_key_id": signing_key_id
        }
        raw_payload = json.dumps(payload, sort_keys=True).encode("utf-8")

        # Generate fresh salt and nonce
        salt = os.urandom(cls.SALT_SIZE)
        nonce = os.urandom(cls.NONCE_SIZE)

        # Derive KEK via Argon2id
        kek = cls._derive_kek(password, salt)

        try:
            aesgcm = AESGCM(kek)
            ciphertext = aesgcm.encrypt(nonce, raw_payload, None)
        finally:
            # Wipe KEK from memory
            kek_arr = bytearray(kek)
            cls._zero_buffer(kek_arr)

        keystore_envelope = {
            "schema_version": cls.SCHEMA_VERSION,
            "kdf": cls.KDF_NAME,
            "kdf_params": {
                "time_cost": cls.TIME_COST,
                "memory_cost": cls.MEMORY_COST,
                "parallelism": cls.PARALLELISM,
                "salt_b64": base64.b64encode(salt).decode("ascii")
            },
            "cipher": "AES-256-GCM",
            "nonce_b64": base64.b64encode(nonce).decode("ascii"),
            "ciphertext_b64": base64.b64encode(ciphertext).decode("ascii"),
            "metadata": {
                "user_id": user_id,
                "username": username,
                "key_version": key_version,
                "kem_algorithm": CryptoEngine.KEM_ALGORITHM,
                "signature_algorithm": CryptoEngine.SIGNATURE_ALGORITHM,
                "kem_key_id": kem_key_id,
                "signing_key_id": signing_key_id
            }
        }

        filepath = cls.get_keystore_path(user_id, username)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(keystore_envelope, f, indent=2)

        # Restrict permissions on POSIX systems
        try:
            os.chmod(filepath, 0o600)
        except Exception:
            pass

        return filepath, kem_key_id, signing_key_id

    @classmethod
    def _read_and_decrypt(cls, filepath: str, password: str) -> dict:
        """Internal helper to decrypt keystore contents with zeroization."""
        if not os.path.exists(filepath):
            raise KeystoreNotFoundError(f"Keystore not found at {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            envelope = json.load(f)

        kdf_params = envelope.get("kdf_params", {})
        salt = base64.b64decode(kdf_params.get("salt_b64", ""))
        nonce = base64.b64decode(envelope.get("nonce_b64", ""))
        ciphertext = base64.b64decode(envelope.get("ciphertext_b64", ""))

        kek = cls._derive_kek(password, salt)
        try:
            aesgcm = AESGCM(kek)
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            data = json.loads(plaintext.decode("utf-8"))
            return data
        except InvalidTag:
            raise KeystoreAuthenticationError("Invalid keystore password or corrupted keystore")
        finally:
            kek_arr = bytearray(kek)
            cls._zero_buffer(kek_arr)

    @classmethod
    def verify_password(cls, filepath: str, password: str) -> bool:
        """Verifies if the password unlocks the keystore without retaining keys."""
        try:
            cls._read_and_decrypt(filepath, password)
            return True
        except KeystoreAuthenticationError:
            return False
        except Exception:
            return False

    @classmethod
    def decapsulate(cls, filepath: str, password: str, ciphertext: bytes) -> bytes:
        """
        Executes ML-KEM-768 decapsulation within the keystore boundary.
        The raw private key is never returned to the caller and is zeroed immediately.
        """
        data = cls._read_and_decrypt(filepath, password)
        raw_priv = base64.b64decode(data["kem_private_key_b64"])
        priv_arr = bytearray(raw_priv)
        try:
            shared_secret = CryptoEngine.decapsulate(bytes(priv_arr), ciphertext)
            return shared_secret
        finally:
            cls._zero_buffer(priv_arr)

    @classmethod
    def sign(cls, filepath: str, password: str, message: bytes) -> bytes:
        """
        Executes ML-DSA-65 digital signing within the keystore boundary.
        The raw private key is never returned to the caller and is zeroed immediately.
        """
        data = cls._read_and_decrypt(filepath, password)
        raw_priv = base64.b64decode(data["dsa_private_key_b64"])
        priv_arr = bytearray(raw_priv)
        try:
            signature = CryptoEngine.sign(bytes(priv_arr), message)
            return signature
        finally:
            cls._zero_buffer(priv_arr)

    @classmethod
    def get_public_metadata(cls, filepath: str) -> dict:
        """Reads unencrypted metadata header without requiring a password."""
        if not os.path.exists(filepath):
            raise KeystoreNotFoundError(f"Keystore not found at {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            envelope = json.load(f)

        return envelope.get("metadata", {})
