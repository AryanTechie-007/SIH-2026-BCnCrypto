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

// ── Content Transform & Document Intelligence Types ────────────────────────

export type Support = string[];

export interface SourceBlock {
  id: string;
  type: "heading" | "para" | "list" | "table" | "caption";
  text: string;
  page: number | null;
}

export interface SourceDocument {
  doc_id: string;
  markdown: string;
  blocks: SourceBlock[];
  assets?: unknown[];
  meta: Record<string, unknown>;
}

export interface Claim {
  id: string;
  text: string;
  support: Support;
}

export interface Entity {
  name: string;
  kind: "person" | "organisation" | "product" | "location" | "vulnerability" | "threat_actor" | "other";
  role: string;
}

export interface TimelineItem {
  when: string;
  event: string;
  support: Support;
}

export interface StatItem {
  value: string;
  label: string;
  support: Support;
}

export interface ActionItem {
  text: string;
  support: Support;
}

export interface SourceProfile {
  kind: "news_article" | "government_memo" | "security_advisory" | "press_release" | "research_report" | "opinion" | "internal_document" | "other";
  origin: string | null;
  published: string | null;
  tone: "formal" | "neutral" | "informal" | "technical";
}

export interface AffectedProduct {
  name: string;
  versions: string;
}

export interface IOC {
  kind: "ip" | "domain" | "url" | "hash" | "email" | "file" | "other";
  value: string;
}

export interface SecurityDetails {
  cve_ids: string[];
  affected_products: AffectedProduct[];
  severity: "critical" | "high" | "medium" | "low" | "informational" | null;
  cvss_score: number | null;
  iocs: IOC[];
}

export interface ContentBrief {
  brief_id: string;
  doc_id: string;
  title: string;
  source: SourceProfile;
  tldr: string;
  claims: Claim[];
  entities: Entity[];
  timeline: TimelineItem[];
  stats: StatItem[];
  actions: ActionItem[];
  security: SecurityDetails | null;
}

export interface TransformArtifact {
  filename: string;
  media_type: string;
  text?: string | null;
  parts: string[];
  part_limit?: number | null;
  path?: string | null;
}

export type Verdict = "supported" | "partial" | "unsupported" | "not_factual";

export interface GroundingPassage {
  path: string;
  text: string;
  verdict: Verdict | null;
  items: string[];
  blocks: string[];
  quote?: string | null;
  new_numbers: string[];
  reasons: string[];
  review?: "accepted" | "edited" | "regenerated" | null;
}

export interface GroundingReport {
  passages: GroundingPassage[];
  error?: string | null;
}

export interface FormatResult {
  name: string;
  label?: string;
  format?: string;
  artifacts: TransformArtifact[];
  grounding?: GroundingReport | null;
  warnings: string[];
  error?: string | null;
  usage?: unknown;
}

export interface FormatInfo {
  name: string;
  label: string;
}

export interface TransformStep {
  name: string;
  label: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
}

export interface JobSettings {
  audience: "executive" | "technical" | "general_public" | "media";
  tone: "formal" | "neutral" | "conversational" | "urgent";
  detail_level: "brief" | "standard" | "detailed";
  objective: "inform" | "warn" | "persuade" | "instruct" | "announce";
  style?: string | null;
  brand_kit_id?: string | null;
}

export interface BrandKit {
  kit_id: string;
  name: string;
  primary_colour: string;
  accent_colour: string;
  font: string | null;
  logo: string | null;
  banned_phrases: string[];
}

export interface TransformJobView {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  created_at: string;
  updated_at: string;
  formats: string[];
  config: Record<string, unknown>;
  steps: TransformStep[];
  source: SourceDocument;
  brief: ContentBrief | null;
  brief_usage?: unknown;
  outputs: FormatResult[];
  error?: string | null;
}

export interface TransformJobSummary {
  id: string;
  status: string;
  created_at: string;
  title: string;
  formats: string[];
}

