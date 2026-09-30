from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class UserSchema(BaseModel):
    id: int
    username: str
    name: str
    navy_id: str
    rank: str
    command_unit: str
    clearance_level: str
    device_id: str
    role: str
    status: str
    kem_key_id: str
    dsa_key_id: str
    key_status: str
    ml_kem_pub_preview: str
    ml_dsa_pub_preview: str
    fabric_msp_id: Optional[str] = None
    # SHA-256 of each public key; the same values the keyregistry chaincode stores.
    kem_key_fingerprint: str = ""
    dsa_key_fingerprint: str = ""
    keystore_file: Optional[str] = None


class CertificateInfo(BaseModel):
    common_name: str
    role: str
    issuer: str
    expires_at: str


class LedgerIdentityStatus(BaseModel):
    certificate: Optional[CertificateInfo] = None
    # REGISTERED, NOT_REGISTERED, MISMATCH (ledger keys differ from this device's), UNAVAILABLE
    key_registry_status: str
    registered_at: Optional[str] = None
    detail: Optional[str] = None


class AuthResponse(BaseModel):
    user: UserSchema
    message: str


class OfficerSchema(BaseModel):
    id: int
    username: Optional[str] = None
    navy_id: str
    name: str
    rank: str
    command_unit: str
    clearance_level: str
    device_id: str
    role: str
    status: str
    kem_key_id: str
    dsa_key_id: str
    key_status: str
    ml_kem_pub_preview: str
    ml_dsa_pub_preview: str


class DocumentSchema(BaseModel):
    id: int
    file_name: str
    title: str
    sha3_hash: str
    size_bytes: int
    created_at: str


class DistributeRequest(BaseModel):
    document_id: int
    recipient_ids: Optional[List[int]] = None


class KeyEnvelopeInfo(BaseModel):
    recipient_id: int
    recipient_navy_id: str
    recipient_name: str
    kem_algorithm: str
    kem_ciphertext_preview: str


class DistributionResponse(BaseModel):
    document_id: int
    document_name: str
    document_sha3: str
    total_envelopes: int
    envelopes: List[KeyEnvelopeInfo]
    envelope_file_name: str


class DecryptionResponse(BaseModel):
    event_id: int
    document_id: int
    recipient_name: str
    recipient_navy_id: str
    session_nonce: str
    timestamp: str
    watermark_id: str
    watermark_hex: str
    signature_algorithm: str = "ML-DSA-65"
    kem_algorithm: str = "ML-KEM-768"
    ml_dsa_signature_preview: str
    ledger_block_index: int
    ledger_block_hash: str
    fabric_tx_id: Optional[str] = None


class VerificationGates(BaseModel):
    watermark_valid: bool          # a watermark was decoded and its ID exactly matches a ledger record
    ledger_event_exists: bool      # the forensic chaincode holds a decryption record for it
    ml_dsa_signature_valid: bool   # the recipient's ML-DSA-65 signature over that record verifies
    key_registry_match: bool       # the signing key is the one the key registry holds for the recipient
    document_hash_match: bool      # the file is byte-identical to the released copy (fails for re-saved copies)


class ForensicAnalysisResponse(BaseModel):
    file_name: Optional[str] = "suspect_document"
    status: str  # "IDENTIFIED", "ATTRIBUTED_WITH_WARNINGS", "UNATTRIBUTED"
    watermark_detected: bool
    watermark_id: Optional[str] = None
    extracted_payload_hex: Optional[str] = None
    payload_recovery_pct: float
    bit_error_rate: float
    ecc_strategy: str
    recipient: Optional[OfficerSchema] = None
    top_suspect_name: Optional[str] = None
    match_confidence: float = 0.0
    ledger_record: Optional[Dict[str, Any]] = None  # the decryption record exactly as stored on the ledger
    verification_gates: VerificationGates
    overall_confidence: float
    analysis_narrative: str
