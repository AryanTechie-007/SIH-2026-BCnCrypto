import os
import sys
import unittest
import asyncio
from fastapi import HTTPException
from sqlalchemy import delete

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import init_db, AsyncSessionLocal
from app.routers.documents import distribute_document
from app.routers.decryption import decrypt_document
from app.schemas import DistributeRequest, DecryptionRequest
from app.models.database import User, Document, Distribution, DecryptionEvent, WatermarkRecord, LedgerBlock
from app.services.crypto_engine import CryptoEngine

class TestAccessControl(unittest.TestCase):

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

                # Create 3 test officers
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

                sample_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "demo_assets", "CLASSIFIED_NAVAL_OPERATIONS.pdf"))
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

    def test_unauthorized_recipient_rejection(self):
        async def run_async():
            async with AsyncSessionLocal() as session:
                # 1. Distribute Document #1 to Recipients [1, 2] ONLY (exclude Recipient 3)
                dist_req = DistributeRequest(
                    document_id=1,
                    recipient_ids=[1, 2]
                )
                dist_res = await distribute_document(dist_req, session)
                self.assertEqual(dist_res.total_envelopes, 2)

                # 2. Attempt Decryption as Recipient 3 (Wing Commander N. Joshi)
                unauthorized_req = DecryptionRequest(
                    document_id=1,
                    recipient_id=3
                )
                with self.assertRaises(HTTPException) as cm:
                    await decrypt_document(unauthorized_req, session)

                # Must be 403 Forbidden
                self.assertEqual(cm.exception.status_code, 403)
                self.assertIn("ACCESS DENIED", cm.exception.detail)
                self.assertIn("Wing Commander N. Joshi", cm.exception.detail)

                # 3. Authorized Decryption as Recipient 1 (Captain A. Verma)
                authorized_req = DecryptionRequest(
                    document_id=1,
                    recipient_id=1
                )
                res = await decrypt_document(authorized_req, session)
                self.assertIsNotNone(res.event_id)
                self.assertEqual(res.recipient_name, "Captain A. Verma")
                self.assertIn("WM-", res.watermark_id)

        asyncio.run(run_async())

if __name__ == '__main__':
    unittest.main()
