export interface User {
  id: string;
  name: string;
  organization: string;
  role: string;
  clearance: string;
  deviceId: string;
  mlKemKeyId: string;
  mlDsaKeyId: string;
  mlKemPublicKey: string; // FIPS 203
  mlDsaPublicKey: string; // FIPS 204
  status: 'ACTIVE' | 'REVOKED' | 'STANDBY';
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  sha3Hash: string;
  classification: string;
  originatingAuthority: string;
  createdAt: string;
  totalPages: number;
}

export interface KeyEnvelope {
  recipientId: string;
  recipientKeyId: string;
  kemCiphertext: string; // ML-KEM-768 encapsulation of DEK
  createdAt: string;
}

export interface DistributionPackage {
  distributionId: string;
  documentId: string;
  documentHash: string;
  encryptedCiphertextPreview: string; // AES-256-GCM
  envelopes: KeyEnvelope[];
  createdAt: string;
}

export interface DecryptionEvent {
  eventId: string;
  documentId: string;
  documentHash: string;
  recipientId: string;
  recipientKeyId: string;
  deviceId: string;
  sessionNonce: string;
  timestamp: string;
  softwareVersion: string;
  watermarkId: string;
  eventHash: string;
  mlDsaSignature: string; // FIPS 204 signature over eventHash
}

export interface LedgerBlock {
  blockIndex: number;
  blockId: string;
  timestamp: string;
  eventId: string;
  documentHash: string;
  watermarkHash: string;
  recipientKeyHash: string;
  eventHash: string;
  recipientSignature: string;
  previousBlockHash: string;
  merkleRoot: string;
  merkleProof?: string[];
  endorsers: string[];
  isTampered?: boolean;
}

export interface ForensicAnalysisResult {
  watermarkDetected: boolean;
  watermarkId: string;
  payloadRecoveryPct: number;
  eccRecoveryStatus: 'PERFECT' | 'RECONSTRUCTED' | 'FAILED';
  channelResults: {
    channelName: string;
    detected: boolean;
    confidence: number;
  }[];
  overallConfidence: number; // 0 - 100
  matchedEvent?: DecryptionEvent;
  matchedRecipient?: User;
  ledgerRecord?: LedgerBlock;
  verificationChecks: {
    watermarkValid: boolean;
    eventExists: boolean;
    mlDsaSignatureValid: boolean;
    merkleProofValid: boolean;
    documentHashMatch: boolean;
    chainIntegrityValid: boolean;
  };
  attributionStatus: 'VERIFIED_ATTRIBUTION' | 'TAMPERED_EVENT' | 'UNREGISTERED_WATERMARK' | 'FAILED';
}

export interface EvidenceBundle {
  bundleId: string;
  exportTimestamp: string;
  documentId: string;
  documentHash: string;
  recoveredWatermark: string;
  eventId: string;
  recipientId: string;
  recipientName: string;
  deviceId: string;
  decryptionTimestamp: string;
  mlDsaSignature: string;
  mlDsaPublicKey: string;
  ledgerBlockId: string;
  merkleRoot: string;
  merkleProof: string[];
  authorityEndorsement: string;
  deterministicStatus: string;
}
