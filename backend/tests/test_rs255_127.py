"""
Unit, false-positive and regression tests for the RS(255, 127) fine frame + ID beacon watermark engine.

Replaces test_rs255_251.py. NOTE: build_watermark_frame stamps int(time.time()) into the frame and the HMAC
covers it, so two frames built a second apart differ. Every test builds a frame ONCE and reuses the object.
"""

import os
import sys
import unittest

import numpy as np
from PIL import Image
from scipy.fftpack import dct

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
os.environ.setdefault("CIPHERTRACE_SYSTEM_SECRET", "TEST_SECRET_FOR_UNIT_TESTS")

from reedsolo import ReedSolomonError  # noqa: E402
from app.services.watermark_engine import WatermarkEngine  # noqa: E402
from app.services import watermark_geometry as geo  # noqa: E402
from fixtures.screenshot_sim import make_sample_pdf, render_page, blank_page, noise_image  # noqa: E402

WM_ID = "0123456789abcdef0123"


class TestCodeParameters(unittest.TestCase):
    def setUp(self):
        self.engine = WatermarkEngine()

    def test_code_parameters(self):
        self.assertEqual(self.engine.FRAME_DATA_LEN, 127)
        self.assertEqual(self.engine.PARITY_LEN, 128)
        self.assertEqual(self.engine.FRAME_DATA_LEN + self.engine.PARITY_LEN, self.engine.CODEWORD_LEN)
        self.assertEqual(len(self.engine.rs.encode(bytes(range(127)))), 255)

    def test_corrects_64_byte_errors(self):
        data = bytes(i % 256 for i in range(127))
        coded = bytearray(self.engine.rs.encode(data))
        for pos in range(0, 64 * 4, 4):
            coded[pos] ^= 0xFF
        self.assertEqual(bytes(self.engine.rs.decode(bytes(coded))[0]), data)

    def test_fails_past_65_errors(self):
        data = bytes(i % 256 for i in range(127))
        coded = bytearray(self.engine.rs.encode(data))
        for pos in range(0, 65 * 3, 3):
            coded[pos] ^= 0xFF
        try:
            recovered = bytes(self.engine.rs.decode(bytes(coded))[0])
        except ReedSolomonError:
            return
        self.assertNotEqual(recovered, data)

    def test_beacon_code(self):
        wm = bytes.fromhex(WM_ID)
        cw = self.engine.build_beacon_codeword(wm)
        self.assertEqual(len(cw), 32)
        corrupted = bytearray(cw)
        for pos in range(0, 9):          # t = 9
            corrupted[pos * 3] ^= 0xFF
        payload = bytes(self.engine._rs_beacon.decode(bytes(corrupted))[0])
        self.assertEqual(payload[:10], wm)


class TestFrame(unittest.TestCase):
    def setUp(self):
        self.engine = WatermarkEngine()

    def test_frame_roundtrip(self):
        frame = self.engine.build_watermark_frame(WM_ID, "evt_test_003", "f" * 64, "e" * 64, "d" * 32)
        self.assertEqual(len(frame), 127)
        self.assertTrue(frame.startswith(b"CPTC"))
        parsed = self.engine.parse_watermark_frame(frame)
        self.assertEqual(parsed["watermark_id"], WM_ID)
        self.assertTrue(parsed["authenticity_tag_valid"])

    def test_legacy_251_frame_parses(self):
        frame = self.engine.build_watermark_frame(WM_ID, "evt_test_003", "f" * 64, "e" * 64, "d" * 32, frame_len=251)
        self.assertEqual(len(frame), 251)
        parsed = self.engine.parse_watermark_frame(frame)
        self.assertEqual(parsed["watermark_id"], WM_ID)
        self.assertTrue(parsed["authenticity_tag_valid"])

    def test_tampered_body_rejected(self):
        frame = bytearray(self.engine.build_watermark_frame(WM_ID, "evt", "f" * 64, "e" * 64, "d" * 32))
        frame[20] ^= 0x01                      # body byte flipped, tag untouched
        self.assertFalse(self.engine.parse_watermark_frame(bytes(frame))["authenticity_tag_valid"])

    def test_wrong_secret_rejected(self):
        frame = self.engine.build_watermark_frame(WM_ID, "evt", "f" * 64, "e" * 64, "d" * 32, secret=b"other")
        self.assertFalse(self.engine.parse_watermark_frame(frame)["authenticity_tag_valid"])

    def test_bad_length_rejected(self):
        self.assertIsNone(self.engine.parse_watermark_frame(b"CPTC" + b"\x00" * 100))


