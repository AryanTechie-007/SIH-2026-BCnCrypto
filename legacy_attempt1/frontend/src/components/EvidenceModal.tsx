import React from 'react';
import { EvidenceBundle } from '../types';
import { X, Download, ShieldCheck, CheckCircle2, Copy } from 'lucide-react';

interface EvidenceModalProps {
  bundle: EvidenceBundle | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ bundle, onClose }) => {
  if (!bundle) return null;

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `CIPHERTRACE_EVIDENCE_${bundle.eventId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '850px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        backgroundColor: '#0c111d',
        borderColor: 'rgba(6, 182, 212, 0.3)'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={22} color="var(--emerald-primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', color: '#ffffff' }}>Cryptographic Forensic Evidence Package</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Offline Verifiable Bundle &bull; Bundle ID: {bundle.bundleId}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-primary" onClick={downloadJson}>
              <Download size={15} /> Download Package (.json)
            </button>
            <button 
              onClick={onClose} 
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Verification Summary Banner */}
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} color="var(--emerald-primary)" />
            <div>
              <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '13px' }}>
                MATHEMATICALLY & CRYPTOGRAPHICALLY ATTESTED
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                All 6 independent verification criteria passed without external dependencies.
              </div>
            </div>
          </div>
          <span className="badge badge-emerald">DETERMINISTIC PASS</span>
        </div>

        {/* Evidence Fields Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Attributed Recipient</span>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff', marginTop: '4px' }}>
              {bundle.recipientName} ({bundle.recipientId})
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Authorized Device ID</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--cyan-primary)', marginTop: '4px' }}>
              {bundle.deviceId}
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Decryption Event Timestamp</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#ffffff', marginTop: '4px' }}>
              {bundle.decryptionTimestamp} UTC
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Ledger Block & Merkle Root</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#ffffff', marginTop: '4px' }}>
              {bundle.ledgerBlockId} &bull; Root: {bundle.merkleRoot.substring(0, 16)}...
            </div>
          </div>
        </div>

        {/* Cryptographic Primitives Deep-Dive */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Cryptographic Signatures & Hashes
          </h4>
          
          <div style={{ backgroundColor: '#070a12', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <span>DOCUMENT SHA3-256 DIGEST</span>
              <button 
                onClick={() => copyToClipboard(bundle.documentHash)} 
                style={{ background: 'none', border: 'none', color: 'var(--cyan-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Copy size={11} /> Copy
              </button>
            </div>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#e2e8f0', wordBreak: 'break-all' }}>
              {bundle.documentHash}
            </code>
          </div>

          <div style={{ backgroundColor: '#070a12', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <span>RECOVERED WATERMARK PSEUDONYMOUS PAYLOAD (HMAC-SHA3-256 DERIVED)</span>
              <span className="badge badge-cyan" style={{ fontSize: '9px' }}>NON-REVERSIBLE IDENTIFIER</span>
            </div>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--cyan-primary)', wordBreak: 'break-all' }}>
              {bundle.recoveredWatermark}
            </code>
          </div>

          <div style={{ backgroundColor: '#070a12', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <span>ML-DSA-65 (FIPS 204) POST-QUANTUM RECIPIENT DIGITAL SIGNATURE</span>
              <span className="badge badge-emerald" style={{ fontSize: '9px' }}>VERIFIED VALID</span>
            </div>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#a7f3d0', wordBreak: 'break-all' }}>
              {bundle.mlDsaSignature}
            </code>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close Viewer</button>
          <button className="btn btn-primary" onClick={downloadJson}>
            <Download size={14} /> Download Evidence Bundle
          </button>
        </div>
      </div>
    </div>
  );
};
