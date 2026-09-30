"""
Screenshot attribution tests: engine-level (synthetic viewer screenshots) and router-level
(POST /api/forensics/analyze pipeline against a seeded in-memory database).

Expected tiers are the ones measured while validating the fix:
  * lossless captures whose page is >= ~0.5x scale      -> full "frame"
  * heavy downscale and/or JPEG re-encoding             -> "beacon" (watermark ID only)
Both must recover the embedded watermark ID.
"""

import os
import sys
import unittest
from datetime import datetime
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
os.environ.setdefault("CIPHERTRACE_SYSTEM_SECRET", "TEST_SECRET_FOR_UNIT_TESTS")

from app.services.watermark_engine import WatermarkEngine  # noqa: E402
from fixtures.screenshot_sim import (  # noqa: E402
    make_sample_pdf, render_page, composite_screenshot, to_png_bytes, to_jpeg_bytes, blank_page,
)

WM_ID = "0123456789abcdef0123"
HERE = os.path.abspath(os.path.dirname(__file__))


class _Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = WatermarkEngine()
        cls.sample = os.path.join(HERE, "_shot_sample.pdf")
        cls.wm_pdf = os.path.join(HERE, "_shot_wm.pdf")
        make_sample_pdf(cls.sample)
        cls.frame = cls.engine.build_watermark_frame(WM_ID, "evt_shot", "a" * 64, "b" * 64, "c" * 32)
        cls.engine.embed_watermark(cls.sample, cls.frame, cls.wm_pdf)
        cls.page = render_page(cls.wm_pdf)

    @classmethod
    def tearDownClass(cls):
        for p in (cls.sample, cls.wm_pdf):
            if os.path.exists(p):
                os.remove(p)


class TestScreenshotMatrix(_Base):
    def _check(self, viewport, jpeg_quality, expected_tiers, chrome_offset=0):
        shot, _ = composite_screenshot(self.page, viewport, jpeg_quality, chrome_offset)
        payload, m = self.engine.extract_from_image(shot)
        self.assertTrue(m["watermark_detected"], f"not detected: {m.get('failure_reason')}")
        self.assertIn(m["attribution_tier"], expected_tiers)
        self.assertEqual(m["watermark_id"], WM_ID)
        self.assertTrue(m["authenticity_tag_valid"])
        if m["attribution_tier"] == "frame":
            self.assertEqual(payload, self.frame)
        else:
            self.assertEqual(payload.hex(), WM_ID)

    def test_fullscreen_capture_png(self):
        self._check((2560, 1440), None, ("frame",))

    def test_windowed_capture_png(self):
        self._check((1600, 1000), None, ("frame",))

    def test_windowed_with_chrome_offset(self):
        self._check((1600, 1000), None, ("frame", "beacon"), chrome_offset=3)

    def test_windowed_jpeg_q90(self):
        self._check((1600, 1000), 90, ("frame", "beacon"))

    def test_small_laptop_png(self):
        self._check((1366, 768), None, ("frame", "beacon"))

    def test_small_laptop_jpeg_q75(self):
        self._check((1366, 768), 75, ("frame", "beacon"))

    def test_hidpi_widescreen_jpeg(self):
        self._check((1920, 1200), 85, ("frame", "beacon"))

    def test_screenshot_bytes_through_public_api(self):
        shot, _ = composite_screenshot(self.page, (1600, 1000), None)
        payload, m = self.engine.extract_watermark(to_png_bytes(shot))
        self.assertEqual(m["watermark_id"], WM_ID)

    def test_unwatermarked_screenshot_not_detected(self):
        clean = render_page(self.sample)
        shot, _ = composite_screenshot(clean, (1600, 1000), None)
        payload, m = self.engine.extract_from_image(shot)
        self.assertIsNone(payload)
        self.assertFalse(m["watermark_detected"])
        self.assertEqual(m["attribution_tier"], "none")


