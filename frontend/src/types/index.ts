export interface Officer {
  id: number;
  username?: string;
  navy_id: string;
  name: string;
  rank: string;
  command_unit: string;
  clearance_level: string;
  device_id: string;
  status: string;
  ml_kem_pub_preview: string;
  ml_dsa_pub_preview: string;
}

export interface UserAccount {
  id: number;
  username: string;
  name: string;
  navy_id: string;
  rank: string;
  command_unit: string;
  clearance_level: string;
  device_id: string;
  status: string;
  role?: string;
  ml_kem_pub_preview: string;
  ml_dsa_pub_preview: string;
  fabric_msp_id?: string;
  kem_key_fingerprint?: string;
  dsa_key_fingerprint?: string;
  keystore_file?: string | null;
}

export interface LedgerIdentityStatus {
  certificate?: {
    common_name: string;
    role: string;
    issuer: string;
    expires_at: string;
  } | null;
  key_registry_status: 'REGISTERED' | 'NOT_REGISTERED' | 'MISMATCH' | 'UNAVAILABLE';
  registered_at?: string | null;
  detail?: string | null;
}

export interface AuthResult {
  user: UserAccount;
  message: string;
}

export interface DocumentRecord {
  id: number;
  file_name: string;
  title: string;
  sha3_hash: string;
  size_bytes: number;
  created_at: string;
}

export interface KeyEnvelopeInfo {
  recipient_id: number;
  recipient_navy_id: string;
  recipient_name: string;
  kem_algorithm: string;
  kem_ciphertext_preview: string;
}

export interface DistributionResult {
  document_id: number;
  document_name: string;
  document_sha3: string;
  total_envelopes: number;
  envelopes: KeyEnvelopeInfo[];
  envelope_file_name: string;
}

export interface DecryptionResult {
  event_id: number;
  document_id: number;
  recipient_name: string;
  recipient_navy_id: string;
  session_nonce: string;
  timestamp: string;
  watermark_id: string;
  watermark_hex: string;
  ml_dsa_signature_preview: string;
  ledger_block_index: number;
  ledger_block_hash: string;
}

export interface VerificationGates {
  watermark_valid: boolean;
  ledger_event_exists: boolean;
  ml_dsa_signature_valid: boolean;
  key_registry_match: boolean;
  document_hash_match: boolean;
}

export interface ForensicAnalysisResult {
  status: 'IDENTIFIED' | 'UNATTRIBUTED' | 'ATTRIBUTED_WITH_WARNINGS';
  watermark_detected: boolean;
  watermark_id?: string | null;
  match_type?: 'EXACT' | 'CLOSEST' | null;
  extracted_payload_hex?: string;
  payload_recovery_pct: number;
  bit_error_rate: number;
  ecc_strategy: string;
  recipient?: Officer;
  /** The decryption record exactly as stored on the ledger. */
  ledger_record?: Record<string, string> | null;
  verification_gates: VerificationGates;
  overall_confidence: number;
  match_confidence?: number;
  analysis_narrative: string;
}

export interface LedgerBlock {
  block_index: number;
  block_hash: string;
  prev_block_hash: string;
  merkle_root: string;
  timestamp: string;
  data: string;
  endorsers: string[];
  is_tampered: boolean;
}

export interface SystemHealth {
  status: string;
  system: string;
  version: string;
  server_boot_id?: string;
  timestamp: string;
  cryptographic_suite: {
    kem: string;
    signature: string;
    symmetric: string;
    hashing: string;
    ecc: string;
  };
  consensus_endorsers: string[];
  air_gap_mode: boolean;
}