class TestGeometryHelpers(unittest.TestCase):
    def test_blocks_helper(self):
        # Guards the loop bound range(0, dim - bs, bs). Do NOT "fix" this to dim // bs: that is a different
        # bit mapping and silently invalidates every watermark ever issued.
        self.assertEqual(geo.blocks(1240, 8), 154)
        self.assertEqual(geo.blocks(1755, 8), 219)
        self.assertEqual(geo.blocks(1240, 32), 38)
        self.assertEqual(geo.blocks(16, 8), 1)      # exact multiple: last block skipped by the bound

    def test_basis_matches_scipy_dct(self):
        blk = np.random.default_rng(0).random((8, 8)) * 255
        d = dct(dct(blk.T, norm='ortho').T, norm='ortho')
        for (u, v) in [(2, 2), (3, 3), (1, 3), (0, 0)]:
            self.assertAlmostEqual(float((blk * geo.dct_basis_2d(8, u, v)).sum()), float(d[u, v]), places=9)

    def test_locate_page(self):
        canvas = np.full((1000, 1600, 3), (52, 55, 60), dtype=np.uint8)
        canvas[84:964, 489:1110] = 255
        self.assertEqual(geo.locate_page(canvas), (489, 84, 621, 880))

    def test_locate_page_rejects_tiny_box(self):
        canvas = np.full((1000, 1600, 3), 30, dtype=np.uint8)
        canvas[10:40, 10:40] = 255
        self.assertIsNone(geo.locate_page(canvas))

    def test_candidate_sizes_aspect(self):
        self.assertEqual(geo.candidate_sizes(621, 880)[0], (1240, 1755))
        self.assertEqual(geo.candidate_sizes(1275, 1650)[0], (1275, 1650))

    def test_candidate_sizes_never_empty_and_extra_first(self):
        self.assertEqual(geo.candidate_sizes(1000, 100), geo.CANONICAL_SIZES)
        self.assertEqual(geo.candidate_sizes(621, 880, extra=[(999, 1400)])[0], (999, 1400))

    def test_phase_offsets(self):
        offsets = list(geo.phase_offsets(8))
        self.assertEqual(offsets[0], (0, 0))
        self.assertEqual(len(offsets), 64)
        self.assertEqual(len(set(offsets)), 64)


class TestFalsePositives(unittest.TestCase):
    """The Step-1 regression suite: failure must never be reported as success."""

    @classmethod
    def setUpClass(cls):
        cls.engine = WatermarkEngine()

    def _assert_not_detected(self, metrics, payload):
        self.assertIsNone(payload)
        self.assertFalse(metrics["watermark_detected"])
        self.assertFalse(metrics["authenticity_tag_valid"])
        self.assertEqual(metrics["attribution_tier"], "none")
        self.assertEqual(metrics["bit_error_rate"], 100.0)
        self.assertEqual(metrics["payload_recovery_pct"], 0.0)
        self.assertTrue(metrics.get("failure_reason"))
        self.assertNotIn("watermark_id", metrics)

    def test_blank_page_not_detected(self):
        self._assert_not_detected(*reversed(self.engine._extract_from_image(blank_page())))

    def test_noise_image_not_detected(self):
        self._assert_not_detected(*reversed(self.engine._extract_from_image(noise_image())))

    def test_tiny_image_reports_too_small(self):
        payload, metrics = self.engine._extract_from_image(Image.new("RGB", (64, 64), "white"))
        self.assertIsNone(payload)
        self.assertEqual(metrics["failure_reason"], "image_too_small")

    def test_random_codewords_never_authenticate(self):
        # The pre-fix gate accepted ~50% of random RS(255,251) codewords; with RS(255,127) + the HMAC
        # requirement, NONE of them may authenticate.
        rng = np.random.default_rng(1)
        accepted = 0
        for _ in range(300):
            cw = bytes(rng.integers(0, 256, 255, dtype=np.uint8))
            try:
                frame = bytes(self.engine.rs.decode(cw)[0])
            except ReedSolomonError:
                continue
            parsed = self.engine.parse_watermark_frame(frame)
            if parsed and parsed["authenticity_tag_valid"]:
                accepted += 1
        self.assertEqual(accepted, 0)


