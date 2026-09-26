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
  ml_kem_pub_preview: string;
  ml_dsa_pub_preview: string;
}

export interface AuthResult {
  user: UserAccount;
  token: string;
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
  download_url: string;
}

export interface VerificationGates {
  watermark_valid: boolean;
  ledger_event_exists: boolean;
  ml_dsa_signature_valid: boolean;
  merkle_inclusion_valid: boolean;
  document_hash_match: boolean;
  ledger_chain_integrity: boolean;
}

export interface ForensicAnalysisResult {
  status: 'IDENTIFIED' | 'EXTRACTION_FAILED' | 'UNATTRIBUTED' | 'ATTRIBUTED_WITH_WARNINGS';
  watermark_detected: boolean;
  extracted_payload_hex?: string;
  payload_recovery_pct: number;
  bit_error_rate: number;
  ecc_strategy: string;
  recipient?: Officer;
  decryption_event?: {
    event_id: number;
    session_nonce: string;
    timestamp: string;
    device_id: string;
    document_id: number;
    document_name: string;
    document_sha3: string;
    ledger_block_index?: number;
    ledger_block_hash?: string;
    ml_dsa_signature_hex: string;
  };
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

export interface AttackProfile {
  id: string;
  name: string;
  category: string;
  description: string;
  survives: boolean;
}

export interface AttackResult {
  attack_type: string;
  profile_name: string;
  description: string;
  bit_error_rate_observed: number;
  ecc_correction_status: string;
  payload_recovery_pct: number;
  watermark_survived: boolean;
  attribution_confidence: number;
  attribution_verdict: string;
}

export interface SystemHealth {
  status: string;
  system: string;
  version: string;
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
