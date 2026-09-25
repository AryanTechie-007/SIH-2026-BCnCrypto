import os
import io
import sys
import unittest
import asyncio
from fastapi import UploadFile, HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import init_db, AsyncSessionLocal
from app.routers.auth import register, login, RegisterRequest, LoginRequest
from app.routers.documents import upload_document, distribute_document
from app.routers.decryption import decrypt_uploaded_envelope
from app.schemas import DistributeRequest
from app.models.database import User, Document, Distribution, DecryptionEvent, WatermarkRecord, LedgerBlock
from sqlalchemy import delete

class TestAuthAndCrossDevice(unittest.TestCase):

    def setUp(self):
        async def clear():
            await init_db()
            async with AsyncSessionLocal() as session:
                await session.execute(delete(WatermarkRecord))
                await session.execute(delete(LedgerBlock).where(LedgerBlock.id > 0))
                await session.execute(delete(DecryptionEvent))
                await session.execute(delete(Distribution))
                await session.execute(delete(Document))
                await session.execute(delete(User))
                await session.commit()
        asyncio.run(clear())

    def test_account_creation_and_cross_device_flow(self):
        async def run_flow():
            async with AsyncSessionLocal() as session:
                # 1. Register Alice, Bob, and Charlie
                alice_res = await register(RegisterRequest(
                    username="alice",
                    password="password123",
                    display_name="Commander Alice",
                    rank="COMMANDER",
                    device_id="DEV-ALICE"
                ), session)
                alice_id = alice_res.user.id

                bob_res = await register(RegisterRequest(
                    username="bob",
                    password="password123",
                    display_name="Captain Bob",
                    rank="CAPTAIN",
                    device_id="DEV-BOB"
                ), session)
                bob_id = bob_res.user.id

                charlie_res = await register(RegisterRequest(
                    username="charlie",
                    password="password123",
                    display_name="Lieutenant Charlie",
                    rank="LIEUTENANT",
                    device_id="DEV-CHARLIE"
                ), session)
                charlie_id = charlie_res.user.id

                # 2. Verify Login
                login_res = await login(LoginRequest(username="bob", password="password123"), session)
                self.assertEqual(login_res.user.username, "bob")

                # 3. Alice uploads a classified document
                sample_pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_doc_auth.pdf"))
                if not os.path.exists(sample_pdf_path):
                    import fitz
                    pdoc = fitz.open()
                    ppage = pdoc.new_page(width=595, height=842)
                    ppage.insert_text(fitz.Point(50, 70), "OPERATION TRIDENT SHIELD - AUTH TEST", fontsize=14)
                    pdoc.save(sample_pdf_path)
                    pdoc.close()
                with open(sample_pdf_path, "rb") as f:
                    pdf_bytes = f.read()

                upload_file = UploadFile(filename="NAVAL_DEPLOYMENT.pdf", file=io.BytesIO(pdf_bytes))
                doc = await upload_document(upload_file, session)

                # 4. Alice encrypts specifically for Bob (excluding Charlie)
                dist_res = await distribute_document(DistributeRequest(
                    document_id=doc.id,
                    recipient_ids=[bob_id]
                ), session)
                self.assertEqual(dist_res.total_envelopes, 1)

                # 5. Read the generated .enc file (simulating cross-device transfer)
                enc_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", f"{doc.file_name}.enc"))
                self.assertTrue(os.path.exists(enc_path))
                with open(enc_path, "rb") as f:
                    enc_bytes = f.read()

                # 6. Unauthorized Decryption: Charlie tries to decrypt the .enc file
                charlie_upload = UploadFile(filename=f"{doc.file_name}.enc", file=io.BytesIO(enc_bytes))
                with self.assertRaises(HTTPException) as cm:
                    await decrypt_uploaded_envelope(charlie_upload, charlie_id, "DEV-CHARLIE", session)
                self.assertEqual(cm.exception.status_code, 403)
                self.assertIn("ACCESS DENIED", cm.exception.detail)

                # 7. Authorized Decryption: Bob decrypts the .enc file on his device
                bob_upload = UploadFile(filename=f"{doc.file_name}.enc", file=io.BytesIO(enc_bytes))
                bob_dec_res = await decrypt_uploaded_envelope(bob_upload, bob_id, "DEV-BOB", session)
                self.assertEqual(bob_dec_res.recipient_name, "Captain Bob")
                self.assertIsNotNone(bob_dec_res.watermark_id)
                self.assertIn("/api/decryption/download/", bob_dec_res.download_url)

        asyncio.run(run_flow())

if __name__ == '__main__':
    unittest.main()
