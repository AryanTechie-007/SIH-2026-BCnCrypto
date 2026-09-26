import os
import io
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
from app.services.keystore import KeystoreManager
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

                # Create test officers with encrypted keystores
                officers = [
                    (1, "verma", "Captain A. Verma", "NAVY-0001", "DEF-HW-7701", "RECIPIENT", "CommanderVerma2026!"),
                    (2, "rao", "Commander S. Rao", "NAVY-0002", "DEF-HW-7702", "RECIPIENT", "LieutenantRao2026!"),
                    (3, "joshi", "Wing Commander N. Joshi", "NAVY-0003", "DEF-HW-7703", "RECIPIENT", "CommanderJoshi2026!"),
                ]
                for uid, uname, name, navy_id, dev_id, role, pwd in officers:
                    k_pub, k_priv = CryptoEngine.generate_kem_keypair()
                    s_pub, s_priv = CryptoEngine.generate_signing_keypair()
                    kpath, kid, sid = KeystoreManager.create_keystore(
                        user_id=uid,
                        username=uname,
                        password=pwd,
                        kem_private_key=k_priv,
                        dsa_private_key=s_priv,
                        kem_public_key=k_pub,
                        dsa_public_key=s_pub
                    )
                    u = User(
                        id=uid,
                        username=uname,
                        password_hash="test_hash",
                        name=name,
                        navy_id=navy_id,
                        device_id=dev_id,
                        role=role,
                        kem_public_key=k_pub,
                        kem_key_id=kid,
                        dsa_public_key=s_pub,
                        dsa_key_id=sid,
                        keystore_path=kpath,
                        status="ACTIVE"
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
                admin_user = await session.get(User, 1)

                # 1. Distribute to Captain Verma (1) and Wing Commander Joshi (3)
                dist_req = DistributeRequest(
                    document_id=1,
                    recipient_ids=[1, 3]
                )
                dist_res = await distribute_document(dist_req, current_user=admin_user, db=session)
                self.assertEqual(dist_res.total_envelopes, 2)

                # 2. Decrypt as Wing Commander N. Joshi (ID 3)
                user3 = await session.get(User, 3)
                decrypt_req = DecryptionRequest(
                    document_id=1,
                    recipient_id=3,
                    device_id="DEF-HW-7703",
                    keystore_password="CommanderJoshi2026!"
                )
                decrypt_res = await decrypt_document(decrypt_req, current_user=user3, db=session)
                self.assertEqual(decrypt_res.recipient_navy_id, "NAVY-0003")
                self.assertEqual(decrypt_res.recipient_name, "Wing Commander N. Joshi")
                self.assertIsNotNone(decrypt_res.event_id)
                self.assertEqual(decrypt_res.signature_algorithm, "ML-DSA-65")
                self.assertEqual(decrypt_res.kem_algorithm, "ML-KEM-768")

                # 3. Retrieve generated watermarked PDF
                wm_res = await session.execute(
                    select(WatermarkRecord).where(WatermarkRecord.event_id == decrypt_res.event_id)
                )
                wm = wm_res.scalar_one_or_none()
                self.assertIsNotNone(wm)
                self.assertTrue(os.path.exists(wm.watermarked_path))

                with open(wm.watermarked_path, "rb") as f:
                    leaked_bytes = f.read()

                # 4. Forensic Investigation of the leaked copy
                upload_file = UploadFile(
                    filename="leaked_intelligence_intercept.pdf",
                    file=io.BytesIO(leaked_bytes)
                )
                analysis_res = await analyze_leaked_document(upload_file, session)

                # 5. Verify Positive Forensic Attribution
                self.assertEqual(analysis_res.status, "IDENTIFIED")
                self.assertTrue(analysis_res.watermark_detected)
                self.assertEqual(analysis_res.recipient.name, "Wing Commander N. Joshi")
                self.assertEqual(analysis_res.recipient.navy_id, "NAVY-0003")
                self.assertEqual(analysis_res.top_suspect_name, "Wing Commander N. Joshi")

                # 6. Verify 6 Cryptographic Gates
                gates = analysis_res.verification_gates
                self.assertTrue(gates.watermark_valid)
                self.assertTrue(gates.ledger_event_exists)
                self.assertTrue(gates.ml_dsa_signature_valid)
                self.assertTrue(gates.merkle_inclusion_valid)
                self.assertTrue(gates.document_hash_match)
                self.assertTrue(gates.ledger_chain_integrity)

                # 7. Verify Evidence Package
                self.assertIsNotNone(analysis_res.evidence_bundle)
                self.assertEqual(analysis_res.evidence_bundle.recipient_navy_id, "NAVY-0003")
                self.assertEqual(analysis_res.evidence_bundle.signature_algorithm, "ML-DSA-65")
                self.assertTrue(len(analysis_res.evidence_bundle.bundle_sha3_digest) == 64)

        asyncio.run(run_async())


if __name__ == '__main__':
    unittest.main()
