from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str
    navy_id: Optional[str] = None
    rank: Optional[str] = "User"
    command_unit: Optional[str] = "General Workspace"
    clearance_level: Optional[str] = "Confidential"
    device_id: Optional[str] = None
    role: Optional[str] = "RECIPIENT"


class LoginRequest(BaseModel):
    username: str
    password: str


class QuickLoginRequest(BaseModel):
    officer: str


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


class AuthResponse(BaseModel):
    user: UserSchema
    token: str
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


class DecryptionRequest(BaseModel):
    document_id: int
    recipient_id: int
    device_id: Optional[str] = None
    keystore_password: Optional[str] = None


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
    download_url: str


class VerificationGates(BaseModel):
    watermark_valid: bool
    ledger_event_exists: bool
    ml_dsa_signature_valid: bool
    merkle_inclusion_valid: bool
    document_hash_match: bool
    ledger_chain_integrity: bool
    fabric_consensus_valid: Optional[bool] = None


class CandidateMatch(BaseModel):
    officer_id: int
    navy_id: str
    name: str
    rank: str
    command_unit: str
    device_id: str
    confidence: float
    match_type: str  # "CONFIRMED_MATCH", "PROBABILISTIC", "LOW_CORRELATION", "CLEARED"
    event_id: Optional[int] = None
    document_name: Optional[str] = None


class EvidenceBundle(BaseModel):
    case_id: str
    watermark_id: str
    document_hash: str
    recipient_key_id: str
    recipient_identity: str
    recipient_navy_id: str
    decryption_event_id: int
    timestamp: str
    signature_algorithm: str
    signature_hex: str
    public_key_hex: str
    event_hash: str
    fabric_tx_id: Optional[str] = None
    fabric_block_number: Optional[int] = None
    fabric_endorsements: Optional[List[str]] = None
    ledger_verification: str
    signature_verification: str
    watermark_verification: str
    document_hash_verification: str
    bundle_sha3_digest: str


class ForensicAnalysisResponse(BaseModel):
    file_name: Optional[str] = "suspect_document"
    status: str  # "IDENTIFIED", "ATTRIBUTED_WITH_WARNINGS", "UNATTRIBUTED", "EXTRACTION_FAILED"
    watermark_detected: bool
    watermark_id: Optional[str] = None
    extracted_payload_hex: Optional[str] = None
    payload_recovery_pct: float
    bit_error_rate: float
    ecc_strategy: str
    recipient: Optional[OfficerSchema] = None
    top_suspect_name: Optional[str] = None
    match_confidence: float = 0.0
    decryption_event: Optional[Dict[str, Any]] = None
    verification_gates: VerificationGates
    overall_confidence: float
    analysis_narrative: str
    candidate_matches: Optional[List[CandidateMatch]] = None
    evidence_bundle: Optional[EvidenceBundle] = None


class BatchForensicResponse(BaseModel):
    total_files: int
    identified_count: int
    unattributed_count: int
    results: List[ForensicAnalysisResponse]


class VaultExportRequest(BaseModel):
    passphrase: str


class VaultImportRequest(BaseModel):
    passphrase: str
