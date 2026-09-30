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

const API_ROOT = (typeof window !== 'undefined' && window.location.port === '5173')
  ? '/api'
  : (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? `http://${window.location.hostname}:8000/api`
    : 'http://127.0.0.1:8000/api';

/**
 * Thrown by ledgerLogin once the bundle is verified but a passphrase is still needed:
 * 'unlock' when this device has the user's keystore, 'create' when it has none yet.
 */
export class PassphraseNeededError extends Error {
  constructor(public mode: 'unlock' | 'create', message: string) {
    super(message);
  }
}

async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  const isAuth = url.includes('/auth/');
  // Ledger calls wait on Fabric; sign-in may also generate post-quantum keys.
  const isHeavyCompute = url.includes('/decryption/') || url.includes('/forensics/')
    || url.includes('/auth/ledger-login') || url.includes('/auth/me/ledger');
  const timeoutMs = options?.signal ? 0 : (isAuth ? 8000 : (isHeavyCompute ? 180000 : 30000));

  const executeFetch = async (targetUrl: string, timeout: number): Promise<Response> => {
    const controller = new AbortController();
    const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
    const token = typeof window !== 'undefined'
      ? sessionStorage.getItem('ciphertrace_operator_token')
      : null;
    const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        ...authHeaders,
        ...(options?.headers || {})
      },
      signal: options?.signal || controller.signal
    };
    try {
      const res = await fetch(targetUrl, fetchOptions);
      if (timer) clearTimeout(timer);
      return res;
    } catch (err) {
      if (timer) clearTimeout(timer);
      throw err;
    }
  };

  try {
    return await executeFetch(url, timeoutMs);
  } catch (err: any) {
    // If relative proxy /api failed, retry direct backend port 8000 with fresh controller
    if (url.startsWith('/api')) {
      try {
        const fallbackUrl = `http://127.0.0.1:8000${url}`;
        return await executeFetch(fallbackUrl, isHeavyCompute ? 180000 : 6000);
      } catch {
        // Fall through to error
      }
    }
    if (err.name === 'AbortError') {
      throw new Error(`Connection to CIPHERTRACE core timed out (${timeoutMs / 1000}s). Verify the FastAPI backend is running on port 8000.`);
    }
    if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.name === 'TypeError')) {
      throw new Error(`Cannot reach CIPHERTRACE Core at ${url}. Please ensure the FastAPI backend is running on port 8000.`);
    }
    throw err;
  }
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      // Non-JSON response
    }
    throw new Error(`[${context}] ${errorDetail}`);
  }
  return res.json() as Promise<T>;
}

