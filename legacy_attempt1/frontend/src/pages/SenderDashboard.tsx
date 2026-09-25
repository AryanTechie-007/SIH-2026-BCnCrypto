import React, { useState, useEffect, useRef } from 'react';
import { ApiClient } from '../api/client';
import { User, DocumentRecord, DistributionPackage } from '../types';
import { 
  FileText, 
  Lock, 
  Send, 
  Users, 
  KeyRound, 
  CheckCircle, 
  ShieldAlert, 
  Hash, 
  Sparkles,
  Upload,
  Download,
  FolderUp
} from 'lucide-react';

export const SenderDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [distributionResult, setDistributionResult] = useState<DistributionPackage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const doc = await ApiClient.uploadDocument(file);
      setDocuments(prev => [doc, ...prev]);
      setSelectedDoc(doc);
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      const u = await ApiClient.getUsers();
      const d = await ApiClient.getDocuments();
      setUsers(u);
      setDocuments(d);
      if (d.length > 0) setSelectedDoc(d[0]);
      // Pre-select first two recipients for fast demo
      if (u.length >= 2) setSelectedRecipients([u[0].id, u[1].id]);
    }
    loadData();
  }, []);

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleDistribute = async () => {
    if (!selectedDoc || selectedRecipients.length === 0) return;
    setIsEncrypting(true);

    try {
      // Small artificial delay to highlight the cryptographic envelope generation steps in the UI
      await new Promise(r => setTimeout(r, 800));
      const result = await ApiClient.createDistribution(selectedDoc.id, selectedRecipients);
      setDistributionResult(result);
    } finally {
      setIsEncrypting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-cyan">SENDER AUTHORITY TERMINAL</span>
          <span className="badge badge-purple">FIPS 203 ENVELOPE ENCRYPTION</span>
        </div>
        <h1 style={{ fontSize: '28px', color: '#ffffff', letterSpacing: '-0.02em' }}>
          Classified Document Envelope Encryption & Distribution
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '800px', marginTop: '4px' }}>
          Upload classified defense payloads. One document ciphertext encrypted via AES-256-GCM, with individual 
          session key envelopes encapsulated per recipient via NIST standardized <strong>ML-KEM-768</strong>.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left Column: Document Selection & Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Document File Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} color="var(--cyan-primary)" />
                <h3 style={{ fontSize: '16px', color: '#ffffff' }}>Operational Document Payload</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FolderUp size={14} color="var(--cyan-primary)" />
                  <span>{isUploading ? 'Uploading...' : 'Upload PDF'}</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".pdf,application/pdf" 
                  style={{ display: 'none' }} 
                />
                <span className="badge badge-crimson">TOP SECRET // DEFENSE</span>
              </div>
            </div>

            {/* Document Switcher if multiple docs exist */}
            {documents.length > 1 && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px', display: 'block' }}>
                  SELECT ACTIVE PAYLOAD:
                </label>
                <select
                  value={selectedDoc?.id}
                  onChange={(e) => {
                    const found = documents.find(d => d.id === e.target.value);
                    if (found) setSelectedDoc(found);
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: '#070a12',
                    color: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '13px'
                  }}
                >
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.title} ({d.fileName})</option>
                  ))}
                </select>
              </div>
            )}

            {selectedDoc && (
              <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', padding: '18px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', color: '#ffffff', marginBottom: '4px' }}>{selectedDoc.title}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Filename: {selectedDoc.fileName} &bull; {(selectedDoc.fileSize / 1024).toFixed(1)} KB &bull; {selectedDoc.totalPages} Pages
                    </p>
                  </div>
                  <span className="badge badge-emerald" style={{ fontSize: '10px' }}>STAGED FOR PQC</span>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                    <Hash size={12} />
                    <span>CANONICAL SHA3-256 DOCUMENT HASH (TAMPER ROOT)</span>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--cyan-primary)',
                    backgroundColor: '#070a12',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    wordBreak: 'break-all',
                    border: '1px solid rgba(6, 182, 212, 0.2)'
                  }}>
                    {selectedDoc.sha3Hash}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Authority: </span>
                    <strong style={{ color: '#ffffff' }}>{selectedDoc.originatingAuthority}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Classification: </span>
                    <strong style={{ color: '#fca5a5' }}>{selectedDoc.classification}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cryptographic Envelope Architecture Visualizer */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', color: '#ffffff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={16} color="var(--indigo-primary)" />
              Hybrid Envelope Architecture (NIST FIPS 203)
            </h3>

            <div style={{
              backgroundColor: '#080d1a',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              lineHeight: '1.6',
              color: 'var(--text-muted)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span className="badge badge-cyan" style={{ fontSize: '10px' }}>STEP 1</span>
                <span>Generate Single Ephemeral 256-bit Symmetric Key (DEK)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span className="badge badge-cyan" style={{ fontSize: '10px' }}>STEP 2</span>
                <span>Encrypt Document Ciphertext via <strong>AES-256-GCM</strong> (Authenticated Stream)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge badge-purple" style={{ fontSize: '10px' }}>STEP 3</span>
                <span>Encapsulate DEK per Recipient using <strong>ML-KEM-768</strong> Lattice Primitives</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recipient Selection & Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="var(--emerald-primary)" />
                <h3 style={{ fontSize: '16px', color: '#ffffff' }}>Target Enrolled Vessels / Nodes</h3>
              </div>
              <span className="badge badge-cyan">{selectedRecipients.length} Selected</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {users.map(u => {
                const isSelected = selectedRecipients.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleRecipient(u.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'rgba(15, 23, 42, 0.5)',
                      border: isSelected ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => {}} 
                        style={{ accentColor: 'var(--cyan-primary)', width: '16px', height: '16px' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '13px' }}>
                          {u.name} <span style={{ color: 'var(--cyan-primary)', fontSize: '12px' }}>({u.id})</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {u.organization} &bull; {u.role}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-purple" style={{ fontSize: '9px' }}>
                        {u.mlKemKeyId}
                      </span>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        ML-KEM-768
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Distribution Trigger Button */}
            <div style={{ marginTop: '24px' }}>
              <button
                className="btn btn-primary"
                onClick={handleDistribute}
                disabled={isEncrypting || selectedRecipients.length === 0}
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              >
                {isEncrypting ? (
                  <>
                    <Sparkles className="animate-spin" size={18} />
                    <span>Executing ML-KEM-768 Encapsulations...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>SECURE ENVELOPE DISTRIBUTE ({selectedRecipients.length} RECIPIENTS)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Distribution Package Result */}
          {distributionResult && (
            <div className="glass-panel glass-panel-emerald" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <CheckCircle size={20} color="var(--emerald-primary)" />
                <h3 style={{ fontSize: '16px', color: '#ffffff' }}>Distribution Package Staged</h3>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Package ID: <strong style={{ color: '#ffffff' }}>{distributionResult.distributionId}</strong> &bull; 
                Timestamp: {distributionResult.createdAt}
              </div>

              <div style={{
                backgroundColor: '#070a12',
                borderRadius: '8px',
                padding: '12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--cyan-primary)',
                marginBottom: '14px'
              }}>
                <div>CIPHERTEXT PREVIEW: {distributionResult.encryptedCiphertextPreview}</div>
                <div style={{ color: 'var(--text-dim)', marginTop: '4px' }}>
                  ENVELOPES CREATED: {distributionResult.envelopes.length} RECIPIENT KEYS
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {distributionResult.envelopes.map(env => (
                  <div key={env.recipientId} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>Recipient: {env.recipientId}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {env.kemCiphertext.substring(0, 32)}...
                    </span>
                    <span className="badge badge-emerald" style={{ fontSize: '9px' }}>ML-KEM ENCAPSULATED</span>
                  </div>
                ))}
              </div>

              {/* Action: Download Encrypted File */}
              {selectedDoc && (
                <div style={{ marginTop: '16px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => ApiClient.downloadEncryptedFile(selectedDoc.id, selectedDoc.fileName)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      backgroundColor: 'rgba(6, 182, 212, 0.15)',
                      borderColor: 'var(--cyan-primary)',
                      color: '#ffffff',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={16} color="var(--cyan-primary)" />
                    <span>DOWNLOAD ENCRYPTED PACKAGE ({selectedDoc.fileName}.enc)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
