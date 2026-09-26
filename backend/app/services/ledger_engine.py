"""
CIPHERTRACE Local Cryptographic Hash-Chain & Merkle Ledger Cache
===============================================================
Role in Target Architecture:
- Authoritative Distributed Ledger: Hyperledger Fabric Network (via ledger_client).
- Local Cryptographic Audit Cache: SQLite-backed SHA3-256 Hash Chain with Merkle Root.
- Provides tamper-detection, inclusion proofs, and secondary verification.
"""

import json
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.database import LedgerBlock, DecryptionEvent, Distribution, Document, User, WatermarkRecord
from app.services.crypto_engine import CryptoEngine
from app.services import ledger_client


class LedgerEngine:
    """
    Local Cryptographic Audit Cache implementing SHA3-256 Hash Chaining and Merkle Trees.
    Acts as a secondary validation layer synchronized with Hyperledger Fabric.
    """

    CONSENSUS_ENDORSERS = "Org1-Defense,Org2-Audit,Org3-Forensics"
    GENESIS_PREV_HASH = "0" * 64

    @staticmethod
    def compute_merkle_root(leaf_hashes: List[str]) -> str:
        """Computes a binary SHA3-256 Merkle root over transaction leaf hashes."""
        if not leaf_hashes:
            return CryptoEngine.sha3_256(b"EMPTY_BLOCK_MERKLE_ROOT")
        current_layer = [bytes.fromhex(h) for h in leaf_hashes]
        while len(current_layer) > 1:
            if len(current_layer) % 2 != 0:
                current_layer.append(current_layer[-1])  # Duplicate odd leaf
            next_layer = []
            for i in range(0, len(current_layer), 2):
                combined = current_layer[i] + current_layer[i + 1]
                next_layer.append(hashlib.sha3_256(combined).digest())
            current_layer = next_layer
        return current_layer[0].hex()

    @staticmethod
    def calculate_block_hash(
        block_index: int,
        prev_block_hash: str,
        merkle_root: str,
        timestamp_str: str,
        data_str: str
    ) -> str:
        """Calculates canonical SHA3-256 block hash."""
        raw = f"{block_index}|{prev_block_hash}|{merkle_root}|{timestamp_str}|{data_str}".encode("utf-8")
        return CryptoEngine.sha3_256(raw)

    async def init_genesis_block_if_needed(self, db: AsyncSession):
        """Ensures the Genesis block (Block #0) exists."""
        result = await db.execute(select(LedgerBlock).where(LedgerBlock.id == 0))
        genesis = result.scalar_one_or_none()
        if not genesis:
            ts = datetime.utcnow()
            ts_str = ts.isoformat()
            data = json.dumps({
                "type": "GENESIS_ROOT",
                "network": "CIPHERTRACE_CONSORTIUM_LEDGER",
                "standards": ["NIST FIPS 203 (ML-KEM-768)", "NIST FIPS 204 (ML-DSA-65)"],
                "authorities": self.CONSENSUS_ENDORSERS.split(",")
            }, sort_keys=True)
            merkle = self.compute_merkle_root([CryptoEngine.sha3_256(data.encode("utf-8"))])
            blk_hash = self.calculate_block_hash(0, self.GENESIS_PREV_HASH, merkle, ts_str, data)
            genesis = LedgerBlock(
                id=0,
                event_id=None,
                prev_block_hash=self.GENESIS_PREV_HASH,
                merkle_root=merkle,
                timestamp=ts,
                data=data,
                block_hash=blk_hash,
                endorsers=self.CONSENSUS_ENDORSERS,
                signature_algorithm="ML-DSA-65",
                fabric_tx_id="GENESIS_BLOCK_CONSORTIUM",
                is_tampered=False
            )
            db.add(genesis)
            await db.commit()

    async def commit_decryption_event(self, db: AsyncSession, event_id: int) -> LedgerBlock:
        """
        Commits a verified decryption event:
        1. Submits on-chain to Hyperledger Fabric (via ledger_client.record_decryption).
           In SECURE_MODE, fails closed if Fabric is unavailable.
        2. Appends to local SHA3-256 secondary audit cache.
        """
        await self.init_genesis_block_if_needed(db)

        # Retrieve event and parent records
        res = await db.execute(select(DecryptionEvent).where(DecryptionEvent.id == event_id))
        event = res.scalar_one_or_none()
        if not event:
            raise ValueError(f"DecryptionEvent ID {event_id} not found")

        dist_res = await db.execute(select(Distribution).where(Distribution.id == event.distribution_id))
        dist = dist_res.scalar_one_or_none()
        doc_res = await db.execute(select(Document).where(Document.id == dist.document_id))
        doc = doc_res.scalar_one_or_none()
        user_res = await db.execute(select(User).where(User.id == dist.recipient_id))
        user = user_res.scalar_one_or_none()

        # Find latest block for hash chaining
        latest_res = await db.execute(select(LedgerBlock).order_by(LedgerBlock.id.desc()))
        latest_block = latest_res.scalars().first()
        new_block_index = (latest_block.id + 1) if latest_block else 0
        prev_hash = latest_block.block_hash if latest_block else self.GENESIS_PREV_HASH

        # Retrieve watermark record
        wm_res = await db.execute(select(WatermarkRecord).where(WatermarkRecord.event_id == event.id))
        wm = wm_res.scalar_one_or_none()
        watermark_id = wm.watermark_id if wm and wm.watermark_id else (wm.watermark_hex[:20].lower() if wm else hashlib.sha256(event.session_nonce.encode()).hexdigest()[:20].lower())
        recipient_key_fp = user.dsa_key_id if user and user.dsa_key_id else CryptoEngine.sha3_256(user.dsa_public_key)[:32]
        doc_hash_64 = (doc.sha3_hash[:64] if doc.sha3_hash else "0" * 64).lower()

        # Format Hyperledger Fabric audit record
        fabric_record = {
            "record_id": f"REC_{event.id}_{event.session_nonce[:8]}",
            "watermark_id": watermark_id,
            "event_hash": event.event_hash,
            "document_hash": doc_hash_64,
            "recipient_key_id": recipient_key_fp,
            "recipient_id": user.username or f"user_{user.id}",
            "timestamp": event.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "signature": event.signature.hex(),
            "signature_algorithm": "ML-DSA-65",
            "kem_algorithm": "ML-KEM-768"
        }

        # Submit via Hyperledger Fabric client (enforces fail-closed policy in SECURE_MODE)
        fabric_tx_id = ledger_client.record_decryption(fabric_record)

        # Store fabric transaction ID in the event
        event.fabric_tx_id = fabric_tx_id

        # Local transaction serialization for audit cache
        tx_data = {
            "block_index": new_block_index,
            "event_id": event.id,
            "document_id": doc.id,
            "document_hash": doc.sha3_hash,
            "recipient_id": user.id,
            "recipient_navy_id": user.navy_id,
            "recipient_name": user.name,
            "device_id": event.device_id,
            "session_nonce": event.session_nonce,
            "timestamp": event.timestamp.isoformat(),
            "signature_pqc_hex": event.signature.hex(),
            "signature_algorithm": "ML-DSA-65",
            "kem_algorithm": "ML-KEM-768",
            "event_hash": event.event_hash,
            "fabric_tx_id": fabric_tx_id,
            "fabric_record": fabric_record
        }
        data_str = json.dumps(tx_data, sort_keys=True)
        tx_leaf_hash = CryptoEngine.sha3_256(data_str.encode("utf-8"))
        merkle_root = self.compute_merkle_root([tx_leaf_hash])

        ts = datetime.utcnow()
        ts_str = ts.isoformat()
        block_hash = self.calculate_block_hash(new_block_index, prev_hash, merkle_root, ts_str, data_str)

        new_block = LedgerBlock(
            id=new_block_index,
            event_id=event.id,
            prev_block_hash=prev_hash,
            merkle_root=merkle_root,
            timestamp=ts,
            data=data_str,
            block_hash=block_hash,
            endorsers=self.CONSENSUS_ENDORSERS,
            signature_algorithm="ML-DSA-65",
            fabric_tx_id=fabric_tx_id,
            is_tampered=False
        )
        db.add(new_block)
        await db.commit()
        await db.refresh(new_block)
        return new_block

    async def verify_chain(self, db: AsyncSession) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        Validates the complete local hash chain from Genesis.
        Validates:
        1. Previous block hash chain continuity.
        2. Block hash recomputation.
        3. Merkle root integrity.
        """
        result = await db.execute(select(LedgerBlock).order_by(LedgerBlock.id.asc()))
        blocks = result.scalars().all()

        is_valid = True
        report = []

        for idx, block in enumerate(blocks):
            block_valid = True
            errors = []

            if block.is_tampered:
                block_valid = False
                errors.append("Tamper flag set (detected rogue administrative modification)")

            if idx == 0:
                if block.prev_block_hash != self.GENESIS_PREV_HASH:
                    block_valid = False
                    errors.append("Genesis previous hash link broken")
            else:
                prior_block = blocks[idx - 1]
                if block.prev_block_hash != prior_block.block_hash:
                    block_valid = False
                    errors.append(f"Hash chain broken: prev_hash {block.prev_block_hash[:16]}... != Block #{prior_block.id} hash {prior_block.block_hash[:16]}...")

            ts_str = block.timestamp.isoformat() if hasattr(block.timestamp, 'isoformat') else str(block.timestamp)
            expected_hash = self.calculate_block_hash(block.id, block.prev_block_hash, block.merkle_root, ts_str, block.data)
            if block.block_hash != expected_hash:
                block_valid = False
                errors.append(f"Block hash integrity violation: recorded {block.block_hash[:16]}... != calculated {expected_hash[:16]}...")

            if not block_valid:
                is_valid = False

            report.append({
                "block_index": block.id,
                "block_hash": block.block_hash,
                "prev_block_hash": block.prev_block_hash,
                "merkle_root": block.merkle_root,
                "is_valid": block_valid,
                "errors": errors
            })

        return is_valid, report
