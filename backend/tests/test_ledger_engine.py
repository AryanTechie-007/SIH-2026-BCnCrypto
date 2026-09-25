import os
import sys
import unittest
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import init_db, AsyncSessionLocal
from app.services.ledger_engine import LedgerEngine
from app.models.database import LedgerBlock

class TestLedgerEngine(unittest.TestCase):

    def setUp(self):
        self.engine = LedgerEngine()

    def test_merkle_root_computation(self):
        leaf_hashes = [
            "a" * 64,
            "b" * 64,
            "c" * 64
        ]
        root1 = self.engine.compute_merkle_root(leaf_hashes)
        root2 = self.engine.compute_merkle_root(leaf_hashes)
        self.assertEqual(len(root1), 64)
        self.assertEqual(root1, root2)
        # Any modified leaf must change root
        tampered_leaves = ["f" * 64, "b" * 64, "c" * 64]
        self.assertNotEqual(root1, self.engine.compute_merkle_root(tampered_leaves))

    def test_genesis_block_and_tamper_detection(self):
        async def run_async():
            await init_db()
            async with AsyncSessionLocal() as session:
                await self.engine.init_genesis_block_if_needed(session)
                is_valid, report = await self.engine.verify_chain(session)
                self.assertTrue(is_valid, f"Chain invalid: {report}")

                # Simulate a malicious alteration to the genesis block
                from sqlalchemy.future import select
                res = await session.execute(select(LedgerBlock).where(LedgerBlock.id == 0))
                blk = res.scalar_one()
                original_data = blk.data
                blk.data = blk.data.replace("CIPHERTRACE", "ROGUE_ADMIN_HACK")
                await session.commit()

                # Chain verification MUST fail
                is_valid_after_tamper, tamper_report = await self.engine.verify_chain(session)
                self.assertFalse(is_valid_after_tamper, "Tampered block was not detected!")

                # Restore
                blk.data = original_data
                await session.commit()

        asyncio.run(run_async())

if __name__ == '__main__':
    unittest.main()
