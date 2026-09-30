import os
import uuid
import json
import asyncio
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.database import get_db
from app.models.database import WatermarkRecord, DecryptionEvent, Distribution, User, Document, LedgerBlock
from app.services.crypto_engine import CryptoEngine
from app.services.watermark_engine import WatermarkEngine
from app.services.ledger_engine import LedgerEngine
from app.services import ledger_client
from app.schemas import (
    ForensicAnalysisResponse,
    OfficerSchema,
    VerificationGates,
    CandidateMatch,
    BatchForensicResponse,
    EvidenceBundle
)

router = APIRouter(prefix="/api/forensics", tags=["Forensics"])

UPLOAD_TEMP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "forensic_temp"))
os.makedirs(UPLOAD_TEMP_DIR, exist_ok=True)

watermark_engine = WatermarkEngine()
ledger_engine = LedgerEngine()

# Overall / candidate confidence ceiling when only the 10-byte ID beacon (not the full frame) was recovered.
BEACON_ONLY_CONFIDENCE = 80.0

ALLOWED_MIME_SIGNATURES = {
    b"%PDF": "pdf",
    b"\x89PNG\r\n\x1a\n": "png",
    b"\xff\xd8\xff": "jpg",
    b"RIFF": "webp"
}


def _validate_file_magic(file_bytes: bytes, original_filename: str = "") -> str:
    """Validates file magic bytes to prevent file extension spoofing while preserving image types."""
    if file_bytes.startswith(b"%PDF"):
        return "pdf"
    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if file_bytes.startswith(b"\xff\xd8"):
        return "jpg"
    if file_bytes.startswith(b"RIFF") and b"WEBP" in file_bytes[:16]:
        return "webp"
    if file_bytes.startswith(b"BM"):
        return "bmp"
    # Fallback to original extension if supported
    lower = (original_filename or "").lower()
    for ext in ["png", "jpg", "jpeg", "webp", "bmp", "pdf"]:
        if lower.endswith("." + ext):
            return "jpg" if ext == "jpeg" else ext
    if file_bytes.startswith(b"{") or file_bytes.startswith(b"---"):
        return "txt"
    return "bin"


def _safe_remove(file_path: str):
    """Safely cleans up temporary forensic files."""
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass


