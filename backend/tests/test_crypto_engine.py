import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.crypto_engine import CryptoEngine


class TestCryptoEngine(unittest.TestCase):

    def test_pqc_backend_is_genuine(self):
        """Verifies genuine NIST PQC is active and self-test passes without simulated algorithms."""
        info = CryptoEngine.get_backend_info()
        self.assertTrue(info["is_genuine_pqc"])
        self.assertEqual(info["kem_algorithm"], "ML-KEM-768")
        self.assertEqual(info["signature_algorithm"], "ML-DSA-65")
        self.assertTrue(CryptoEngine.verify_pqc_availability())

    def test_sha3_256_hash(self):
        data = b"CIPHERTRACE_MILITARY_AIRGAP_TEST"
        h1 = CryptoEngine.sha3_256(data)
        h2 = CryptoEngine.sha3_256(data)
        self.assertEqual(len(h1), 64)
        self.assertEqual(h1, h2)
        self.assertNotEqual(h1, CryptoEngine.sha3_256(data + b"TAMPER"))

    def test_real_ml_kem_768_keypair_and_encap(self):
        """Verifies NIST FIPS 203 ML-KEM-768 key lengths and decapsulation correctness."""
        pub, priv = CryptoEngine.generate_kem_keypair()
        self.assertEqual(len(pub), CryptoEngine.ML_KEM_768_PUBKEY_SIZE)
        self.assertEqual(len(priv), CryptoEngine.ML_KEM_768_PRIVKEY_SIZE)

        ct, secret1 = CryptoEngine.encapsulate(pub)
        self.assertEqual(len(ct), CryptoEngine.ML_KEM_768_CIPHERTEXT_SIZE)
        self.assertEqual(len(secret1), CryptoEngine.ML_KEM_768_SHARED_SECRET_SIZE)

        secret2 = CryptoEngine.decapsulate(priv, ct)
        self.assertEqual(secret1, secret2)

    def test_wrong_kem_private_key_fails(self):
        """Verifies that decapsulation with an incorrect private key fails to recover the shared secret."""
        pub1, priv1 = CryptoEngine.generate_kem_keypair()
        pub2, priv2 = CryptoEngine.generate_kem_keypair()

        ct, secret = CryptoEngine.encapsulate(pub1)
        wrong_secret = CryptoEngine.decapsulate(priv2, ct)
        # NIST FIPS 203 implicit rejection: decapsulating with wrong key yields a pseudorandom key, NOT the shared secret
        self.assertNotEqual(secret, wrong_secret)

    def test_real_ml_dsa_65_signature_and_tamper_rejection(self):
        """Verifies NIST FIPS 204 ML-DSA-65 signature generation, verification, and tamper detection."""
        pub, priv = CryptoEngine.generate_signing_keypair()
        self.assertEqual(len(pub), CryptoEngine.ML_DSA_65_PUBKEY_SIZE)
        self.assertEqual(len(priv), CryptoEngine.ML_DSA_65_PRIVKEY_SIZE)

        msg = b"DECRYPTION_SESSION_EVENT:DOC-1|OFFICER-2|NONCE-8821"
        sig = CryptoEngine.sign(priv, msg)
        self.assertEqual(len(sig), CryptoEngine.ML_DSA_65_SIG_SIZE)

        # 1. Valid verification
        self.assertTrue(CryptoEngine.verify(pub, msg, sig))

        # 2. Tampered message must fail verification
        self.assertFalse(CryptoEngine.verify(pub, msg + b"_TAMPERED", sig))

        # 3. Tampered signature byte must fail verification
        bad_sig = bytearray(sig)
        bad_sig[45] ^= 0xFF
        self.assertFalse(CryptoEngine.verify(pub, msg, bytes(bad_sig)))

        # 4. Wrong public key must fail verification
        other_pub, _ = CryptoEngine.generate_signing_keypair()
        self.assertFalse(CryptoEngine.verify(other_pub, msg, sig))

    def test_aes_256_gcm_encryption_and_integrity(self):
        key = os.urandom(32)
        plaintext = b"TOP SECRET TACTICAL FLEET ORDERS -- LAT 18.9 N, LON 72.8 E"
        aad = b"AUTHENTICATED_HEADER_CIPHERTRACE"

        ciphertext, nonce = CryptoEngine.aes_gcm_encrypt(key, plaintext, aad)
        self.assertEqual(len(nonce), 12)
        self.assertEqual(len(ciphertext), len(plaintext) + 16)

        decrypted = CryptoEngine.aes_gcm_decrypt(key, nonce, ciphertext, aad)
        self.assertEqual(decrypted, plaintext)

        corrupt_ct = bytearray(ciphertext)
        corrupt_ct[10] ^= 0x01
        with self.assertRaises(Exception):
            CryptoEngine.aes_gcm_decrypt(key, nonce, bytes(corrupt_ct), aad)

    def test_watermark_payload_derivation(self):
        secret = b"AIRGAP_SYSTEM_SECRET_KEY"
        p1 = CryptoEngine.derive_watermark_payload(secret, "hash_doc_1", 2, "nonce_a", 101)
        p2 = CryptoEngine.derive_watermark_payload(secret, "hash_doc_1", 2, "nonce_a", 101)
        p3 = CryptoEngine.derive_watermark_payload(secret, "hash_doc_1", 3, "nonce_a", 101)
        self.assertEqual(len(p1), 32)
        self.assertEqual(p1, p2)  # Deterministic for identical inputs
        self.assertNotEqual(p1, p3)  # Unique per recipient


if __name__ == '__main__':
    unittest.main()