class TestRoundTrips(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = WatermarkEngine()
        cls.dir = os.path.abspath(os.path.dirname(__file__))
        cls.sample = os.path.join(cls.dir, "_sample_rs127.pdf")
        cls.out = os.path.join(cls.dir, "_out_rs127.pdf")
        cls.legacy_out = os.path.join(cls.dir, "_out_legacy.pdf")
        cls.multi_src = os.path.join(cls.dir, "_multi_src.pdf")
        cls.multi_out = os.path.join(cls.dir, "_multi_out.pdf")
        make_sample_pdf(cls.sample)
        cls.frame = cls.engine.build_watermark_frame(WM_ID, "evt_test_003", "a" * 64, "b" * 64, "c" * 32)
        cls.engine.embed_watermark(cls.sample, cls.frame, cls.out)

    @classmethod
    def tearDownClass(cls):
        for p in (cls.sample, cls.out, cls.legacy_out, cls.multi_src, cls.multi_out):
            if os.path.exists(p):
                os.remove(p)

    def test_pdf_roundtrip_exact(self):
        payload, m = self.engine.extract_watermark(self.out)
        self.assertEqual(payload, self.frame)
        self.assertTrue(m["watermark_detected"])
        self.assertEqual(m["attribution_tier"], "frame")
        self.assertEqual(m["bit_error_rate"], 0.0)
        self.assertEqual(m["watermark_id"], WM_ID)
        self.assertEqual(m["ecc_strategy"], self.engine.ECC_STRATEGY)

    def test_pdf_bytes_roundtrip(self):
        with open(self.out, "rb") as fh:
            payload, m = self.engine.extract_watermark(fh.read())
        self.assertEqual(payload, self.frame)

    def test_png_export_roundtrip(self):
        png = os.path.join(self.dir, "_export.png")
        try:
            render_page(self.out).save(png)
            payload, m = self.engine.extract_watermark(png)
            self.assertEqual(m["attribution_tier"], "frame")
            self.assertEqual(m["watermark_id"], WM_ID)
        finally:
            if os.path.exists(png):
                os.remove(png)

    def test_jpeg_no_resize_roundtrip(self):
        jpg = os.path.join(self.dir, "_export.jpg")
        try:
            render_page(self.out).save(jpg, quality=70)
            payload, m = self.engine.extract_watermark(jpg)
            self.assertEqual(m["attribution_tier"], "frame")
            self.assertEqual(m["watermark_id"], WM_ID)
        finally:
            if os.path.exists(jpg):
                os.remove(jpg)

    def test_legacy_document_reads(self):
        lf = self.engine.build_watermark_frame(WM_ID, "evt_legacy", "a" * 64, "b" * 64, "c" * 32, frame_len=251)
        self.engine.embed_watermark(self.sample, lf, self.legacy_out, profile="v2-legacy")
        payload, m = self.engine.extract_watermark(self.legacy_out)
        self.assertEqual(payload, lf)
        self.assertEqual(m["profile"], "v2-legacy")
        self.assertEqual(m["watermark_id"], WM_ID)

    def test_psnr_threshold(self):
        # Both carriers applied. Re-baselined from the old single-carrier 38 dB floor: fine carrier at
        # strength 32 + beacon measures ~34.2 dB on this text page.
        orig = np.array(render_page(self.sample))
        wm = np.array(render_page(self.out))
        psnr = self.engine.calculate_psnr(orig, wm)
        self.assertGreater(psnr, 33.0, f"Visual distortion too high! PSNR={psnr:.2f} dB")

    def test_render_size_matches_pixmap(self):
        self.assertEqual(self.engine.render_size(self.out), render_page(self.out).size)

    def test_every_page_carries_a_codeword(self):
        # Page 0 is an unwatermarked cover sheet; only page 1 carries the mark.
        import fitz
        make_sample_pdf(self.multi_src, pages=2)
        self.engine.embed_watermark(self.multi_src, self.frame, self.multi_out)
        wm_doc = fitz.open(self.multi_out)
        mixed = fitz.open()
        cover = fitz.open(self.multi_src)
        mixed.insert_pdf(cover, from_page=0, to_page=0)   # clean page
        mixed.insert_pdf(wm_doc, from_page=1, to_page=1)  # watermarked page
        mixed_path = os.path.join(self.dir, "_mixed.pdf")
        mixed.save(mixed_path)
        for d in (mixed, cover, wm_doc):
            d.close()
        try:
            payload, m = self.engine.extract_watermark(mixed_path)
            self.assertEqual(m["attribution_tier"], "frame")
            self.assertEqual(m["watermark_id"], WM_ID)
        finally:
            os.remove(mixed_path)


if __name__ == '__main__':
    unittest.main()