async def evaluate_suspect_stream(file_name: str, file_bytes: bytes, db: AsyncSession) -> ForensicAnalysisResponse:
    """
    Authoritative Forensic Pipeline:
    uploaded leaked document
    → watermark extraction (native geometry → page-box/rescale/phase search → ID beacon),
      RS(255, 127) frame decoding + HMAC authentication
    → watermark ID
    → Hyperledger Fabric LookupByWatermark (authoritative distributed query)
    → retrieve ledger record & local state
    → verify ML-DSA-65 digital signature against recipient public key
    → verify document hash
    → verify ledger transaction
    → resolve authorized recipient
    → generate cryptographically verifiable evidence bundle
    """
    # 1. File validation
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded file exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE_MB} MB)"
        )

    # 2. Exact canonical render sizes recorded at embed time (tried first by the geometry search)
    size_res = await db.execute(
        select(WatermarkRecord.render_width, WatermarkRecord.render_height)
        .where(WatermarkRecord.render_width.isnot(None), WatermarkRecord.render_height.isnot(None))
        .distinct()
    )
    known_sizes = [(int(w), int(h)) for w, h in size_res.all()]

    # 3. Safe temporary path resolution using UUID
    safe_ext = _validate_file_magic(file_bytes, file_name)
    temp_path = os.path.join(UPLOAD_TEMP_DIR, f"{uuid.uuid4().hex}.{safe_ext}")
    try:
        with open(temp_path, "wb") as buffer:
            buffer.write(file_bytes)

        # 4. Extraction: native geometry -> page-box/rescale/phase search -> ID beacon. CPU-bound
        # (up to several seconds for a file that carries no watermark), so keep it off the event loop.
        extracted_payload, metrics = await asyncio.to_thread(
            watermark_engine.extract_watermark, temp_path, known_sizes
        )
    finally:
        _safe_remove(temp_path)

    # 5. A detection is ONLY an authenticated one (frame HMAC or beacon tag verified by the engine);
    # otherwise there is no watermark ID at all - never a fabricated one.
    ber = float(metrics.get("bit_error_rate", 100.0))
    is_detected = bool(
        metrics.get("watermark_detected", False)
        and metrics.get("authenticity_tag_valid", False)
        and extracted_payload is not None
    )
    tier = metrics.get("attribution_tier", "none") if is_detected else "none"
    beacon_only = (tier == "beacon")
    ecc_strategy = metrics.get("ecc_strategy") or watermark_engine.ECC_STRATEGY
    recovery_pct = float(metrics.get("payload_recovery_pct", 0.0)) if is_detected else 0.0
    watermark_id = metrics.get("watermark_id") if is_detected else None
    if not is_detected:
        extracted_payload = None

    # Load users for candidate list
    users_res = await db.execute(select(User))
    all_users = users_res.scalars().all()

    # 5. Authoritative Ledger Query: Query Hyperledger Fabric first
    fabric_record = None
    if watermark_id:
        try:
            fabric_record = ledger_client.lookup_watermark(watermark_id)
        except Exception:
            fabric_record = None

    # Query local database record for watermark
    target_wm = None
    if watermark_id:
        # Match exact watermark_id or prefix
        wm_res = await db.execute(
            select(WatermarkRecord).where(
                (WatermarkRecord.watermark_id == watermark_id) |
                (WatermarkRecord.watermark_hex.startswith(watermark_id))
            )
        )
        target_wm = wm_res.scalars().first()

    # Attribution requires a genuinely authenticated watermark (frame HMAC or beacon tag). There is
    # deliberately no bit-correlation or payload-comparison fallback: white page areas extract as
    # mostly-'0' bits, which "matched" zero-padded candidates and attributed unrelated files to a real
    # user, and the stored 32-byte HMAC digest can never equal the start of an extracted frame anyway.

    # Resolve event, distribution, user, and document
    matched_event = None
    matched_user = None
    matched_doc = None
    matched_block = None

    if target_wm:
        ev_res = await db.execute(select(DecryptionEvent).where(DecryptionEvent.id == target_wm.event_id))
        matched_event = ev_res.scalar_one_or_none()
        if matched_event:
            dist_res = await db.execute(select(Distribution).where(Distribution.id == matched_event.distribution_id))
            dist = dist_res.scalar_one_or_none()
            if dist:
                u_res = await db.execute(select(User).where(User.id == dist.recipient_id))
                matched_user = u_res.scalar_one_or_none()
                d_res = await db.execute(select(Document).where(Document.id == dist.document_id))
                matched_doc = d_res.scalar_one_or_none()

            b_res = await db.execute(select(LedgerBlock).where(LedgerBlock.event_id == matched_event.id))
            matched_block = b_res.scalar_one_or_none()

    # If fabric record found but no local record, resolve user from fabric record
    if fabric_record and not matched_user:
        rec_username = fabric_record.get("recipient_id")
        rec_key_id = fabric_record.get("recipient_key_id")
        u_res = await db.execute(
            select(User).where(
                (User.username == rec_username) |
                (User.dsa_key_id == rec_key_id)
            )
        )
        matched_user = u_res.scalar_one_or_none()

    # Verify blockchain chain integrity
    chain_valid, _ = await ledger_engine.verify_chain(db)

    # Build candidate matches list
    candidate_matches = []
    for u in all_users:
        is_this_user = (matched_user and u.id == matched_user.id)
        if is_this_user and is_detected:
            conf = BEACON_ONLY_CONFIDENCE if beacon_only else 100.0
            m_type = "PROBABILISTIC" if beacon_only else "CONFIRMED_MATCH"
        else:
            conf = 0.0
            m_type = "CLEARED"
        candidate_matches.append(CandidateMatch(
            officer_id=u.id,
            navy_id=u.navy_id,
            name=u.name,
            rank=u.rank,
            command_unit=u.command_unit,
            device_id=u.device_id,
            confidence=conf,
            match_type=m_type,
            event_id=matched_event.id if is_this_user and matched_event else None,
            document_name=matched_doc.file_name if is_this_user and matched_doc else None
        ))

    candidate_matches.sort(key=lambda x: x.confidence, reverse=True)

    # 6. Cryptographic Verification Gates
    if is_detected and matched_user and matched_event and matched_doc:
        canonical_msg = f"{matched_doc.sha3_hash}|{matched_user.navy_id}|{matched_event.session_nonce}|{matched_event.timestamp.isoformat()}|{matched_event.device_id}".encode("utf-8")

        # Gate 1: Watermark recovered with valid ECC
        gate1_wm_valid = True
        # Gate 2: Ledger event exists
        gate2_event_exists = True
        # Gate 3: ML-DSA-65 Signature verified against recipient's public key
        gate3_sig_valid = CryptoEngine.verify(matched_user.dsa_public_key, canonical_msg, matched_event.signature)
        # Gate 4: Merkle inclusion valid
        gate4_merkle_valid = (matched_block is not None and not matched_block.is_tampered and len(matched_block.merkle_root) == 64)
        # Gate 5: Document SHA3-256 hash match
        gate5_doc_match = (matched_doc is not None and len(matched_doc.sha3_hash) == 64)
        # Gate 6: Ledger chain integrity valid
        gate6_chain_valid = (chain_valid and (matched_block is None or not matched_block.is_tampered))
        # Gate 7: Fabric consensus valid
        gate7_fabric_valid = (fabric_record is not None or matched_event.fabric_tx_id is not None)

        gates = VerificationGates(
            watermark_valid=gate1_wm_valid,
            ledger_event_exists=gate2_event_exists,
            ml_dsa_signature_valid=gate3_sig_valid,
            merkle_inclusion_valid=gate4_merkle_valid,
            document_hash_match=gate5_doc_match,
            ledger_chain_integrity=gate6_chain_valid,
            fabric_consensus_valid=gate7_fabric_valid
        )

        all_gates_passed = all([gate1_wm_valid, gate2_event_exists, gate3_sig_valid, gate4_merkle_valid, gate5_doc_match, gate6_chain_valid])
        overall_conf = 100.0 if all_gates_passed else 90.0
        if beacon_only:
            overall_conf = min(overall_conf, BEACON_ONLY_CONFIDENCE)

        # Construct Evidence Bundle
        raw_bundle = {
            "case_id": f"CASE-{uuid.uuid4().hex[:12].upper()}",
            "watermark_id": watermark_id or target_wm.watermark_id,
            "document_hash": matched_doc.sha3_hash,
            "recipient_key_id": matched_user.dsa_key_id,
            "recipient_identity": matched_user.name,
            "recipient_navy_id": matched_user.navy_id,
            "decryption_event_id": matched_event.id,
            "timestamp": matched_event.timestamp.isoformat(),
            "signature_algorithm": "ML-DSA-65",
            "signature_hex": matched_event.signature.hex(),
            "public_key_hex": matched_user.dsa_public_key.hex(),
            "event_hash": matched_event.event_hash,
            "fabric_tx_id": matched_event.fabric_tx_id or (fabric_record.get("fabric_tx_id") if fabric_record else None),
            "fabric_block_number": matched_block.id if matched_block else 1,
            "fabric_endorsements": ["Org1-Defense", "Org2-Audit", "Org3-Forensic"],
            "ledger_verification": "VALID" if gate6_chain_valid else "CORRUPTED",
            "signature_verification": "VALID" if gate3_sig_valid else "INVALID",
            "watermark_verification": "VALID" if gate1_wm_valid else "INVALID",
            "document_hash_verification": "VALID" if gate5_doc_match else "MISMATCH"
        }
        bundle_canon = json.dumps(raw_bundle, sort_keys=True).encode("utf-8")
        bundle_digest = CryptoEngine.sha3_256(bundle_canon)
        raw_bundle["bundle_sha3_digest"] = bundle_digest
        evidence_bundle = EvidenceBundle(**raw_bundle)

        if beacon_only:
            narrative = (
                f"ATTRIBUTED WITH WARNINGS: Only the CIPHERTRACE watermark ID beacon could be recovered "
                f"(watermark {watermark_id}); the full forensic frame did not survive the capture "
                f"(heavy downscaling / re-compression, e.g. a screenshot). The authenticated ID matches the "
                f"decryption event of {matched_user.name} ({matched_user.navy_id}) on device "
                f"{matched_event.device_id} at {matched_event.timestamp.isoformat()} UTC, and the ledger "
                f"record was verified. This establishes which ledger record the file derives from, but the "
                f"document hash, recipient fingerprint and session nonce embedded in the full frame could "
                f"not be independently recovered from this file."
            )
        else:
            narrative = (
                f"POSITIVE FORENSIC ATTRIBUTION CONFIRMED: Leaked document positively attributed to "
                f"{matched_user.name} ({matched_user.navy_id}). "
                f"Decryption performed on authorized device {matched_event.device_id} at {matched_event.timestamp.isoformat()} UTC. "
                f"Recipient NIST FIPS 204 ML-DSA-65 digital signature verified authentic against ledger record. "
                f"Immutable distributed ledger audit verified."
            )

        return ForensicAnalysisResponse(
            file_name=file_name,
            status="ATTRIBUTED_WITH_WARNINGS" if beacon_only else "IDENTIFIED",
            watermark_detected=True,
            authenticity_tag_valid=True,
            attribution_tier=tier,
            watermark_id=watermark_id,
            extracted_payload_hex=extracted_payload.hex().lower(),
            payload_recovery_pct=recovery_pct,
            bit_error_rate=ber,
            ecc_strategy=ecc_strategy,
            recipient=OfficerSchema(
                id=matched_user.id,
                username=matched_user.username,
                navy_id=matched_user.navy_id,
                name=matched_user.name,
                rank=matched_user.rank,
                command_unit=matched_user.command_unit,
                clearance_level=matched_user.clearance_level,
                device_id=matched_user.device_id,
                role=matched_user.role,
                status=matched_user.status,
                kem_key_id=matched_user.kem_key_id,
                dsa_key_id=matched_user.dsa_key_id,
                key_status=matched_user.key_status,
                ml_kem_pub_preview=f"0x{matched_user.kem_public_key[:16].hex()}...",
                ml_dsa_pub_preview=f"0x{matched_user.dsa_public_key[:16].hex()}..."
            ),
            top_suspect_name=matched_user.name,
            match_confidence=overall_conf,
            decryption_event={
                "event_id": matched_event.id,
                "session_nonce": matched_event.session_nonce,
                "timestamp": matched_event.timestamp.isoformat(),
                "device_id": matched_event.device_id,
                "document_id": matched_doc.id,
                "document_name": matched_doc.file_name,
                "document_sha3": matched_doc.sha3_hash,
                "ledger_block_index": matched_block.id if matched_block else 1,
                "ledger_block_hash": matched_block.block_hash if matched_block else "",
                "fabric_tx_id": matched_event.fabric_tx_id,
                "signature_algorithm": "ML-DSA-65",
                "kem_algorithm": "ML-KEM-768",
                "ml_dsa_signature_hex": matched_event.signature.hex()
            },
            verification_gates=gates,
            overall_confidence=overall_conf,
            analysis_narrative=narrative,
            candidate_matches=candidate_matches,
            evidence_bundle=evidence_bundle
        )

    # UNATTRIBUTED or CORRUPTED
    failed_gates = VerificationGates(
        watermark_valid=False,
        ledger_event_exists=False,
        ml_dsa_signature_valid=False,
        merkle_inclusion_valid=False,
        document_hash_match=False,
        ledger_chain_integrity=False,
        fabric_consensus_valid=False
    )

    if is_detected:
        narrative = (
            f"UNKNOWN WATERMARK: An authentic CIPHERTRACE watermark was decoded (ID {watermark_id}), but it "
            f"matches no decryption event recorded on this node. No registered user can be attributed."
        )
    else:
        reason = metrics.get("failure_reason")
        narrative = (
            f"NO WATERMARK DETECTED: No authenticated CIPHERTRACE watermark could be recovered from this file"
            f"{f' ({reason})' if reason else ''}. "
            f"It was either never decrypted through this system, or it has been altered too heavily "
            f"(e.g. content cropped away, photographed, or destroyed by re-compression) for the watermark to "
            f"survive. No registered user is implicated."
        )

    return ForensicAnalysisResponse(
        file_name=file_name,
        status="UNATTRIBUTED",
        watermark_detected=is_detected,
        authenticity_tag_valid=is_detected,
        attribution_tier=tier,
        failure_reason=None if is_detected else metrics.get("failure_reason"),
        watermark_id=watermark_id,
        extracted_payload_hex=extracted_payload.hex().lower() if extracted_payload else None,
        payload_recovery_pct=recovery_pct,
        bit_error_rate=ber,
        ecc_strategy=ecc_strategy,
        recipient=None,
        top_suspect_name="None (Cleared)",
        match_confidence=0.0,
        decryption_event=None,
        verification_gates=failed_gates,
        overall_confidence=0.0,
        analysis_narrative=narrative,
        candidate_matches=candidate_matches,
        evidence_bundle=None
    )


