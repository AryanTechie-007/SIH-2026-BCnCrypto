import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { Officer, DocumentRecord, DistributionResult, UserAccount } from '../types';
import { Shield, FileText, Upload, Lock, Download, CheckSquare, Square, AlertOctagon, Share2, UserPlus } from 'lucide-react';

interface SenderConsoleProps {
  currentUser?: UserAccount | null;
  onOpenAuth?: () => void;
}

export const SenderConsole: React.FC<SenderConsoleProps> = ({ currentUser, onOpenAuth }) => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>([]);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<DistributionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setErrorMessage(null);
      const [uList, dList] = await Promise.all([
        ApiClient.getOfficers(),
        ApiClient.getDocuments()
      ]);
      setOfficers(uList);
      setDocuments(dList);
      if (dList.length > 0) setSelectedDocId(dList[0].id);
      if (uList.length > 0) setSelectedRecipientIds(uList.map(u => u.id));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize Sender Console');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setErrorMessage(null);
      setUploadStatus(`Ingesting and hashing ${file.name}...`);
      const newDoc = await ApiClient.uploadDocument(file);
      setDocuments(prev => [newDoc, ...prev]);
      setSelectedDocId(newDoc.id);
      setUploadStatus(null);
    } catch (err: any) {
      setUploadStatus(null);
      setErrorMessage(err.message || 'Document ingestion failed');
    }
  };

  const toggleRecipient = (id: number) => {
    setSelectedRecipientIds(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const handleDistribute = async () => {
    if (!selectedDocId) {
      setErrorMessage("No target document selected.");
      return;
    }
    if (selectedRecipientIds.length === 0) {
      setErrorMessage("Must designate at least one operational recipient for key encapsulation.");
      return;
    }

    try {
      setIsDistributing(true);
      setErrorMessage(null);
      setDistributionResult(null);

      const result = await ApiClient.distributeDocument(selectedDocId, selectedRecipientIds);
      setDistributionResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || "Distribution envelope generation failed");
    } finally {
      setIsDistributing(false);
    }
  };

  const activeDoc = documents.find(d => d.id === selectedDocId);

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Console Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="tactical-badge badge-blue">STAGE 1</span>
          <span className="tactical-badge badge-slate">NIST FIPS 203 ML-KEM-768</span>
          <span className="tactical-badge badge-slate">NIST SP 800-38D AES-256-GCM</span>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.03em', color: '#ffffff' }}>
          CLASSIFIED ENVELOPE ENCRYPTION & MULTI-RECIPIENT DISTRIBUTION
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
          Encrypt defense payloads once with AES-256-GCM. Encapsulate symmetric DEK under distinct ML-KEM-768 lattice keys per recipient.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="tactical-alert tactical-alert-danger" style={{ marginBottom: '20px' }}>
          <AlertOctagon size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <strong>SENDER CONSOLE EXCEPTION:</strong> {errorMessage}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '20px' }}>
        {/* Left Column: Target Document Selection & Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="tactical-panel">
            <div className="tactical-panel-header">
              <h3>Target Classified Document</h3>
              <label className="tactical-btn tactical-btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>
                <Upload size={12} />
                <span>Upload PDF</span>
                <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
            <div className="tactical-panel-body">
              {uploadStatus && (
                <div style={{ color: '#38bdf8', fontSize: '11px', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
                  {uploadStatus}
                </div>
              )}

              <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                SELECT REGISTERED DOCUMENT:
              </label>
              <select
                className="tactical-select"
                value={selectedDocId || ''}
                onChange={(e) => {
                  setSelectedDocId(Number(e.target.value));
                  setDistributionResult(null);
                }}
              >
                {documents.map(d => (
                  <option key={d.id} value={d.id}>
                    DOC-{d.id}: {d.file_name} ({(d.size_bytes / 1024).toFixed(1)} KB)
                  </option>
                ))}
              </select>

              {activeDoc && (
                <div style={{ marginTop: '16px', backgroundColor: '#090d15', border: '1px solid var(--border-hard)', padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>DOCUMENT TITLE:</div>
                  <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '12px', marginBottom: '12px' }}>
                    {activeDoc.title}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>NIST FIPS 202 SHA3-256 TAMPER ANCHOR:</div>
                  <div className="font-mono" style={{ fontSize: '11px', color: '#38bdf8', wordBreak: 'break-all', backgroundColor: '#05070c', padding: '6px 8px', border: '1px solid #141c2d' }}>
                    {activeDoc.sha3_hash}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <button
            className="tactical-btn tactical-btn-primary"
            onClick={handleDistribute}
            disabled={isDistributing || !selectedDocId || selectedRecipientIds.length === 0}
            style={{ padding: '14px', fontSize: '13px', width: '100%' }}
          >
            <Lock size={16} />
            <span>
              {isDistributing 
                ? 'COMPUTING ML-KEM-768 LATTICE ENVELOPES...' 
                : `ENCRYPT & DISTRIBUTE TO ${selectedRecipientIds.length} RECIPIENT(S)`}
            </span>
          </button>
        </div>

        {/* Right Column: Operational Recipient Selection & Envelope Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Recipient Selection Table */}
          <div className="tactical-panel">
            <div className="tactical-panel-header">
              <h3>Designated Operational Recipients ({selectedRecipientIds.length} Selected)</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="tactical-btn tactical-btn-secondary"
                  onClick={() => setSelectedRecipientIds(officers.map(o => o.id))}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Select All
                </button>
                <button
                  className="tactical-btn tactical-btn-secondary"
                  onClick={() => setSelectedRecipientIds([])}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Clear All
                </button>
              </div>
            </div>

            <table className="tactical-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Auth</th>
                  <th>Recipient Officer</th>
                  <th>Navy ID</th>
                  <th>Command Unit</th>
                  <th>Clearance</th>
                  <th>Enrolled Hardware</th>
                </tr>
              </thead>
              <tbody>
                {officers.map(u => {
                  const isChecked = selectedRecipientIds.includes(u.id);
                  return (
                    <tr 
                      key={u.id}
                      onClick={() => toggleRecipient(u.id)}
                      style={{ cursor: 'pointer', backgroundColor: isChecked ? 'rgba(2, 132, 199, 0.08)' : 'transparent' }}
                    >
                      <td>
                        {isChecked ? (
                          <CheckSquare size={16} color="#38bdf8" />
                        ) : (
                          <Square size={16} color="var(--text-dim)" />
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: isChecked ? '#ffffff' : 'var(--text-muted)' }}>
                        {u.name}
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                          @{u.username || u.navy_id} &bull; {u.rank}
                        </div>
                      </td>
                      <td className="font-mono">{u.navy_id}</td>
                      <td>{u.command_unit}</td>
                      <td>
                        <span className="tactical-badge badge-slate">{u.clearance_level}</span>
                      </td>
                      <td className="font-mono" style={{ color: '#38bdf8' }}>{u.device_id}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {officers.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#090d15' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' }}>
                  No operator accounts enrolled in system.
                </div>
                {onOpenAuth && (
                  <button onClick={onOpenAuth} className="tactical-btn tactical-btn-secondary" style={{ margin: '0 auto', fontSize: '11px' }}>
                    <UserPlus size={12} />
                    <span>Enroll Recipient Operators (Alice / Bob)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results: Generated Key Envelopes */}
          {distributionResult && (
            <div className="tactical-panel" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="tactical-panel-header" style={{ backgroundColor: '#071813' }}>
                <h3 style={{ color: '#6ee7b7' }}>
                  Distribution Complete &bull; {distributionResult.total_envelopes} Post-Quantum Envelopes Dispatched
                </h3>
                <button
                  className="tactical-btn tactical-btn-success"
                  onClick={() => ApiClient.downloadEnvelope(distributionResult.document_id, distributionResult.envelope_file_name)}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  <Download size={13} />
                  <span>Download .enc File</span>
                </button>
              </div>

              <div className="tactical-panel-body">
                {/* Cross-device notice */}
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: '#0a1d2e',
                  border: '1px solid #0284c7',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '11px', color: '#e0f2fe' }}>
                    <strong>📡 CROSS-DEVICE PACKAGE READY:</strong> Download the <code>{distributionResult.envelope_file_name}</code> package. Share it with your recipient over USB, network, or messaging. They can upload it in Stage 2 (Recipient Terminal) to decrypt!
                  </div>
                  <button
                    className="tactical-btn tactical-btn-success"
                    onClick={() => ApiClient.downloadEnvelope(distributionResult.document_id, distributionResult.envelope_file_name)}
                    style={{ padding: '6px 12px', fontSize: '11px', flexShrink: 0 }}
                  >
                    <Download size={13} />
                    <span>Save .enc</span>
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {distributionResult.envelopes.map(env => (
                    <div 
                      key={env.recipient_id}
                      style={{
                        backgroundColor: '#090d15',
                        border: '1px solid var(--border-hard)',
                        padding: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span className="font-mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{env.recipient_navy_id}</span>
                        <span className="tactical-badge badge-green">DISPATCHED</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '12px', color: '#ffffff' }}>{env.recipient_name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>ALGORITHM: {env.kem_algorithm}</div>
                      <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', wordBreak: 'break-all' }}>
                        {env.kem_ciphertext_preview}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