export const ApiClient = {
  async getHealth(): Promise<SystemHealth> {
    try {
      const res = await safeFetch(`${API_ROOT}/system/health`, { signal: AbortSignal.timeout(2000) });
      return await handleResponse<SystemHealth>(res, 'HEALTH_CHECK');
    } catch (err: any) {
      throw new Error(`SYSTEM OFFLINE: Unable to reach CIPHERTRACE Core (${err.message})`);
    }
  },

  async getOfficers(): Promise<Officer[]> {
    const res = await safeFetch(`${API_ROOT}/identity/officers`);
    return handleResponse<Officer[]>(res, 'FETCH_OFFICERS');
  },

  async getDocuments(): Promise<DocumentRecord[]> {
    const res = await safeFetch(`${API_ROOT}/documents`);
    return handleResponse<DocumentRecord[]>(res, 'FETCH_DOCUMENTS');
  },

  async uploadDocument(file: File): Promise<DocumentRecord> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await safeFetch(`${API_ROOT}/documents/upload`, {
      method: 'POST',
      body: formData
    });
    return handleResponse<DocumentRecord>(res, 'UPLOAD_DOCUMENT');
  },

  async distributeDocument(documentId: number, recipientIds?: number[]): Promise<DistributionResult> {
    const res = await safeFetch(`${API_ROOT}/documents/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: documentId,
        ...(recipientIds && recipientIds.length > 0 ? { recipient_ids: recipientIds } : {})
      })
    });
    return handleResponse<DistributionResult>(res, 'DISTRIBUTE_DOCUMENT');
  },

  /**
   * Signs in with a ledger identity bundle and keystore passphrase. Called without a
   * passphrase it only verifies the bundle, then throws PassphraseNeededError saying
   * whether to ask for the existing passphrase or a new one (sent with passphraseConfirm).
   */
  async ledgerLogin(username: string, bundle: File, passphrase?: string, passphraseConfirm?: string): Promise<AuthResult> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('bundle', bundle);
    if (passphrase) formData.append('passphrase', passphrase);
    if (passphraseConfirm !== undefined) formData.append('passphrase_confirm', passphraseConfirm);
    const res = await safeFetch(`${API_ROOT}/auth/ledger-login`, {
      method: 'POST',
      body: formData
    });
    if (res.status === 428) {
      const body = await res.json().catch(() => ({}));
      const detail = body.detail || {};
      throw new PassphraseNeededError(
        detail.code === 'PASSPHRASE_REQUIRED' ? 'unlock' : 'create',
        detail.message || 'Enter your keystore passphrase.'
      );
    }
    return handleResponse<AuthResult>(res, 'LEDGER_LOGIN');
  },

  /** Ends the session on the backend, which forgets its keystore passphrase. */
  async logout(): Promise<void> {
    await safeFetch(`${API_ROOT}/auth/logout`, { method: 'POST' });
  },

  async getCurrentUser(userId?: number): Promise<UserAccount> {
    const url = userId ? `${API_ROOT}/auth/me?user_id=${userId}` : `${API_ROOT}/auth/me`;
    const res = await safeFetch(url);
    return handleResponse<UserAccount>(res, 'FETCH_CURRENT_USER');
  },

  async getLedgerIdentity(): Promise<LedgerIdentityStatus> {
    const res = await safeFetch(`${API_ROOT}/auth/me/ledger`);
    return handleResponse<LedgerIdentityStatus>(res, 'FETCH_LEDGER_IDENTITY');
  },

  // Decryption unlocks the keystore with the passphrase given at sign-in (held by the backend session).
  async decryptEnvelopeFile(file: File, recipientId: number, deviceId?: string): Promise<DecryptionResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('recipient_id', recipientId.toString());
    if (deviceId) formData.append('device_id', deviceId);

    const res = await safeFetch(`${API_ROOT}/decryption/decrypt-envelope`, {
      method: 'POST',
      body: formData
    });
    return handleResponse<DecryptionResult>(res, 'DECRYPT_ENVELOPE_FILE');
  },

  async downloadWatermarkedPdf(eventId: number, fileName: string): Promise<void> {
    const res = await safeFetch(`${API_ROOT}/decryption/download/${eventId}`);
    if (!res.ok) {
      throw new Error(`Failed to download watermarked document: HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async downloadEnvelope(documentId: number, fileName: string): Promise<void> {
    const res = await safeFetch(`${API_ROOT}/documents/${documentId}/download-envelope`);
    if (!res.ok) {
      throw new Error(`Failed to download envelope: HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async analyzeLeakedDocument(file: File): Promise<ForensicAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await safeFetch(`${API_ROOT}/forensics/analyze`, {
      method: 'POST',
      body: formData
    });
    return handleResponse<ForensicAnalysisResult>(res, 'FORENSIC_ANALYSIS');
  },

  async downloadEvidencePackage(eventId: number): Promise<void> {
    const res = await safeFetch(`${API_ROOT}/forensics/evidence/${eventId}`);
    if (!res.ok) {
      throw new Error(`Failed to export evidence bundle: HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CIPHERTRACE_EVIDENCE_EVT_${eventId}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async getLedgerBlocks(): Promise<LedgerBlock[]> {
    const res = await safeFetch(`${API_ROOT}/ledger/blocks`);
    return handleResponse<LedgerBlock[]>(res, 'FETCH_LEDGER_BLOCKS');
  }
};

