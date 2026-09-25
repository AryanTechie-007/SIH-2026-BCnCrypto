import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.crypto_engine import CryptoEngine

class TestCryptoEngine(unittest.TestCase):

    def test_sha3_256_hash(self):
        data = b"CIPHERTRACE_MILITARY_AIRGAP_TEST"
        h1 = CryptoEngine.sha3_256(data)
        h2 = CryptoEngine.sha3_256(data)
        self.assertEqual(len(h1), 64)
        self.assertEqual(h1, h2)
        self.assertNotEqual(h1, CryptoEngine.sha3_256(data + b"TAMPER"))

    def test_ml_kem_768_keypair_and_encap(self):
        pub, priv = CryptoEngine.generate_kem_keypair()
        self.assertEqual(len(pub), CryptoEngine.ML_KEM_768_PUBKEY_SIZE)
        self.assertEqual(len(priv), CryptoEngine.ML_KEM_768_PRIVKEY_SIZE)

        ct, secret = CryptoEngine.encapsulate(pub)
        self.assertEqual(len(ct), CryptoEngine.ML_KEM_768_CIPHERTEXT_SIZE)
        self.assertEqual(len(secret), 32)

    def test_ml_dsa_65_signature_and_tamper_rejection(self):
        pub, priv = CryptoEngine.generate_signing_keypair()
        self.assertEqual(len(pub), CryptoEngine.ML_DSA_65_PUBKEY_SIZE)
        self.assertEqual(len(priv), CryptoEngine.ML_DSA_65_PRIVKEY_SIZE)

        msg = b"DECRYPTION_SESSION_EVENT:DOC-1|OFFICER-2|NONCE-8821"
        sig = CryptoEngine.sign(priv, msg)
        self.assertEqual(len(sig), CryptoEngine.ML_DSA_65_SIG_SIZE)

        # Valid verification
        self.assertTrue(CryptoEngine.verify(pub, msg, sig))

        # Tampered message must fail verification
        self.assertFalse(CryptoEngine.verify(pub, msg + b"_TAMPERED", sig))

        # Tampered signature byte must fail verification
        bad_sig = bytearray(sig)
        bad_sig[45] ^= 0xFF
        self.assertFalse(CryptoEngine.verify(pub, msg, bytes(bad_sig)))

    def test_aes_256_gcm_encryption_and_integrity(self):
        key = os.urandom(32)
        plaintext = b"TOP SECRET TACTICAL FLEET ORDERS -- LAT 18.9 N, LON 72.8 E"
        aad = b"AUTHENTICATED_HEADER_CIPHERTRACE"

        ciphertext, nonce = CryptoEngine.aes_gcm_encrypt(key, plaintext, aad)
        self.assertEqual(len(nonce), 12)
        self.assertEqual(len(ciphertext), len(plaintext) + 16)

        decrypted = CryptoEngine.aes_gcm_decrypt(key, nonce, ciphertext, aad)
        self.assertEqual(decrypted, plaintext)

        # Tampered ciphertext must raise exception (AEAD authentication tag failure)
        corrupt_ct = bytearray(ciphertext)
        corrupt_ct[10] ^= 0x01
        with self.assertRaises(Exception):
            CryptoEngine.aes_gcm_decrypt(key, nonce, bytes(corrupt_ct), aad)

    def test_watermark_payload_derivation(self):
        secret = b"AIRGAP_SYSTEM_SECRET_KEY"
        p1 = CryptoEngine.derive_watermark_payload(secret, "hash_doc_1", 2, "nonce_a", 101)
        p2 = CryptoEngine.derive_watermark_payload(secret, "hash_doc_1", 2, "nonce_a", 101)
        p3 = CryptoEngine.derive_watermark_payload(secret, "hash_doc_1", 3, "nonce_a", 101)
        self.assertEqual(len(p1), 16)
        self.assertEqual(p1, p2) # Deterministic for identical inputs
        self.assertNotEqual(p1, p3) # Unique per recipient

if __name__ == '__main__':
    unittest.main()
