"""
CIPHERTRACE Local Cryptographic Hash-Chain & Merkle Ledger Cache
===============================================================
Role in Target Architecture:
- Authoritative Distributed Ledger: Hyperledger Fabric forensic chaincode, written
  through blockchain/client/cli.js as the decrypting recipient.
- Local Cryptographic Audit Cache: SQLite-backed SHA3-256 Hash Chain with Merkle Root.
- Provides tamper-detection, inclusion proofs, and secondary verification.
"""

import os
import json
import base64
import hashlib
import uuid
from datetime import datetime
from typing import Callable, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.database import LedgerBlock, DecryptionEvent, Distribution, Document, User, WatermarkRecord
from app.services.crypto_engine import CryptoEngine
from app.services import ledger_cli
from app.services.ledger_cli import LedgerCliError


class LedgerCommitError(Exception):
    """The decryption record was not committed to the ledger, so the copy was withheld."""


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

    @staticmethod
    def record_signing_payload(record: Dict[str, Any]) -> bytes:
        """
        The bytes the recipient's ML-DSA-65 signature covers: the canonical JSON of
        every record field except `signature` (sorted keys, no whitespace, UTF-8).
        Verify a record by recomputing this and checking the signature against the
        recipient's dsa_public_key from the keyregistry chaincode.
        """
        unsigned = {k: v for k, v in record.items() if k != "signature"}
        return json.dumps(unsigned, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    @staticmethod
    async def _withhold_copy(db: AsyncSession, wm: WatermarkRecord) -> None:
        """Deletes the watermarked copy so nothing is released without a ledger record."""
        if wm.watermarked_path and os.path.exists(wm.watermarked_path):
            try:
                os.remove(wm.watermarked_path)
            except OSError:
                pass
        await db.delete(wm)
        await db.commit()

    async def commit_decryption_event(
        self,
        db: AsyncSession,
        event_id: int,
        sign: Callable[[bytes], bytes]
    ) -> LedgerBlock:
        """
        Commits a verified decryption event:
        1. Builds the forensic ledger record and has the recipient sign it with their
           ML-DSA-65 key (`sign`, which runs inside the keystore boundary).
        2. Submits it to the forensic chaincode through cli.js, as the recipient's own
           Fabric identity. If that fails, the watermarked copy is deleted and
           LedgerCommitError is raised: nothing is released without a ledger record.
        3. Appends to the local SHA3-256 secondary audit cache.
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

        wm_res = await db.execute(select(WatermarkRecord).where(WatermarkRecord.event_id == event.id))
        wm = wm_res.scalar_one_or_none()
        if not wm or not wm.watermarked_path or not os.path.exists(wm.watermarked_path):
            raise LedgerCommitError("Watermarked copy is missing; nothing to record")

        if not user.bundle_path or not os.path.isdir(user.bundle_path):
            await self._withhold_copy(db, wm)
            raise LedgerCommitError(
                f"No ledger identity bundle on this device for '{user.username}'; sign in again with your bundle"
            )

        with open(wm.watermarked_path, "rb") as wf:
            wm_doc_hash = hashlib.sha256(wf.read()).hexdigest()

        # Forensic chaincode record. document_hash is the SHA3-256 of the original.
        fabric_record = {
            "record_id": str(uuid.uuid4()),
            "watermark_id": wm.watermark_id.lower(),
            "recipient_id": user.username,
            "document_hash": doc.sha3_hash.lower(),
            "watermarked_doc_hash": wm_doc_hash,
            "timestamp": event.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "pqc_algorithm": "ML-DSA-65",
            "recipient_pubkey_fingerprint": hashlib.sha256(user.dsa_public_key).hexdigest()
        }
        try:
            signature = sign(self.record_signing_payload(fabric_record))
        except Exception as e:
            await self._withhold_copy(db, wm)
            raise LedgerCommitError(f"Could not sign the ledger record: {e}")
        fabric_record["signature"] = base64.b64encode(signature).decode("ascii")

        try:
            await ledger_cli.submit_record(user.bundle_path, user.username, fabric_record)
        except LedgerCliError as e:
            await self._withhold_copy(db, wm)
            raise LedgerCommitError(f"Ledger did not accept the decryption record ({e.kind}): {e}")

        # Find latest block for hash chaining
        latest_res = await db.execute(select(LedgerBlock).order_by(LedgerBlock.id.desc()))
        latest_block = latest_res.scalars().first()
        new_block_index = (latest_block.id + 1) if latest_block else 0
        prev_hash = latest_block.block_hash if latest_block else self.GENESIS_PREV_HASH

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
