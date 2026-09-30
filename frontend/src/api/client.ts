import {
  Officer,
  DocumentRecord,
  DistributionResult,
  DecryptionResult,
  ForensicAnalysisResult,
  LedgerBlock,
  SystemHealth,
  UserAccount,
  AuthResult,
  LedgerIdentityStatus
} from '../types';

/**
 * The desktop app's bridge (desktop/preload.js). Every call goes to the Python
 * worker in the Electron main process; there is no HTTP server.
 */
type WorkerReply =
  | { ok: true; result: unknown; canceled?: boolean }
  | { ok: false; status: number; detail: unknown };

/** Where cli.js connects. `saved` is null when the defaults are in use. */
export interface LedgerConnection {
  saved: { host: string; port: number | null } | null;
  peers: { org1: string; org2: string };
  defaults: { host: string; org1Port: number; org2Port: number };
}

interface CipherTraceBridge {
  call(method: string, params?: Record<string, unknown>): Promise<WorkerReply>;
  saveAs(method: string, params: Record<string, unknown>, suggestedName: string): Promise<WorkerReply>;
  pathOf(file: File): string;
  getLedgerConnection(): Promise<LedgerConnection>;
  setLedgerConnection(value: { host: string; port: number | null } | null): Promise<WorkerReply>;
}

declare global {
  interface Window {
    ciphertrace?: CipherTraceBridge;
  }
}

function bridge(): CipherTraceBridge {
  if (!window.ciphertrace) {
    throw new Error('CIPHERTRACE runs inside its desktop app. Start it with `npm start` in desktop/.');
  }
  return window.ciphertrace;
}

/**
 * Thrown by ledgerLogin once the bundle is verified but a passphrase is still needed:
 * 'unlock' when this device has the user's keystore, 'create' when it has none yet.
 */
export class PassphraseNeededError extends Error {
  constructor(public mode: 'unlock' | 'create', message: string) {
    super(message);
  }
}

function detailText(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: unknown }).message);
  return JSON.stringify(detail);
}

async function call<T>(method: string, params: Record<string, unknown>, context: string): Promise<T> {
  const reply = await bridge().call(method, params);
  if (!reply.ok) {
    throw new Error(`[${context}] ${detailText(reply.detail)}`);
  }
  return reply.result as T;
}

/** Asks where to save, then has the worker write the file there. Resolves quietly if the user cancels. */
async function saveAs(method: string, params: Record<string, unknown>, suggestedName: string, context: string): Promise<void> {
  const reply = await bridge().saveAs(method, params, suggestedName);
  if (!reply.ok) {
    throw new Error(`[${context}] ${detailText(reply.detail)}`);
  }
}

/** The file's location on disk; the worker reads it from there. */
function pathOf(file: File, context: string): string {
  const path = bridge().pathOf(file);
  if (!path) {
    throw new Error(`[${context}] ${file.name} is not a file on disk`);
  }
  return path;
}

