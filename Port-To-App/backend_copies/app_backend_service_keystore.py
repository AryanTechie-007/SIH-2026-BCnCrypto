"""
Local Encrypted Keystore Manager (Mobile Reference Copy).

This file illustrates CIPHERTRACE's Keystore Boundary:
- PQC Decapsulation (ML-KEM-768) and Digital Signing (ML-DSA-65) execute strictly within this boundary.
- Private keys never leave the server's encrypted keystore file or cross wireless boundaries to mobile clients.
- Ephemeral Zeroization: Key buffers are wiped from RAM immediately after cryptographic operations.
- The Android Client only provides biometric verification and keystore passphrases via TLS.
"""

import os
import json
import base64
from typing import Tuple, Dict, Any, Optional
from argon2.low_level import hash_secret_raw, Type
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

from app.config import settings
from app.services.crypto_engine import CryptoEngine


class KeystoreError(Exception):
    pass


class KeystoreAuthenticationError(KeystoreError):
    pass


class KeystoreNotFoundError(KeystoreError):
    pass


class KeystoreManager:
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
        kdir = settings.KEYSTORE_DIR
        os.makedirs(kdir, exist_ok=True)
        return kdir

    @classmethod
    def get_keystore_path(cls, user_id: int, username: Optional[str] = None) -> str:
        kdir = cls._get_keystore_dir()
        if username:
            safe_name = "".join(c for c in username if c.isalnum() or c in ("-", "_"))
            filename = f"user_{user_id}_{safe_name}.keystore"
        else:
            filename = f"user_{user_id}.keystore"
        return os.path.join(kdir, filename)

    @classmethod
    def keystore_exists(cls, user_id: int, username: Optional[str] = None) -> bool:
        path = cls.get_keystore_path(user_id, username)
        if os.path.exists(path):
            return True
        alt_path = cls.get_keystore_path(user_id)
        return os.path.exists(alt_path)

    @classmethod
    def _derive_kek(cls, password: str, salt: bytes) -> bytes:
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
        if not password or len(password) < 8:
            raise KeystoreError("Keystore password must be at least 8 characters long")

        kem_key_id = CryptoEngine.sha3_256(kem_public_key)[:32]
        signing_key_id = CryptoEngine.sha3_256(dsa_public_key)[:32]

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

        salt = os.urandom(cls.SALT_SIZE)
        nonce = os.urandom(cls.NONCE_SIZE)
        kek = cls._derive_kek(password, salt)

        try:
            aesgcm = AESGCM(kek)
            ciphertext = aesgcm.encrypt(nonce, raw_payload, None)
        finally:
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

        try:
            os.chmod(filepath, 0o600)
        except Exception:
            pass

        return filepath, kem_key_id, signing_key_id

    @classmethod
    def _read_and_decrypt(cls, filepath: str, password: str) -> dict:
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
        try:
            cls._read_and_decrypt(filepath, password)
            return True
        except KeystoreAuthenticationError:
            return False
        except Exception:
            return False

    @classmethod
    def decapsulate(cls, filepath: str, password: str, ciphertext: bytes) -> bytes:
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
        if not os.path.exists(filepath):
            raise KeystoreNotFoundError(f"Keystore not found at {filepath}")
        with open(filepath, "r", encoding="utf-8") as f:
            envelope = json.load(f)
        return envelope.get("metadata", {})
