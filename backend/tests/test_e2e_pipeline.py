import os
import sys
import unittest
import asyncio
from fastapi import UploadFile
from sqlalchemy import delete

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import init_db, AsyncSessionLocal
from app.routers.documents import distribute_document
from app.routers.decryption import decrypt_document
from app.routers.forensics import analyze_leaked_document
from app.schemas import DistributeRequest, DecryptionRequest
from app.models.database import User, Document, WatermarkRecord, Distribution, DecryptionEvent, LedgerBlock
from app.services.crypto_engine import CryptoEngine
from sqlalchemy.future import select

class TestE2EPipeline(unittest.TestCase):

    def setUp(self):
        async def init_test_fixtures():
            await init_db()
            async with AsyncSessionLocal() as session:
                await session.execute(delete(WatermarkRecord))
                await session.execute(delete(LedgerBlock).where(LedgerBlock.id > 0))
                await session.execute(delete(DecryptionEvent))
                await session.execute(delete(Distribution))
                await session.execute(delete(Document))
                await session.execute(delete(User))
                await session.commit()

                # Create test officers
                officers = [
                    (1, "verma", "Captain A. Verma", "NAVY-0001", "DEF-HW-7701"),
                    (2, "rao", "Commander S. Rao", "NAVY-0002", "DEF-HW-7702"),
                    (3, "joshi", "Wing Commander N. Joshi", "NAVY-0003", "DEF-HW-7703"),
                ]
                for uid, uname, name, navy_id, dev_id in officers:
                    k_pub, k_priv = CryptoEngine.generate_kem_keypair()
                    s_pub, s_priv = CryptoEngine.generate_signing_keypair()
                    u = User(
                        id=uid,
                        username=uname,
                        password_hash="test_hash",
                        name=name,
                        navy_id=navy_id,
                        device_id=dev_id,
                        kem_public_key=k_pub,
                        kem_private_key=k_priv,
                        dsa_public_key=s_pub,
                        dsa_private_key=s_priv
                    )
                    session.add(u)

                sample_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "sample_e2e_doc.pdf"))
                if not os.path.exists(sample_path):
                    import fitz
                    pdoc = fitz.open()
                    ppage = pdoc.new_page(width=595, height=842)
                    ppage.insert_text(fitz.Point(50, 70), "OPERATION TRIDENT SHIELD", fontsize=14)
                    pdoc.save(sample_path)
                    pdoc.close()
                with open(sample_path, "rb") as f:
                    content = f.read()
                doc = Document(
                    id=1,
                    file_name="CLASSIFIED_NAVAL_OPERATIONS.pdf",
                    title="OPERATION TRIDENT SHIELD",
                    sha3_hash=CryptoEngine.sha3_256(content),
                    original_path=sample_path,
                    size_bytes=len(content)
                )
                session.add(doc)
                await session.commit()
        asyncio.run(init_test_fixtures())

    def test_complete_forensic_attribution_pipeline(self):
        async def run_async():
            async with AsyncSessionLocal() as session:
                # 1. Distribute to Captain Verma (1) and Wing Commander Joshi (3)
                dist_req = DistributeRequest(
                    document_id=1,
                    recipient_ids=[1, 3]
                )
                dist_res = await distribute_document(dist_req, session)
                self.assertEqual(dist_res.total_envelopes, 2)

                # 2. Decrypt as Wing Commander N. Joshi (ID 3)
                decrypt_req = DecryptionRequest(
                    document_id=1,
                    recipient_id=3,
                    device_id="DEF-HW-7703"
                )
                decrypt_res = await decrypt_document(decrypt_req, session)
                self.assertEqual(decrypt_res.recipient_navy_id, "NAVY-0003")
                self.assertEqual(decrypt_res.recipient_name, "Wing Commander N. Joshi")
                self.assertIsNotNone(decrypt_res.event_id)

                # 3. Retrieve the generated watermarked PDF
                wm_res = await session.execute(
                    select(WatermarkRecord).where(WatermarkRecord.event_id == decrypt_res.event_id)
                )
                wm_record = wm_res.scalar_one()
                self.assertTrue(os.path.exists(wm_record.watermarked_path))

                # 4. Ingest leaked PDF into Forensic Analysis Engine
                with open(wm_record.watermarked_path, "rb") as f:
                    file_content = f.read()

                upload_file = UploadFile(
                    filename=os.path.basename(wm_record.watermarked_path),
                    file=sys.modules['io'].BytesIO(file_content)
                )

                analysis_res = await analyze_leaked_document(upload_file, session)

                # 5. Assert Positive Attribution to Wing Commander N. Joshi
                self.assertEqual(analysis_res.status, "IDENTIFIED")
                self.assertTrue(analysis_res.watermark_detected)
                self.assertEqual(analysis_res.payload_recovery_pct, 100.0)
                self.assertIsNotNone(analysis_res.recipient)
                self.assertEqual(analysis_res.recipient.navy_id, "NAVY-0003")
                self.assertEqual(analysis_res.recipient.name, "Wing Commander N. Joshi")

                # 6. Assert All 6 Verification Gates Passed
                gates = analysis_res.verification_gates
                self.assertTrue(gates.watermark_valid, "Gate 1 failed")
                self.assertTrue(gates.ledger_event_exists, "Gate 2 failed")
                self.assertTrue(gates.ml_dsa_signature_valid, "Gate 3 failed")
                self.assertTrue(gates.merkle_inclusion_valid, "Gate 4 failed")
                self.assertTrue(gates.document_hash_match, "Gate 5 failed")
                self.assertTrue(gates.ledger_chain_integrity, "Gate 6 failed")

                self.assertEqual(analysis_res.overall_confidence, 100.0)

        asyncio.run(run_async())

if __name__ == '__main__':
    unittest.main()