export const ApiClient = {
  async getHealth(): Promise<SystemHealth> {
    try {
      return await call<SystemHealth>('system.health', {}, 'HEALTH_CHECK');
    } catch (err: any) {
      throw new Error(`SYSTEM OFFLINE: Unable to reach CIPHERTRACE Core (${err.message})`);
    }
  },

  async getOfficers(): Promise<Officer[]> {
    return call<Officer[]>('identity.officers', {}, 'FETCH_OFFICERS');
  },

  async getDocuments(): Promise<DocumentRecord[]> {
    return call<DocumentRecord[]>('documents.list', {}, 'FETCH_DOCUMENTS');
  },

  async uploadDocument(file: File): Promise<DocumentRecord> {
    return call<DocumentRecord>('documents.upload', { path: pathOf(file, 'UPLOAD_DOCUMENT') }, 'UPLOAD_DOCUMENT');
  },

  async distributeDocument(documentId: number, recipientIds?: number[]): Promise<DistributionResult> {
    return call<DistributionResult>('documents.distribute', {
      document_id: documentId,
      ...(recipientIds && recipientIds.length > 0 ? { recipient_ids: recipientIds } : {})
    }, 'DISTRIBUTE_DOCUMENT');
  },

  /**
   * Signs in with a ledger identity bundle and keystore passphrase. Called without a
   * passphrase it only verifies the bundle, then throws PassphraseNeededError saying
   * whether to ask for the existing passphrase or a new one (sent with passphraseConfirm).
   */
  async ledgerLogin(username: string, bundle: File, passphrase?: string, passphraseConfirm?: string): Promise<AuthResult> {
    const reply = await bridge().call('auth.ledger_login', {
      username,
      bundle_file: pathOf(bundle, 'LEDGER_LOGIN'),
      ...(passphrase ? { passphrase } : {}),
      ...(passphraseConfirm !== undefined ? { passphrase_confirm: passphraseConfirm } : {})
    });
    if (reply.ok) {
      return reply.result as AuthResult;
    }
    if (reply.status === 428) {
      const detail = (reply.detail || {}) as { code?: string; message?: string };
      throw new PassphraseNeededError(
        detail.code === 'PASSPHRASE_REQUIRED' ? 'unlock' : 'create',
        detail.message || 'Enter your keystore passphrase.'
      );
    }
    throw new Error(`[LEDGER_LOGIN] ${detailText(reply.detail)}`);
  },

  /** Ends the session: the worker forgets its keystore passphrase. */
  async logout(): Promise<void> {
    await call('auth.logout', {}, 'LOGOUT');
  },

  async getCurrentUser(): Promise<UserAccount> {
    return call<UserAccount>('auth.me', {}, 'FETCH_CURRENT_USER');
  },

  async getLedgerIdentity(): Promise<LedgerIdentityStatus> {
    return call<LedgerIdentityStatus>('auth.me_ledger', {}, 'FETCH_LEDGER_IDENTITY');
  },

  // Decryption unlocks the keystore with the passphrase given at sign-in (held by the worker's session).
  async decryptEnvelopeFile(file: File, recipientId: number, deviceId?: string): Promise<DecryptionResult> {
    return call<DecryptionResult>('decryption.decrypt_envelope', {
      path: pathOf(file, 'DECRYPT_ENVELOPE_FILE'),
      recipient_id: recipientId,
      ...(deviceId ? { device_id: deviceId } : {})
    }, 'DECRYPT_ENVELOPE_FILE');
  },

  async downloadWatermarkedPdf(eventId: number, fileName: string): Promise<void> {
    await saveAs('decryption.save_copy', { event_id: eventId }, fileName, 'SAVE_WATERMARKED_COPY');
  },

  async downloadEnvelope(documentId: number, fileName: string): Promise<void> {
    await saveAs('documents.save_envelope', { document_id: documentId }, fileName, 'SAVE_ENVELOPE');
  },

  async analyzeLeakedDocument(file: File): Promise<ForensicAnalysisResult> {
    return call<ForensicAnalysisResult>('forensics.analyze', { path: pathOf(file, 'FORENSIC_ANALYSIS') }, 'FORENSIC_ANALYSIS');
  },

  /** Evidence for one decryption record, read from the ledger and re-verified. */
  async downloadEvidencePackage(watermarkId: string): Promise<void> {
    await saveAs('forensics.save_evidence', { watermark_id: watermarkId }, `CIPHERTRACE_EVIDENCE_${watermarkId}.json`, 'EXPORT_EVIDENCE');
  },

  async getLedgerConnection(): Promise<LedgerConnection> {
    return bridge().getLedgerConnection();
  },

  /** Saves the ledger host and port (null port: each org's default), or null to reset. Restarts the worker. */
  async setLedgerConnection(value: { host: string; port: number | null } | null): Promise<LedgerConnection> {
    const reply = await bridge().setLedgerConnection(value);
    if (!reply.ok) {
      throw new Error(detailText(reply.detail));
    }
    return reply.result as LedgerConnection;
  },

  async getLedgerBlocks(): Promise<LedgerBlock[]> {
    return call<LedgerBlock[]>('ledger.blocks', {}, 'FETCH_LEDGER_BLOCKS');
  }
};
