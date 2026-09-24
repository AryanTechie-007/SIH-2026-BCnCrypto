import unittest
from backend.app.services.crypto_service import CryptoService

class TestCryptoService(unittest.TestCase):
    def test_kem_roundtrip(self):
        print("Testing ML-KEM-768 roundtrip...")
        pub, priv = CryptoService.generate_kem_keypair()
        ciphertext, shared_secret_enc = CryptoService.encapsulate(pub)
        shared_secret_dec = CryptoService.decapsulate(priv, ciphertext)
        self.assertEqual(shared_secret_enc, shared_secret_dec)
        print("[OK] ML-KEM-768 roundtrip successful")

    def test_dsa_roundtrip(self):
        print("Testing ML-DSA-65 roundtrip...")
        pub, priv = CryptoService.generate_signing_keypair()
        message = b"Test message for ML-DSA"
        signature = CryptoService.sign(priv, message)
        is_valid = CryptoService.verify(pub, message, signature)
        self.assertTrue(is_valid)
        print("[OK] ML-DSA-65 roundtrip successful")

    def test_aes_gcm_roundtrip(self):
        print("Testing AES-256-GCM roundtrip...")
        key = b"01234567890123456789012345678901" # exactly 32 bytes
        plaintext = b"Secret document content"
        ciphertext = CryptoService.aes_encrypt(key, plaintext)
        decrypted = CryptoService.aes_decrypt(key, ciphertext)
        self.assertEqual(plaintext, decrypted)
        print("[OK] AES-256-GCM roundtrip successful")

    def test_sha3_hash(self):
        print("Testing SHA3-256...")
        data = b"Hash me"
        h1 = CryptoService.sha3_hash(data)
        h2 = CryptoService.sha3_hash(data)
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64) # Hex string of 256 bits
        print("[OK] SHA3-256 successful")

if __name__ == "__main__":
    unittest.main()
