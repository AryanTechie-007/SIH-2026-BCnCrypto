import os
import sys
import unittest
import numpy as np
import fitz
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.watermark_engine import WatermarkEngine

class TestWatermarkEngine(unittest.TestCase):

    def setUp(self):
        self.engine = WatermarkEngine()
        self.sample_pdf = os.path.abspath(os.path.join(os.path.dirname(__file__), 'test_sample_fixture.pdf'))
        if not os.path.exists(self.sample_pdf):
            doc = fitz.open()
            page = doc.new_page(width=595, height=842)
            page.insert_text(fitz.Point(50, 70), "OPERATION TRIDENT SHIELD - TEST FIXTURE", fontsize=14, color=(0.1, 0.2, 0.5))
            page.insert_text(fitz.Point(50, 100), "Cryptographic Provenance and Forensic Attestation Data", fontsize=10)
            doc.save(self.sample_pdf)
            doc.close()
        self.output_pdf = os.path.abspath(os.path.join(os.path.dirname(__file__), 'test_wm_out.pdf'))

    def tearDown(self):
        for p in (self.output_pdf, self.sample_pdf):
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    def test_watermark_color_fidelity_and_preservation(self):
        """Verifies that watermarked PDF does NOT have neon green/yellow color distortion."""
        self.assertTrue(os.path.exists(self.sample_pdf), f"Sample PDF not found at {self.sample_pdf}")

        payload = b"OFFICER_VERMA_01"
        self.engine.embed_watermark(self.sample_pdf, payload, self.output_pdf)
        self.assertTrue(os.path.exists(self.output_pdf))

        # Inspect pixel differences between original and watermarked
        doc_orig = fitz.open(self.sample_pdf)
        pix_orig = doc_orig[0].get_pixmap(dpi=150)
        img_orig = np.array(Image.frombytes("RGB", [pix_orig.width, pix_orig.height], pix_orig.samples))
        doc_orig.close()

        doc_wm = fitz.open(self.output_pdf)
        pix_wm = doc_wm[0].get_pixmap(dpi=150)
        img_wm = np.array(Image.frombytes("RGB", [pix_wm.width, pix_wm.height], pix_wm.samples))
        doc_wm.close()

        # Check color drift
        mean_orig = img_orig.mean(axis=(0, 1))
        mean_wm = img_wm.mean(axis=(0, 1))
        color_drift = np.abs(mean_orig - mean_wm)

        # Neon green distortion caused drifts of > 100 on G and R.
        # Clean uint8 YCrCb processing has drift < 5.0 (virtually invisible)
        self.assertLess(color_drift.max(), 5.0, f"Excessive color drift detected: {color_drift}")

    def test_watermark_embedding_and_extraction(self):
        """Verifies 100% mathematical extraction of a 16-byte payload from watermarked PDF."""
        test_payload = b"JOSHI_PQC_ATTRIB"
        self.engine.embed_watermark(self.sample_pdf, test_payload, self.output_pdf)

        extracted, metrics = self.engine.extract_watermark(self.output_pdf)

        self.assertIsNotNone(extracted, "Extraction returned None")
        self.assertEqual(extracted, test_payload, f"Extracted {extracted} does not match {test_payload}")
        self.assertTrue(metrics["watermark_detected"])
        self.assertTrue(metrics["ecc_corrected"])
        self.assertEqual(metrics["payload_recovery_pct"], 100.0)

    def test_reed_solomon_error_resilience(self):
        """Verifies Reed-Solomon (255, 127) corrects corrupted bytes."""
        payload = b"COMMANDER_S_RAO_"
        coded = bytearray(self.engine.rs.encode(payload))

        # Intentionally corrupt 4 bytes
        coded[3] ^= 0xAA
        coded[7] ^= 0x55
        coded[12] ^= 0xFF
        coded[20] ^= 0x12

        # RS must recover original payload
        decoded = bytes(self.engine.rs.decode(coded)[0])
        self.assertEqual(decoded, payload)

if __name__ == '__main__':
    unittest.main()
