import hashlib
import json
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.database import LedgerBlock, DecryptionEvent
from .crypto_service import CryptoService

class LedgerService:
    """
    Implements a permissioned append-only ledger with hash chaining and Merkle proofs.
    """

    @staticmethod
    def compute_merkle_root(events: List[str]) -> str:
        """Computes the Merkle root for a list of event hashes."""
        if not events:
            return ""

        nodes = [CryptoService.sha3_hash(e.encode()) for e in events]

        while len(nodes) > 1:
            if len(nodes) % 2 != 0:
                nodes.append(nodes[-1])

            new_level = []
            for i in range(0, len(nodes), 2):
                combined = nodes[i] + nodes[i+1]
                new_level.append(CryptoService.sha3_hash(combined.encode()))
            nodes = new_level

        return nodes[0]

    async def commit_event(self, db: AsyncSession, event_id: int):
        """
        Commits a decryption event to the ledger.
        """
        # 1. Get the event
        result = await db.execute(select(DecryptionEvent).where(DecryptionEvent.id == event_id))
        event = result.scalar_one()

        # 2. Get the previous block hash
        result = await db.execute(select(LedgerBlock).order_by(LedgerBlock.id.desc()).limit(1))
        prev_block = result.scalar_one_or_none()

        # FIX: Compute hash dynamically instead of using non-existent .sha3_hash
        if prev_block:
            prev_hash = CryptoService.sha3_hash(f"{prev_block.prev_block_hash}|{prev_block.merkle_root}|{prev_block.data}".encode())
        else:
            prev_hash = "GENESIS"

        # 3. Create block data
        block_data = {
            "event_id": event.id,
            "timestamp": event.timestamp.isoformat(),
            "nonce": event.session_nonce,
            "signature": event.signature.hex()
        }
        data_str = json.dumps(block_data, sort_keys=True)

        # 4. Merkle Root
        merkle_root = self.compute_merkle_root([data_str])

        # 5. Create Ledger Block
        new_block = LedgerBlock(
            prev_block_hash=prev_hash,
            merkle_root=merkle_root,
            data=data_str,
            timestamp=datetime.utcnow()
        )

        db.add(new_block)
        await db.commit()
        return new_block.id

    async def verify_integrity(self, db: AsyncSession) -> Tuple[bool, Optional[int]]:
        """
        Verifies the entire hash chain integrity.
        """
        result = await db.execute(select(LedgerBlock).order_by(LedgerBlock.id.asc()))
        blocks = result.scalars().all()

        current_prev_hash = "GENESIS"

        for block in blocks:
            if block.prev_block_hash != current_prev_hash:
                return False, block.id

            block_hash = CryptoService.sha3_hash(f"{block.prev_block_hash}|{block.merkle_root}|{block.data}".encode())
            current_prev_hash = block_hash

        return True, None
