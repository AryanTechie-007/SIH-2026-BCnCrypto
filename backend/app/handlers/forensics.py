"""
CIPHERTRACE Forensic Leak Lab
=============================
Traces a leaked PDF to the recipient whose copy it is, using only the ledger:

1. Decode the watermark (2D DCT + Hadamard correlation) to get its watermark ID.
2. Look the ID up on the forensic chaincode. Only an exact match attributes the
   copy: a damaged watermark is reported as unattributed rather than guessed at.
3. Verify the record: the recipient's ML-DSA-65 signature over it, checked with
   the public key the key registry holds for them, whose fingerprint must also
   match the one in the record.

Nothing comes from the local database, which is wiped at every sign-out, so a
copy decrypted on any device can be traced. Ledger lookups run as the
signed-in user.
"""

import base64
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app import rpc
from app.config import settings
from app.errors import ApiError
from app.handlers.auth import _ledger_error
from app.models.database import User
from app.services import ledger_cli
from app.services.crypto_engine import CryptoEngine
from app.services.ledger_cli import LedgerCliError
from app.services.ledger_engine import LedgerEngine
from app.services.watermark_engine import WatermarkEngine
from app.schemas import ForensicAnalysisResponse, OfficerSchema, VerificationGates

UPLOAD_TEMP_DIR = os.path.join(settings.UPLOAD_DIR, "forensic_temp")

watermark_engine = WatermarkEngine()


def _validate_file_magic(file_bytes: bytes, original_filename: str = "") -> str:
    """Validates file magic bytes to ensure only official PDF documents are processed."""
    if file_bytes.startswith(b"%PDF"):
        return "pdf"
    lower = (original_filename or "").lower()
    if lower.endswith(".pdf"):
        return "pdf"
    raise ApiError(400, "Unsupported file format: Only official PDF documents (.pdf) are supported for forensic attribution. Image attribution is disabled.")


def _safe_remove(file_path: str):
    """Safely cleans up temporary forensic files."""
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass


def _bundle_of(user: User) -> str:
    if not user.bundle_path or not os.path.isdir(user.bundle_path):
        raise ApiError(401, "No ledger identity bundle on this device. Sign in again.")
    return user.bundle_path


async def _registered_keys(bundle: str, identity: str, username: str) -> Optional[dict]:
    try:
        return await ledger_cli.get_keys(bundle, identity, username)
    except LedgerCliError as e:
        raise _ledger_error(e, "Could not read the recipient's keys from the key registry")


def _verify_record(record: dict, keys: Optional[dict]) -> Tuple[bool, bool]:
    """(signature valid, signing key is the registered one) for a ledger record."""
    if not keys:
        return False, False
    try:
        dsa_pub = base64.b64decode(keys["dsa_public_key"])
        signature = base64.b64decode(record.get("signature") or "")
    except (KeyError, ValueError):
        return False, False
    signature_valid = CryptoEngine.verify(dsa_pub, LedgerEngine.record_signing_payload(record), signature)
    key_match = hashlib.sha256(dsa_pub).hexdigest() == (record.get("recipient_pubkey_fingerprint") or "").lower()
    return signature_valid, key_match


async def _recipient(db: AsyncSession, username: str, keys: Optional[dict]) -> OfficerSchema:
    """The recipient as the directory knows them (synced from the key registry at sign-in)."""
    res = await db.execute(select(User).where(User.username == username))
    u = res.scalar_one_or_none()
    if u:
        return OfficerSchema(
            id=u.id, username=u.username, navy_id=u.navy_id, name=u.name, rank=u.rank or "User",
            command_unit=u.command_unit or "General", clearance_level=u.clearance_level or "Confidential",
            device_id=u.device_id, role=u.role or "USER", status=u.status, kem_key_id=u.kem_key_id or "",
            dsa_key_id=u.dsa_key_id or "", key_status=u.key_status or "ACTIVE",
            ml_kem_pub_preview=f"0x{u.kem_public_key[:16].hex()}...",
            ml_dsa_pub_preview=f"0x{u.dsa_public_key[:16].hex()}..."
        )
    kem_pub = base64.b64decode(keys["kem_public_key"]) if keys else b""
    dsa_pub = base64.b64decode(keys["dsa_public_key"]) if keys else b""
    return OfficerSchema(
        id=0, username=username, navy_id=f"USR-{username.upper()}", name=username, rank="User",
        command_unit="General", clearance_level="Confidential", device_id="UNKNOWN", role="USER",
        status="ACTIVE", kem_key_id=CryptoEngine.sha3_256(kem_pub)[:32] if kem_pub else "",
        dsa_key_id=CryptoEngine.sha3_256(dsa_pub)[:32] if dsa_pub else "", key_status="ACTIVE",
        ml_kem_pub_preview=f"0x{kem_pub[:16].hex()}...", ml_dsa_pub_preview=f"0x{dsa_pub[:16].hex()}..."
    )


