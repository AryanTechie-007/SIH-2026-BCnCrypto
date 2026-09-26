import {
  Officer,
  DocumentRecord,
  DistributionResult,
  DecryptionResult,
  ForensicAnalysisResult,
  LedgerBlock,
  AttackProfile,
  AttackResult,
  SystemHealth,
  UserAccount,
  AuthResult
} from '../types';

const API_ROOT = (typeof window !== 'undefined' && window.location.port === '5173')
  ? '/api'
  : (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? `http://${window.location.hostname}:8000/api`
    : 'http://127.0.0.1:8000/api';

async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  const timeout = options?.signal ? 0 : 30000; // Increased to 30s for PQC overhead
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options?.signal || controller.signal
    });
    clearTimeout(id);
    return res;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeout}ms.`);
    }
    if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.name === 'TypeError')) {
      throw new Error(`Cannot reach CIPHERTRACE Core at ${url}. Please ensure the FastAPI backend is running on port 8000 (run 'start_demo.bat' or 'python -m uvicorn app.main:app').`);
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

  async register(data: { username: string; password: string; display_name: string; rank?: string; device_id?: string }): Promise<AuthResult> {
    const res = await safeFetch(`${API_ROOT}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<AuthResult>(res, 'AUTH_REGISTER');
  },

  async login(data: { username: string; password: string }): Promise<AuthResult> {
    const res = await safeFetch(`${API_ROOT}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<AuthResult>(res, 'AUTH_LOGIN');
  },

  async getUsers(): Promise<UserAccount[]> {
    const res = await safeFetch(`${API_ROOT}/auth/users`);
    return handleResponse<UserAccount[]>(res, 'FETCH_USERS');
  },

  async getCurrentUser(userId?: number): Promise<UserAccount> {
    const url = userId ? `${API_ROOT}/auth/me?user_id=${userId}` : `${API_ROOT}/auth/me`;
    const res = await safeFetch(url);
    return handleResponse<UserAccount>(res, 'FETCH_CURRENT_USER');
  },

  async decryptDocument(documentId: number, recipientId: number, deviceId?: string): Promise<DecryptionResult> {
    const res = await safeFetch(`${API_ROOT}/decryption/decrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: documentId,
        recipient_id: recipientId,
        device_id: deviceId
      })
    });
    return handleResponse<DecryptionResult>(res, 'DECRYPT_DOCUMENT');
  },

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
  },

  async verifyLedger(): Promise<{ chain_integrity_valid: boolean; total_blocks: number; detailed_block_report: any[] }> {
    const res = await safeFetch(`${API_ROOT}/ledger/verify`);
    return handleResponse<any>(res, 'VERIFY_LEDGER');
  },

  async tamperLedger(blockIndex: number = 1): Promise<any> {
    const res = await safeFetch(`${API_ROOT}/ledger/tamper?block_index=${blockIndex}`, { method: 'POST' });
    return handleResponse<any>(res, 'TAMPER_LEDGER');
  },

  async getClusterNodes(): Promise<any> {
    const res = await safeFetch(`${API_ROOT}/ledger/nodes`);
    return handleResponse<any>(res, 'FETCH_CLUSTER_NODES');
  },

  async restoreLedger(): Promise<any> {
    const res = await safeFetch(`${API_ROOT}/ledger/restore`, { method: 'POST' });
    return handleResponse<any>(res, 'RESTORE_LEDGER');
  },

  async getAttackProfiles(): Promise<AttackProfile[]> {
    const res = await safeFetch(`${API_ROOT}/attacks/profiles`);
    return handleResponse<AttackProfile[]>(res, 'FETCH_ATTACK_PROFILES');
  },

  async simulateAttack(attackType: string): Promise<AttackResult> {
    const res = await safeFetch(`${API_ROOT}/attacks/simulate?attack_type=${encodeURIComponent(attackType)}`, {
      method: 'POST'
    });
    return handleResponse<AttackResult>(res, 'SIMULATE_ATTACK');
  }
};
