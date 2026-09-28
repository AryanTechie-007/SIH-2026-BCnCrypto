"""
Pydantic Schemas (Mobile & Web Compatible).

Adapted copy for Port-To-App:
- Includes Device registration, revocation, and token refresh schemas
- Adds consolidated DocumentProvenanceResponse for high-speed mobile timeline rendering
- Preserves all original schemas for 100% backward compatibility
"""

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


class ForensicAnalysisResponse(BaseModel):
    status: str
    watermark_detected: bool
    watermark_id: Optional[str] = None
    watermark_hex: Optional[str] = None
    recipient_id: Optional[int] = None
    recipient_name: Optional[str] = None
    recipient_navy_id: Optional[str] = None
    event_id: Optional[int] = None
    decryption_timestamp: Optional[str] = None
    device_id: Optional[str] = None
    document_id: Optional[int] = None
    document_name: Optional[str] = None
    document_sha3: Optional[str] = None
    signature_valid: bool = False
    ledger_block_index: Optional[int] = None
    ledger_block_hash: Optional[str] = None
    fabric_tx_id: Optional[str] = None
    fabric_block_number: Optional[int] = None
    fabric_committed: bool = False
    verification_gates: VerificationGates
    forensic_confidence: float
    message: str


class EvidenceBundle(BaseModel):
    event_id: int
    watermark_id: str
    watermark_hex: str
    extracted_payload_hex: str
    recipient: Dict[str, Any]
    document: Dict[str, Any]
    crypto_proofs: Dict[str, Any]
    blockchain_receipt: Dict[str, Any]
    verification_gates: Dict[str, bool]
    verdict: str
    timestamp: str


# ── Mobile-Specific Extension Schemas ─────────────────────────────────

class DeviceRegisterRequest(BaseModel):
    device_name: str
    device_type: str = "ANDROID"
    device_fingerprint: str
    push_token: Optional[str] = None


class DeviceRegisterResponse(BaseModel):
    device_id: int
    device_name: str
    device_fingerprint: str
    registered: bool
    status: str
    message: str


class DeviceRevokeRequest(BaseModel):
    device_fingerprint: str


class DeviceRevokeResponse(BaseModel):
    device_fingerprint: str
    revoked: bool
    message: str


class TokenRefreshResponse(BaseModel):
    token: str
    expires_in_minutes: int
    message: str


class ProvenanceDecryptionEventSchema(BaseModel):
    event_id: int
    recipient_id: int
    recipient_name: str
    recipient_navy_id: str
    device_id: str
    timestamp: str
    watermark_id: str
    watermark_hex: str
    signature_algorithm: str
    kem_algorithm: str
    signature_preview: str
    ledger_block_index: int
    ledger_block_hash: str
    fabric_tx_id: Optional[str] = None
    blockchain_confirmed: bool


class DocumentProvenanceResponse(BaseModel):
    document_id: int
    file_name: str
    title: str
    sha3_hash: str
    size_bytes: int
    created_at: str
    total_distributions: int
    distributions: List[Dict[str, Any]]
    decryption_events: List[ProvenanceDecryptionEventSchema]
    total_decryptions: int
    integrity_verified: bool