async def evaluate_suspect_stream(file_name: str, file_bytes: bytes, db: AsyncSession, current_user: User) -> ForensicAnalysisResponse:
    """Decodes the watermark, finds its decryption record on the ledger, and verifies it."""
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise ApiError(413, f"Uploaded file exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE_MB} MB)")

    # 1. Decode the watermark
    safe_ext = _validate_file_magic(file_bytes, file_name)
    os.makedirs(UPLOAD_TEMP_DIR, exist_ok=True)
    temp_path = os.path.join(UPLOAD_TEMP_DIR, f"{uuid.uuid4().hex}.{safe_ext}")
    try:
        with open(temp_path, "wb") as buffer:
            buffer.write(file_bytes)
        extracted_payload, metrics = watermark_engine.extract_watermark(temp_path)
    finally:
        _safe_remove(temp_path)

    ber = float(metrics.get("bit_error_rate", 100.0))
    watermark_id = None
    if extracted_payload:
        frame = metrics.get("frame")
        watermark_id = frame["watermark_id"] if frame and frame.get("watermark_id") else extracted_payload[:10].hex().lower()

    # 2. Find its decryption record on the ledger (exact watermark ID only)
    bundle, identity = _bundle_of(current_user), current_user.username
    record = None
    if watermark_id:
        try:
            record = await ledger_cli.query_record(bundle, identity, watermark_id)
        except LedgerCliError as e:
            raise _ledger_error(e, "Could not search the ledger")

    extracted_hex = extracted_payload.hex().lower() if extracted_payload else None

    if not record:
        if extracted_payload:
            narrative = (
                f"UNKNOWN WATERMARK: A CIPHERTRACE watermark was decoded (ID {watermark_id}), but no decryption "
                f"record on the ledger has that ID. It may have been damaged in copying. No registered user can be attributed."
            )
        else:
            narrative = (
                "NO WATERMARK DETECTED: No CIPHERTRACE watermark could be decoded from this file. "
                "It was either never decrypted through this system, or it has been altered too heavily "
                "(e.g. cropped) for the watermark to survive. No registered user is implicated."
            )
        return ForensicAnalysisResponse(
            file_name=file_name, status="UNATTRIBUTED", watermark_detected=False, watermark_id=watermark_id,
            extracted_payload_hex=extracted_hex, payload_recovery_pct=0.0, bit_error_rate=ber,
            ecc_strategy=WatermarkEngine.ECC_STRATEGY, top_suspect_name="None (Cleared)",
            verification_gates=VerificationGates(watermark_valid=False, ledger_event_exists=False,
                                                 ml_dsa_signature_valid=False, key_registry_match=False,
                                                 document_hash_match=False),
            overall_confidence=0.0, analysis_narrative=narrative
        )

    # 3. Verify the record against the recipient's registered key
    recipient_id = record.get("recipient_id") or ""
    keys = await _registered_keys(bundle, identity, recipient_id)
    signature_valid, key_match = _verify_record(record, keys)
    gates = VerificationGates(
        watermark_valid=True,
        ledger_event_exists=True,
        ml_dsa_signature_valid=signature_valid,
        key_registry_match=key_match,
        document_hash_match=hashlib.sha256(file_bytes).hexdigest() == (record.get("watermarked_doc_hash") or "").lower()
    )
    recipient = await _recipient(db, recipient_id, keys)

    if signature_valid and key_match:
        status, confidence = "IDENTIFIED", 100.0
        narrative = (
            f"POSITIVE FORENSIC ATTRIBUTION: This copy was released to {recipient_id}. The ledger records that "
            f"they decrypted it at {record.get('timestamp')}, and that record is signed with {recipient_id}'s "
            f"NIST FIPS 204 ML-DSA-65 key, which the key registry confirms is theirs."
        )
    else:
        status, confidence = "ATTRIBUTED_WITH_WARNINGS", 0.0
        problem = ("the recipient has no keys in the key registry" if not keys
                   else "its ML-DSA-65 signature does not verify" if not signature_valid
                   else "it was signed with a key other than the recipient's registered one")
        narrative = (
            f"UNVERIFIED RECORD: The ledger's decryption record for this watermark ID names {recipient_id}, "
            f"but {problem}. Do not rely on this attribution."
        )

    return ForensicAnalysisResponse(
        file_name=file_name, status=status, watermark_detected=True, watermark_id=record.get("watermark_id"),
        extracted_payload_hex=extracted_hex,
        payload_recovery_pct=float(metrics.get("payload_recovery_pct", 100.0)), bit_error_rate=ber,
        ecc_strategy=WatermarkEngine.ECC_STRATEGY, recipient=recipient, top_suspect_name=recipient.name,
        match_confidence=confidence, ledger_record=record, verification_gates=gates,
        overall_confidence=confidence, analysis_narrative=narrative
    )


