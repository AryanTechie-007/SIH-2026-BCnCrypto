import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.crypto_engine import HybridPQCEngine, CryptoEngine
from app.services.ai_engine import DocumentIntelligence
from app.services.forensics import ForensicAuditor


class TestHybridPQCAndIntelligence(unittest.TestCase):

    def test_hybrid_key_generation(self):
        engine = HybridPQCEngine("ML-KEM-768")
        keys = engine.generate_hybrid_keys()
        
        self.assertIn("pqc", keys)
        self.assertIn("classical", keys)
        
        pk_pqc, sk_pqc = keys["pqc"]
        pk_classical, sk_classical = keys["classical"]
        
        self.assertTrue(len(pk_pqc) > 0)
        self.assertTrue(len(sk_pqc) > 0)
        self.assertIsNotNone(pk_classical)
        self.assertIsNotNone(sk_classical)

    def test_hybrid_encryption_and_decryption(self):
        engine = HybridPQCEngine("ML-KEM-768")
        keys = engine.generate_hybrid_keys()
        
        payload = b"TOP_SECRET_DEFENSE_ORDERS_SIH_2026"
        encrypted = engine.encrypt_hybrid(payload, keys["pqc"][0], keys["classical"][0])
        
        # Verify required blobs exist
        self.assertIn("pqc_blob", encrypted)
        self.assertIn("classical_blob", encrypted)
        self.assertIn("iv", encrypted)
        self.assertIn("tag", encrypted)
        self.assertIn("payload", encrypted)
        
        # Verify sizes
        self.assertTrue(len(encrypted["pqc_blob"]) > 0)
        self.assertEqual(len(encrypted["classical_blob"]), 32)
        self.assertEqual(len(encrypted["iv"]), 12)
        self.assertEqual(len(encrypted["tag"]), 16)
        
        # Test full round-trip decryption
        decrypted = engine.decrypt_hybrid(encrypted, keys["pqc"][1], keys["classical"][1])
        self.assertEqual(decrypted, payload)

    def test_document_intelligence_classification(self):
        ai = DocumentIntelligence()
        
        # TOP_SECRET test
        res_top = ai.classify_and_configure("Classified nuclear warhead deployment coordinates.")
        self.assertEqual(res_top["label"], "TOP_SECRET")
        self.assertEqual(res_top["policy"]["kem"], "ML-KEM-1024")
        self.assertEqual(res_top["policy"]["auth"], "MFA_REQUIRED")
        self.assertEqual(res_top["policy"]["watermark_strength"], 0.15)
        
        # CONFIDENTIAL test
        res_conf = ai.classify_and_configure("Internal budget and logistics strategy for naval fleet.")
        self.assertEqual(res_conf["label"], "CONFIDENTIAL")
        self.assertEqual(res_conf["policy"]["kem"], "ML-KEM-768")
        self.assertEqual(res_conf["policy"]["auth"], "BIOMETRIC")
        
        # UNCLASSIFIED test
        res_unclass = ai.classify_and_configure("Regular routine announcement.")
        self.assertEqual(res_unclass["label"], "UNCLASSIFIED")
        self.assertEqual(res_unclass["policy"]["kem"], "ML-KEM-512")
        self.assertEqual(res_unclass["policy"]["auth"], "PASSWORD")

    def test_forensic_auditor_confidence(self):
        auditor = ForensicAuditor()
        
        # Authentic with 0 errors
        res_clean = auditor.verify_integrity("hash123", "hash123", bit_errors=0)
        self.assertEqual(res_clean["integrity"], "AUTHENTIC")
        self.assertEqual(res_clean["confidence_score"], "100.00%")
        self.assertEqual(res_clean["admissibility"], "VALID")
        self.assertTrue(res_clean["reconstruction_success"])
        
        # Tampered with higher errors
        res_tampered = auditor.verify_integrity("hash123", "different_hash", bit_errors=30)
        self.assertEqual(res_tampered["integrity"], "TAMPERED")
        self.assertEqual(res_tampered["admissibility"], "QUESTIONABLE")
        self.assertFalse(res_tampered["reconstruction_success"])


if __name__ == "__main__":
    unittest.main()
