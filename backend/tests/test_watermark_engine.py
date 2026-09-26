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

    def test_reed_solomon_parameters_are_genuine_255_127(self):
        """Verifies engine implements genuine RS(255, 127) with 127 data and 128 parity symbols."""
        self.assertEqual(self.engine.FRAME_DATA_LEN, 127)
        self.assertEqual(self.engine.PARITY_LEN, 128)
        self.assertEqual(self.engine.CODEWORD_LEN, 255)
        self.assertEqual(self.engine.ECC_STRATEGY, "Reed-Solomon RS(255, 127)")

        # Verify RSCodec has 128 parity symbols
        data_127 = os.urandom(127)
        encoded = self.engine.rs.encode(data_127)
        self.assertEqual(len(encoded), 255)

        # Corrupt 50 bytes (can correct up to 64 byte errors!)
        corrupted = bytearray(encoded)
        for i in range(10, 60):
            corrupted[i] ^= 0xFF

        decoded = self.engine.rs.decode(bytes(corrupted))[0]
        self.assertEqual(decoded, data_127)

    def test_watermark_color_fidelity_and_preservation(self):
        """Verifies that watermarked PDF does NOT have color distortion (pure Y-channel modulation)."""
        frame = self.engine.build_watermark_frame(
            watermark_id="a1b2c3d4e5f60718293a",
            event_id="evt_test_123",
            document_hash="0" * 64,
            recipient_key_id="1" * 64,
            session_nonce="nonce_test_001"
        )
        self.engine.embed_watermark(self.sample_pdf, frame, self.output_pdf)
        self.assertTrue(os.path.exists(self.output_pdf))

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
        self.assertLess(color_drift.max(), 5.0, f"Excessive color drift detected: {color_drift}")

    def test_watermark_embedding_and_extraction_roundtrip(self):
        """Verifies 127-byte authenticated frame round-trip extraction and verification."""
        target_wm_id = "0123456789abcdef0123"
        frame = self.engine.build_watermark_frame(
            watermark_id=target_wm_id,
            event_id="e1234567-89ab-cdef-0123-456789abcdef",
            document_hash="a" * 64,
            recipient_key_id="b" * 64,
            session_nonce="c" * 32
        )
        self.assertEqual(len(frame), 127)

        self.engine.embed_watermark(self.sample_pdf, frame, self.output_pdf)
        extracted, metrics = self.engine.extract_watermark(self.output_pdf)

        self.assertIsNotNone(extracted, "Extraction returned None")
        self.assertTrue(metrics["watermark_detected"])
        self.assertEqual(metrics["payload_recovery_pct"], 100.0)

        parsed = self.engine.parse_watermark_frame(extracted)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["watermark_id"], target_wm_id)
        self.assertTrue(parsed["authenticity_tag_valid"])


if __name__ == '__main__':
    unittest.main()
