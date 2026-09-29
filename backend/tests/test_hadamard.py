"""
Unit and benchmark tests for Walsh-Hadamard Transform (WHT/DSSS) Steganography Engine.
"""

import os
import sys
import unittest
import numpy as np
import fitz
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.watermark_engine import WatermarkEngine


class TestHadamardWatermarkEngine(unittest.TestCase):

    def setUp(self):
        self.engine = WatermarkEngine(embed_strength=2.0, render_dpi=150)
        self.sample_pdf = os.path.abspath(os.path.join(os.path.dirname(__file__), 'sample_hadamard.pdf'))
        self.output_pdf = os.path.abspath(os.path.join(os.path.dirname(__file__), 'output_hadamard.pdf'))

        # Create test PDF fixture
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)
        page.insert_text(fitz.Point(60, 80), "DEFENSE INTELLIGENCE DISPATCH - CONFIDENTIAL", fontsize=15, color=(0.1, 0.2, 0.6))
        page.insert_text(fitz.Point(60, 120), "Operational Watermarking and Provenance Attestation Protocol", fontsize=11)
        for i in range(12):
            page.insert_text(fitz.Point(60, 160 + i * 25), f"Section {i+1}: Standard operational security guidelines and tactical dissemination logs.", fontsize=9)
        doc.save(self.sample_pdf)
        doc.close()

    def tearDown(self):
        for p in (self.output_pdf, self.sample_pdf):
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    def test_hadamard_orthogonality_and_parameters(self):
        """Validates Hadamard matrix orthogonality: H @ H.T = 64 * I."""
        self.assertEqual(self.engine.HADAMARD_ORDER, 64)
        self.assertEqual(self.engine.TOTAL_BITS, 128)
        self.assertEqual(self.engine.FRAME_DATA_LEN, 16)

        H = self.engine.H
        identity_test = np.dot(H, H.T) / 64.0
        self.assertTrue(np.allclose(identity_test, np.eye(64)), "Hadamard matrix must be orthogonal")

        # Verify all selected basis patterns are AC (zero sum)
        for pat in self.engine.basis_patterns:
            self.assertAlmostEqual(float(np.sum(pat)), 0.0, places=5, msg="Hadamard AC patterns must have 0 mean")

    def test_hadamard_frame_serialization(self):
        """Verifies 16-byte authenticated frame construction and parsing."""
        wm_id = "0123456789abcdef0123"
        frame = self.engine.build_watermark_frame(
            watermark_id=wm_id,
            event_id="evt_test_004",
            document_hash="f" * 64,
            recipient_key_id="e" * 64,
            session_nonce="d" * 32
        )
        self.assertEqual(len(frame), 16)
        self.assertTrue(frame.endswith(b"CP"))

        parsed = self.engine.parse_watermark_frame(frame)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["watermark_id"], wm_id)
        self.assertTrue(parsed["authenticity_tag_valid"])

    def test_hadamard_embedding_and_extraction_roundtrip(self):
        """Verifies full PDF watermarking roundtrip, extraction, and high PSNR benchmark."""
        wm_id = "0123456789abcdef0123"
        frame = self.engine.build_watermark_frame(
            watermark_id=wm_id,
            event_id="evt_test_004",
            document_hash="a" * 64,
            recipient_key_id="b" * 64,
            session_nonce="c" * 32
        )

        self.engine.embed_watermark(self.sample_pdf, frame, self.output_pdf)
        self.assertTrue(os.path.exists(self.output_pdf))

        doc_orig = fitz.open(self.sample_pdf)
        pix_orig = doc_orig[0].get_pixmap(dpi=self.engine.render_dpi)
        img_orig = np.array(Image.frombytes("RGB", [pix_orig.width, pix_orig.height], pix_orig.samples))
        doc_orig.close()

        doc_wm = fitz.open(self.output_pdf)
        pix_wm = doc_wm[0].get_pixmap(dpi=self.engine.render_dpi)
        img_wm = np.array(Image.frombytes("RGB", [pix_wm.width, pix_wm.height], pix_wm.samples))
        doc_wm.close()

        psnr = self.engine.calculate_psnr(img_orig, img_wm)
        print(f"\n[BENCHMARK] Hadamard Document PSNR: {psnr:.2f} dB (Strength={self.engine.embed_strength})")
        self.assertGreater(psnr, 40.0, f"Hadamard PSNR should exceed 40.0 dB! Got {psnr:.2f} dB")

        extracted, metrics = self.engine.extract_watermark(self.output_pdf)
        self.assertIsNotNone(extracted, "Watermark extraction failed")
        self.assertTrue(metrics["watermark_detected"])
        self.assertEqual(metrics["payload_recovery_pct"], 100.0)

        parsed = self.engine.parse_watermark_frame(extracted)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["watermark_id"], wm_id)


if __name__ == '__main__':
    unittest.main()
