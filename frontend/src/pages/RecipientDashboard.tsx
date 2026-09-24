import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { User, DocumentRecord, DecryptionEvent, LedgerBlock } from '../types';
import { 
  Key, 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  FileCheck, 
  Fingerprint, 
  Cpu, 
  Database,
  ArrowRight,
  Eye,
  FileText
} from 'lucide-react';

export const RecipientDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);

  // Decryption workflow state
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [decryptionResult, setDecryptionResult] = useState<{
    event: DecryptionEvent;
    watermarkId: string;
    ledgerBlock: LedgerBlock;
  } | null>(null);

  const [decryptionHistory, setDecryptionHistory] = useState<{
    recipientId: string;
    timestamp: string;
    watermarkId: string;
    eventId: string;
  }[]>([]);

  useEffect(() => {
    async function loadData() {
      const u = await ApiClient.getUsers();
      const d = await ApiClient.getDocuments();
      setUsers(u);
      setDocuments(d);
      if (u.length > 0) setSelectedUser(u[0]);
      if (d.length > 0) setSelectedDoc(d[0]);
    }
    loadData();
  }, []);

  const steps = [
    { title: 'ML-KEM-768 Decapsulation', desc: 'Recovering ephemeral symmetric DEK via recipient private lattice key (FIPS 203)' },
    { title: 'AES-256-GCM Decryption', desc: 'Validating cryptographic authentication tag & decrypting PDF payload' },
    { title: 'Session Formulation', desc: 'Generating unique cryptographic session nonce and canonical decryption event' },
    { title: 'Cryptographic Watermark Derivation', desc: 'Computing HMAC-SHA3-256(secret, doc_hash || key || nonce || event_id)' },
    { title: 'ML-DSA-65 Signature', desc: 'Recipient client signs canonical event hash with private signing key (FIPS 204)' },
    { title: 'Air-Gapped Ledger Commit', desc: 'Broadcasting signed record to permissioned offline consensus ledger' }
  ];

  const handleDecrypt = async () => {
    if (!selectedDoc || !selectedUser) return;
    setIsDecrypting(true);
    setDecryptionResult(null);
    setActiveStep(1);

    // Animate through each security step realistically
    for (let i = 1; i <= 6; i++) {
      setActiveStep(i);
      await new Promise(r => setTimeout(r, 450));
    }

    const res = await ApiClient.decryptDocument(selectedDoc.id, selectedUser.id);
    setDecryptionResult(res);
    setDecryptionHistory(prev => [
      {
        recipientId: selectedUser.id,
        timestamp: new Date().toLocaleTimeString(),
        watermarkId: res.watermarkId,
        eventId: res.event.eventId
      },
      ...prev
    ]);
    setIsDecrypting(false);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-emerald">RECIPIENT SECURE CLIENT TERMINAL</span>
          <span className="badge badge-cyan">FIPS 204 ML-DSA NON-REPUDIATION</span>
        </div>
        <h1 style={{ fontSize: '28px', color: '#ffffff', letterSpacing: '-0.02em' }}>
          Authorized Recipient Decryption & Cryptographic Signing
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '850px', marginTop: '4px' }}>
          Every decryption event triggers post-quantum decapsulation, session-bound watermark synthesis, 
          and recipient-signed attestation committed immutably to the offline ledger before document display.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Left Column: Identity & Terminal Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Identity Selector */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Select Enrolled Recipient Terminal
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {users.map(u => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setDecryptionResult(null);
                      setActiveStep(0);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.4)',
                      border: isSelected ? '1px solid var(--emerald-primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '14px' }}>{u.name}</div>
                      <span className="badge badge-emerald" style={{ fontSize: '9px' }}>{u.id}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {u.organization}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recipient Cryptographic Identity Card */}
          {selectedUser && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Cpu size={16} color="var(--cyan-primary)" />
                <h3 style={{ fontSize: '14px', color: '#ffffff' }}>Cryptographic Identity Token</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>CLEARANCE LEVEL:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>{selectedUser.clearance}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>AUTHORIZED DEVICE IDENTIFIER:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-primary)' }}>{selectedUser.deviceId}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>ML-KEM-768 KEY ID:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', color: '#ffffff' }}>{selectedUser.mlKemKeyId}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>ML-DSA-65 SIGNING KEY ID:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', color: '#ffffff' }}>{selectedUser.mlDsaKeyId}</div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Action: Decrypt Trigger */}
          <button
            className="btn btn-emerald"
            onClick={handleDecrypt}
            disabled={isDecrypting || !selectedDoc}
            style={{ padding: '16px', fontSize: '15px' }}
          >
            {isDecrypting ? 'Executing Cryptographic Pipeline...' : 'DECRYPT & AUTHORIZE DOCUMENT'}
          </button>
        </div>

        {/* Right Column: Interactive Decryption Stepper & Document Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Animated 6-Step Checklist */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--emerald-primary)" />
              Atomic Cryptographic Decryption Sequence
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {steps.map((st, idx) => {
                const stepNum = idx + 1;
                const isPassed = activeStep > stepNum || (activeStep === 6 && !isDecrypting && decryptionResult !== null);
                const isCurrent = activeStep === stepNum && isDecrypting;
                return (
                  <div
                    key={st.title}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isCurrent 
                        ? 'rgba(6, 182, 212, 0.12)' 
                        : isPassed 
                        ? 'rgba(16, 185, 129, 0.08)' 
                        : 'rgba(15, 23, 42, 0.3)',
                      border: isCurrent 
                        ? '1px solid var(--cyan-primary)' 
                        : isPassed 
                        ? '1px solid rgba(16, 185, 129, 0.3)' 
                        : '1px solid var(--border-subtle)',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: isPassed 
                        ? 'var(--emerald-primary)' 
                        : isCurrent 
                        ? 'var(--cyan-primary)' 
                        : 'rgba(255, 255, 255, 0.1)',
                      color: isPassed || isCurrent ? '#000000' : 'var(--text-muted)'
                    }}>
                      {isPassed ? <CheckCircle2 size={16} /> : stepNum}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: isPassed ? '#ffffff' : isCurrent ? 'var(--cyan-primary)' : 'var(--text-muted)', fontSize: '13px' }}>
                        {st.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {st.desc}
                      </div>
                    </div>

                    {isPassed && <span className="badge badge-emerald" style={{ fontSize: '9px' }}>COMPLETED</span>}
                    {isCurrent && <span className="badge badge-cyan animate-pulse-glow" style={{ fontSize: '9px' }}>PROCESSING</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Decrypted Document & Watermark Reveal */}
          {decryptionResult && (
            <div className="glass-panel glass-panel-emerald" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileCheck size={22} color="var(--emerald-primary)" />
                  <div>
                    <h3 style={{ fontSize: '16px', color: '#ffffff' }}>Document Decrypted & Session Bound</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Rendered with invisible DCT-spread forensic fingerprint
                    </p>
                  </div>
                </div>
                <span className="badge badge-emerald">AUTHORIZED DISPLAY</span>
              </div>

              {/* Watermark Details */}
              <div style={{
                backgroundColor: '#070a12',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>SESSION WATERMARK IDENTIFIER (HMAC-SHA3-256)</span>
                  <span className="badge badge-cyan" style={{ fontSize: '9px' }}>UNIQUE TO THIS DECRYPTION</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--cyan-primary)', fontWeight: 600 }}>
                  {decryptionResult.watermarkId}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <div>Event ID: <strong style={{ color: '#ffffff' }}>{decryptionResult.event.eventId}</strong></div>
                  <div>Nonce: <strong style={{ color: '#ffffff' }}>{decryptionResult.event.sessionNonce}</strong></div>
                  <div>Ledger Block: <strong style={{ color: '#ffffff' }}>{decryptionResult.ledgerBlock.blockId}</strong></div>
                </div>
              </div>

              {/* Forensic Insight Banner */}
              <div style={{
                backgroundColor: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                fontSize: '12px',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Fingerprint size={24} color="var(--cyan-primary)" />
                <div>
                  <strong>Why this proves session attribution:</strong> If this recipient decrypts the same document again 
                  5 minutes later, an entirely new session nonce, new watermark, and new ML-DSA signature will be committed. 
                  Every viewing instance carries its own distinct forensic timeline.
                </div>
              </div>
            </div>
          )}

          {/* Session History (Showing Uniqueness of Multiple Decryptions) */}
          {decryptionHistory.length > 1 && (
            <div className="glass-panel" style={{ padding: '18px 24px' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
                Decryption Sessions Generated This Runtime ({decryptionHistory.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {decryptionHistory.map((h, i) => (
                  <div key={h.eventId} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    <span style={{ color: '#ffffff' }}>#{decryptionHistory.length - i} &bull; {h.recipientId} at {h.timestamp}</span>
                    <span style={{ color: 'var(--cyan-primary)' }}>{h.watermarkId}</span>
                    <span className="badge badge-emerald" style={{ fontSize: '9px' }}>SIGNED</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
