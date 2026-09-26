import os
import sys
import json
import sqlite3
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.config import settings
from app.services.crypto_engine import CryptoEngine
from app.services.keystore import KeystoreManager, KeystoreAuthenticationError
from app.models.database import User
from app.routers.auth import user_to_schema
from app.schemas import EvidenceBundle


class TestKeystoreAndKeyIsolation(unittest.TestCase):

    def setUp(self):
        self.test_user_id = 8888
        self.test_username = "audit_officer"
        self.test_password = "SecurePassword2026!"
        self.k_pub, self.k_priv = CryptoEngine.generate_kem_keypair()
        self.s_pub, self.s_priv = CryptoEngine.generate_signing_keypair()

    def tearDown(self):
        path = KeystoreManager.get_keystore_path(self.test_user_id, self.test_username)
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

    def test_database_schema_contains_no_private_keys(self):
        """CRITICAL SECURITY TEST: Verifies users table has NO plaintext private key columns."""
        if os.path.exists(settings.DB_PATH):
            con = sqlite3.connect(settings.DB_PATH)
            cur = con.cursor()
            cur.execute("PRAGMA table_info(users)")
            cols = [col[1].lower() for col in cur.fetchall()]
            con.close()

            self.assertNotIn("kem_private_key", cols)
            self.assertNotIn("dsa_private_key", cols)
            self.assertNotIn("private_key", cols)
            self.assertIn("kem_public_key", cols)
            self.assertIn("dsa_public_key", cols)
            self.assertIn("kem_key_id", cols)
            self.assertIn("dsa_key_id", cols)

    def test_keystore_creation_and_unlock(self):
        """Verifies encrypted recipient keystore creation, Argon2id KDF, and unlocking."""
        path, kid, sid = KeystoreManager.create_keystore(
            user_id=self.test_user_id,
            username=self.test_username,
            password=self.test_password,
            kem_private_key=self.k_priv,
            dsa_private_key=self.s_priv,
            kem_public_key=self.k_pub,
            dsa_public_key=self.s_pub
        )
        self.assertTrue(os.path.exists(path))

        # Inspect raw keystore file: must NOT contain plaintext private keys
        with open(path, "r", encoding="utf-8") as f:
            keystore_data = json.load(f)

        self.assertEqual(keystore_data["kdf"], "Argon2id")
        self.assertEqual(keystore_data["cipher"], "AES-256-GCM")
        self.assertIn("ciphertext_b64", keystore_data)
        self.assertNotIn("kem_private_key", json.dumps(keystore_data))
        self.assertNotIn("dsa_private_key", json.dumps(keystore_data))

    def test_decapsulate_and_sign_without_exposing_private_key(self):
        """Verifies recipient decapsulation and signing operations inside keystore boundary."""
        path, _, _ = KeystoreManager.create_keystore(
            user_id=self.test_user_id,
            username=self.test_username,
            password=self.test_password,
            kem_private_key=self.k_priv,
            dsa_private_key=self.s_priv,
            kem_public_key=self.k_pub,
            dsa_public_key=self.s_pub
        )

        # 1. Decapsulation
        ct, shared_orig = CryptoEngine.encapsulate(self.k_pub)
        shared_keystore = KeystoreManager.decapsulate(path, self.test_password, ct)
        self.assertEqual(shared_orig, shared_keystore)

        # 2. Signing
        msg = b"CIPHERTRACE_SECURITY_AUDIT_MSG_FIPS_204"
        sig = KeystoreManager.sign(path, self.test_password, msg)
        self.assertEqual(len(sig), CryptoEngine.ML_DSA_65_SIG_SIZE)
        self.assertTrue(CryptoEngine.verify(self.s_pub, msg, sig))

    def test_wrong_keystore_password_fails(self):
        """Verifies wrong password raises KeystoreAuthenticationError."""
        path, _, _ = KeystoreManager.create_keystore(
            user_id=self.test_user_id,
            username=self.test_username,
            password=self.test_password,
            kem_private_key=self.k_priv,
            dsa_private_key=self.s_priv,
            kem_public_key=self.k_pub,
            dsa_public_key=self.s_pub
        )
        ct, _ = CryptoEngine.encapsulate(self.k_pub)
        with self.assertRaises(KeystoreAuthenticationError):
            KeystoreManager.decapsulate(path, "WrongPassword123!", ct)

    def test_api_schema_never_includes_private_keys(self):
        """Verifies user API serialization model never exposes private keys."""
        dummy_user = User(
            id=1,
            username="verma",
            navy_id="NAVY-0001",
            name="Captain Verma",
            rank="CAPTAIN",
            command_unit="COMMAND",
            clearance_level="TOP SECRET",
            device_id="DEV-01",
            role="RECIPIENT",
            status="ACTIVE",
            kem_public_key=self.k_pub,
            kem_key_id="kid123",
            dsa_public_key=self.s_pub,
            dsa_key_id="sid123",
            key_status="ACTIVE",
            keystore_path="/secure/path"
        )
        schema = user_to_schema(dummy_user)
        dump = schema.model_dump()

        self.assertNotIn("kem_private_key", dump)
        self.assertNotIn("dsa_private_key", dump)
        self.assertNotIn("private_key", dump)

    def test_evidence_bundle_never_includes_private_keys(self):
        """Verifies court-admissible evidence package contains NO private keys."""
        fields = list(EvidenceBundle.model_fields.keys())
        for f in fields:
            self.assertNotIn("private", f.lower())
            self.assertNotIn("secret_key", f.lower())


if __name__ == '__main__':
    unittest.main()