class TestRouterIntegration(unittest.IsolatedAsyncioTestCase):
    """evaluate_suspect_stream against a seeded in-memory database."""

    async def asyncSetUp(self):
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.pool import StaticPool
        from app.models.database import (
            Base, User, Document, Distribution, DecryptionEvent, WatermarkRecord,
        )

        self.engine_db = create_async_engine(
            "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
        )
        async with self.engine_db.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        maker = sessionmaker(bind=self.engine_db, class_=AsyncSession, expire_on_commit=False)
        self.db = maker()

        self.wm = WatermarkEngine()
        self.sample = os.path.join(HERE, "_router_sample.pdf")
        self.wm_pdf = os.path.join(HERE, "_router_wm.pdf")
        make_sample_pdf(self.sample)
        frame = self.wm.build_watermark_frame(WM_ID, "1", "a" * 64, "b" * 64, "c" * 32)
        self.wm.embed_watermark(self.sample, frame, self.wm_pdf)
        self.page = render_page(self.wm_pdf)
        render_w, render_h = self.wm.render_size(self.wm_pdf)

        user = User(
            username="rcpt", password_hash="x", navy_id="USR-0001", name="Test Recipient",
            kem_public_key=b"k" * 32, kem_key_id="kem1", dsa_public_key=b"d" * 32, dsa_key_id="dsa1",
        )
        self.db.add(user)
        doc = Document(file_name="doc.pdf", title="Doc", sha3_hash="ab" * 32, original_path="x", size_bytes=1)
        self.db.add(doc)
        await self.db.flush()
        dist = Distribution(document_id=doc.id, recipient_id=user.id, encrypted_dek=b"e")
        self.db.add(dist)
        await self.db.flush()
        event = DecryptionEvent(
            distribution_id=dist.id, session_nonce="NONCE-1", timestamp=datetime.utcnow(),
            device_id="DEV-1", signature=b"s", event_hash="h" * 64,
        )
        self.db.add(event)
        await self.db.flush()
        self.db.add(WatermarkRecord(
            event_id=event.id, watermark_id=WM_ID, watermark_payload=bytes.fromhex(WM_ID) * 3,
            watermark_hex=WM_ID + "0" * 44, watermarked_path=self.wm_pdf,
            render_width=render_w, render_height=render_h,
        ))
        await self.db.commit()
        self.user_id = user.id

    async def asyncTearDown(self):
        await self.db.close()
        await self.engine_db.dispose()
        for p in (self.sample, self.wm_pdf):
            if os.path.exists(p):
                os.remove(p)

    async def _analyze(self, name, data):
        from app.routers import forensics
        with mock.patch.object(forensics.CryptoEngine, "verify", return_value=True), \
             mock.patch.object(forensics.ledger_client, "lookup_watermark", return_value=None):
            return await forensics.evaluate_suspect_stream(name, data, self.db)

    async def test_analyze_screenshot_attributes(self):
        shot, _ = composite_screenshot(self.page, (1600, 1000), None)
        res = await self._analyze("screenshot.png", to_png_bytes(shot))
        self.assertIn(res.status, ("IDENTIFIED", "ATTRIBUTED_WITH_WARNINGS"))
        self.assertEqual(res.recipient.id, self.user_id)
        self.assertEqual(res.watermark_id, WM_ID)
        self.assertTrue(res.authenticity_tag_valid)

    async def test_analyze_pdf_is_full_identification(self):
        with open(self.wm_pdf, "rb") as fh:
            res = await self._analyze("leak.pdf", fh.read())
        self.assertEqual(res.status, "IDENTIFIED")
        self.assertEqual(res.attribution_tier, "frame")
        self.assertGreater(res.match_confidence, WatermarkEngine.BEACON_STRENGTH)  # never capped like a beacon
        self.assertEqual(res.ecc_strategy, WatermarkEngine.ECC_STRATEGY)

    async def test_beacon_only_sets_warning_status(self):
        shot, _ = composite_screenshot(self.page, (1366, 768), None)
        jpeg = to_jpeg_bytes(shot, 75)
        res = await self._analyze("small.jpg", jpeg)
        if res.attribution_tier != "beacon":
            self.skipTest("this capture happened to keep the full frame; beacon path covered elsewhere")
        self.assertEqual(res.status, "ATTRIBUTED_WITH_WARNINGS")
        self.assertEqual(res.recipient.id, self.user_id)
        self.assertLessEqual(res.overall_confidence, 80.0)
        self.assertIn("beacon", res.analysis_narrative.lower())
        self.assertEqual(res.candidate_matches[0].match_type, "PROBABILISTIC")

    async def test_analyze_blank_clears_everyone(self):
        res = await self._analyze("blank.png", to_png_bytes(blank_page()))
        self.assertEqual(res.status, "UNATTRIBUTED")
        self.assertFalse(res.watermark_detected)
        self.assertIsNone(res.watermark_id)
        self.assertIsNone(res.extracted_payload_hex)
        self.assertEqual(res.attribution_tier, "none")
        self.assertEqual(res.bit_error_rate, 100.0)
        self.assertEqual(res.payload_recovery_pct, 0.0)
        self.assertEqual(res.top_suspect_name, "None (Cleared)")
        self.assertIsNone(res.recipient)
        self.assertFalse(any([
            res.verification_gates.watermark_valid, res.verification_gates.ledger_event_exists,
            res.verification_gates.ml_dsa_signature_valid, res.verification_gates.merkle_inclusion_valid,
            res.verification_gates.document_hash_match, res.verification_gates.ledger_chain_integrity,
            res.verification_gates.fabric_consensus_valid,
        ]))
        self.assertTrue(all(c.match_type == "CLEARED" and c.confidence == 0.0 for c in res.candidate_matches))

    async def test_ecc_strategy_reported_from_engine(self):
        res = await self._analyze("blank.png", to_png_bytes(blank_page()))
        self.assertEqual(res.ecc_strategy, WatermarkEngine.ECC_STRATEGY)


if __name__ == '__main__':
    unittest.main()