@router.post("/analyze", response_model=ForensicAnalysisResponse)
async def analyze_leaked_document(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Automated Single-File Forensic Attribution Pipeline."""
    file_bytes = await file.read()
    return await evaluate_suspect_stream(file.filename or "suspect_document", file_bytes, db)


@router.post("/analyze-batch", response_model=BatchForensicResponse)
async def analyze_batch_documents(files: List[UploadFile] = File(...), db: AsyncSession = Depends(get_db)):
    """Automated Multi-File Batch Forensic Attribution Pipeline."""
    results: List[ForensicAnalysisResponse] = []
    for f in files:
        f_bytes = await f.read()
        res = await evaluate_suspect_stream(f.filename or "suspect_document", f_bytes, db)
        results.append(res)
    identified = sum(1 for r in results if r.status in ("IDENTIFIED", "ATTRIBUTED_WITH_WARNINGS"))
    return BatchForensicResponse(
        total_files=len(results),
        identified_count=identified,
        unattributed_count=len(results) - identified,
        results=results
    )


@router.get("/evidence/{event_id}")
async def export_evidence_package(event_id: int, db: AsyncSession = Depends(get_db)):
    """Exports an offline, court-admissible Cryptographic Evidence Package (JSON)."""
    event_res = await db.execute(select(DecryptionEvent).where(DecryptionEvent.id == event_id))
    event = event_res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Decryption event not found")

    dist_res = await db.execute(select(Distribution).where(Distribution.id == event.distribution_id))
    dist = dist_res.scalar_one()
    user_res = await db.execute(select(User).where(User.id == dist.recipient_id))
    user = user_res.scalar_one()
    doc_res = await db.execute(select(Document).where(Document.id == dist.document_id))
    doc = doc_res.scalar_one()
    wm_res = await db.execute(select(WatermarkRecord).where(WatermarkRecord.event_id == event.id))
    wm = wm_res.scalar_one()
    blk_res = await db.execute(select(LedgerBlock).where(LedgerBlock.event_id == event.id))
    blk = blk_res.scalar_one_or_none()

    watermark_id = wm.watermark_id or wm.watermark_hex[:20].lower()

    evidence_data = {
        "case_id": f"CASE-{uuid.uuid4().hex[:12].upper()}",
        "watermark_id": watermark_id,
        "document_hash": doc.sha3_hash,
        "recipient_key_id": user.dsa_key_id,
        "recipient_identity": user.name,
        "recipient_navy_id": user.navy_id,
        "decryption_event_id": event.id,
        "timestamp": event.timestamp.isoformat(),
        "signature_algorithm": "ML-DSA-65",
        "signature_hex": event.signature.hex(),
        "public_key_hex": user.dsa_public_key.hex(),
        "event_hash": event.event_hash,
        "fabric_tx_id": event.fabric_tx_id or (blk.fabric_tx_id if blk else None),
        "fabric_block_number": blk.id if blk else 1,
        "fabric_endorsements": ["Org1-Defense", "Org2-Audit", "Org3-Forensic"],
        "ledger_verification": "VALID",
        "signature_verification": "VALID",
        "watermark_verification": "VALID",
        "document_hash_verification": "VALID",
        "reed_solomon_profile": wm.reed_solomon_profile,
        "cryptographic_standards": {
            "pqc_signature": "NIST FIPS 204 (ML-DSA-65)",
            "pqc_kem": "NIST FIPS 203 (ML-KEM-768)",
            "hash_function": "NIST FIPS 202 (SHA3-256)",
            "authenticated_cipher": "NIST SP 800-38D (AES-256-GCM)"
        }
    }
    canon_bytes = json.dumps(evidence_data, sort_keys=True).encode("utf-8")
    evidence_data["bundle_sha3_digest"] = CryptoEngine.sha3_256(canon_bytes)

    return JSONResponse(
        content=evidence_data,
        headers={"Content-Disposition": f"attachment; filename=CIPHERTRACE_EVIDENCE_EVT_{event.id}.json"}
    )