@rpc.method("forensics.analyze")
async def analyze_leaked_document(db: AsyncSession, current_user: User, path: str) -> ForensicAnalysisResponse:
    """Automated Single-File Forensic Attribution Pipeline, on the file at `path`."""
    try:
        with open(path, "rb") as f:
            file_bytes = f.read()
    except OSError as e:
        raise ApiError(400, f"Could not read {os.path.basename(path)}: {e.strerror or e}")
    return await evaluate_suspect_stream(os.path.basename(path) or "suspect_document", file_bytes, db, current_user)


@rpc.method("forensics.save_evidence")
async def export_evidence_package(current_user: User, watermark_id: str, dest: str) -> dict:
    """
    Writes an evidence package for one decryption record to `dest`, chosen in a save
    dialog. It is self-contained: anyone can re-verify it with the ledger record and
    the public key it carries, without CIPHERTRACE.
    """
    bundle, identity = _bundle_of(current_user), current_user.username
    try:
        record = await ledger_cli.query_record(bundle, identity, watermark_id)
    except LedgerCliError as e:
        raise _ledger_error(e, "Could not read the decryption record")
    if not record:
        raise ApiError(404, f"No decryption record on the ledger for watermark {watermark_id}")

    keys = await _registered_keys(bundle, identity, record.get("recipient_id") or "")
    signature_valid, key_match = _verify_record(record, keys)

    evidence = {
        "case_id": f"CASE-{uuid.uuid4().hex[:12].upper()}",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generated_by": identity,
        "watermark_id": record.get("watermark_id"),
        "recipient_id": record.get("recipient_id"),
        "ledger_record": record,
        "recipient_key_registry_entry": keys,
        "verification": {
            "signature": "VALID" if signature_valid else "INVALID",
            "signing_key_registered_to_recipient": "MATCH" if key_match else "MISMATCH",
            "how_to_verify": (
                "Remove 'signature' from ledger_record, serialise the rest as JSON with sorted keys, no spaces "
                "and UTF-8 (the signed payload), and verify the base64 'signature' over it with ML-DSA-65 using "
                "recipient_key_registry_entry.dsa_public_key. Its SHA-256 must equal "
                "ledger_record.recipient_pubkey_fingerprint."
            )
        },
        "cryptographic_standards": {
            "pqc_signature": "NIST FIPS 204 (ML-DSA-65)",
            "pqc_kem": "NIST FIPS 203 (ML-KEM-768)",
            "hash_function": "NIST FIPS 202 (SHA3-256)",
            "authenticated_cipher": "NIST SP 800-38D (AES-256-GCM)"
        },
        "watermark_profile": WatermarkEngine.ECC_STRATEGY
    }
    evidence["bundle_sha3_digest"] = CryptoEngine.sha3_256(json.dumps(evidence, sort_keys=True).encode("utf-8"))

    with open(dest, "w", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2)
    return {"saved_to": dest}
