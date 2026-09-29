"""
Unit and benchmark tests for RS(31, 27) over GF(2^5) Steganography Engine.
"""

import os
import sys
import unittest
import numpy as np
import cv2
import fitz
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.watermark_engine import WatermarkEngine
from reedsolo import ReedSolomonError


class TestRS31_27WatermarkEngine(unittest.TestCase):

    def setUp(self):
        self.engine = WatermarkEngine(embed_strength=18.0, render_dpi=150)
        self.sample_pdf = os.path.abspath(os.path.join(os.path.dirname(__file__), 'sample_rs31_27.pdf'))
        self.output_pdf = os.path.abspath(os.path.join(os.path.dirname(__file__), 'output_rs31_27.pdf'))

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

    def test_rs31_27_mathematical_parameters(self):
        """Validates RS(31, 27) GF(2^5) code properties: n=31, k=27, 2t=4, t=2."""
        self.assertEqual(self.engine.SYMBOL_BITS, 5)
        self.assertEqual(self.engine.DATA_SYMBOLS, 27)
        self.assertEqual(self.engine.PARITY_SYMBOLS, 4)
        self.assertEqual(self.engine.CODEWORD_SYMBOLS, 31)
        self.assertEqual(self.engine.TOTAL_BITS, 155)

        # Encode test symbol sequence
        data_syms = [i % 32 for i in range(27)]
        coded = list(self.engine.rs.encode(data_syms))
        self.assertEqual(len(coded), 31)

        # 1 error correction
        corrupted_1 = coded.copy()
        corrupted_1[5] = (corrupted_1[5] + 7) % 32
        recovered_1 = list(self.engine.rs.decode(corrupted_1)[0])
        self.assertEqual(recovered_1, data_syms)

        # 2 errors correction (maximum t=2)
        corrupted_2 = coded.copy()
        corrupted_2[3] = (corrupted_2[3] + 11) % 32
        corrupted_2[20] = (corrupted_2[20] + 19) % 32
        recovered_2 = list(self.engine.rs.decode(corrupted_2)[0])
        self.assertEqual(recovered_2, data_syms)

        # 3 errors exceeds t=2
        corrupted_3 = coded.copy()
        corrupted_3[1] = (corrupted_3[1] + 3) % 32
        corrupted_3[10] = (corrupted_3[10] + 5) % 32
        corrupted_3[25] = (corrupted_3[25] + 9) % 32
        with self.assertRaises(ReedSolomonError):
            self.engine.rs.decode(corrupted_3)

    def test_rs31_27_payload_packing_and_framing(self):
        """Verifies 16-byte payload packing into 27 5-bit symbols and extraction."""
        test_payload = b"TRIDENT_PAYLOAD1"
        self.assertEqual(len(test_payload), 16)

        symbols = self.engine.payload_to_symbols(test_payload)
        self.assertEqual(len(symbols), 27)
        for s in symbols:
            self.assertTrue(0 <= s < 32, f"Symbol {s} out of GF(2^5) range [0, 31]")

        unpacked = self.engine.symbols_to_payload(symbols)
        self.assertEqual(unpacked, test_payload)

    def test_rs31_27_embedding_and_extraction_roundtrip(self):
        """Verifies full PDF watermarking roundtrip, extraction, and PSNR benchmark."""
        wm_id = "e4a1b2c3d4e5f6071829"
        frame = self.engine.build_watermark_frame(
            watermark_id=wm_id,
            event_id="evt_001",
            document_hash="0" * 64,
            recipient_key_id="1" * 64,
            session_nonce="nonce_abc"
        )
        self.assertEqual(len(frame), 16)

        # Embed into PDF
        self.engine.embed_watermark(self.sample_pdf, frame, self.output_pdf)
        self.assertTrue(os.path.exists(self.output_pdf))

        # Check PSNR visual fidelity
        doc_orig = fitz.open(self.sample_pdf)
        pix_orig = doc_orig[0].get_pixmap(dpi=self.engine.render_dpi)
        img_orig = np.array(Image.frombytes("RGB", [pix_orig.width, pix_orig.height], pix_orig.samples))
        doc_orig.close()

        doc_wm = fitz.open(self.output_pdf)
        pix_wm = doc_wm[0].get_pixmap(dpi=self.engine.render_dpi)
        img_wm = np.array(Image.frombytes("RGB", [pix_wm.width, pix_wm.height], pix_wm.samples))
        doc_wm.close()

        # Compute PSNR over document canvas
        psnr = self.engine.calculate_psnr(img_orig, img_wm)
        print(f"\n[BENCHMARK] RS(31, 27) Document PSNR: {psnr:.2f} dB (Strength={self.engine.embed_strength})")
        self.assertGreater(psnr, 38.0, f"Visual distortion too high! PSNR={psnr:.2f} dB")

        # Extract and verify watermark
        extracted, metrics = self.engine.extract_watermark(self.output_pdf)
        self.assertIsNotNone(extracted, "Watermark extraction failed")
        self.assertTrue(metrics["watermark_detected"])
        self.assertEqual(metrics["payload_recovery_pct"], 100.0)

        parsed = self.engine.parse_watermark_frame(extracted)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["watermark_id"], wm_id)


if __name__ == '__main__':
    unittest.main()
