import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { DocumentRecord, Officer, DistributionResult } from '../types';
import { Upload, Lock, Download, CheckSquare, Square, Search, ShieldCheck, AlertOctagon, FileText } from 'lucide-react';

interface DocumentsConsoleProps {
  documents: DocumentRecord[];
  officers: Officer[];
  onDocumentUploaded: () => void;
  onOpenAuth: () => void;
}

export const DocumentsConsole: React.FC<DocumentsConsoleProps> = ({
  documents,
  officers,
  onDocumentUploaded,
  onOpenAuth
}) => {
  const [selectedDocId, setSelectedDocId] = useState<number | null>(documents.length > 0 ? documents[0].id : null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>(officers.map(o => o.id));
  const [searchQuery, setSearchQuery] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<DistributionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [showCustomRecipients, setShowCustomRecipients] = useState(true);

  // Sync recipient checkboxes when officers list is loaded
  React.useEffect(() => {
    if (officers.length > 0 && selectedRecipientIds.length === 0) {
      setSelectedRecipientIds(officers.map(o => o.id));
    }
  }, [officers]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus(`Ingesting and computing SHA3-256 anchor for ${file.name}...`);
      setErrorMessage(null);
      const newDoc = await ApiClient.uploadDocument(file);
      setUploadStatus(`Document registered: DOC-${newDoc.id} (${newDoc.sha3_hash.slice(0, 16)}...)`);
      onDocumentUploaded();
      setSelectedDocId(newDoc.id);
      setDistributionResult(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload document');
      setUploadStatus(null);
    }
  };

  const handleDistribute = async () => {
    if (!selectedDocId) {
      setErrorMessage('Please select a document to encrypt');
      return;
    }
    if (selectedRecipientIds.length === 0) {
      setErrorMessage('Please designate at least one authorized recipient for key encapsulation.');
      return;
    }

    try {
      setIsDistributing(true);
      setErrorMessage(null);
      const res = await ApiClient.distributeDocument(selectedDocId, selectedRecipientIds);
      setDistributionResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Envelope encryption failed');
    } finally {
      setIsDistributing(false);
    }
  };

  const toggleRecipient = (id: number) => {
    setSelectedRecipientIds(prev =>
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const activeDoc = documents.find(d => d.id === selectedDocId) || (documents.length > 0 ? documents[0] : null);

  const filteredDocs = documents.filter(d =>
    d.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.sha3_hash.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Search & Actions Bar (Matching Image 2) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-hard)',
        padding: '12px 16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '480px' }}>
          <Search size={14} color="var(--text-dim)" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search documents by name, title, or SHA3-256 hash..."
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label className="tactical-btn tactical-btn-primary" style={{ padding: '7px 14px', cursor: 'pointer' }}>
            <Upload size={13} />
            <span>Ingest Document (PDF)</span>
            <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {uploadStatus && (
        <div style={{ color: '#38bdf8', fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '0 4px' }}>
          ℹ️ {uploadStatus}
        </div>
      )}

      {errorMessage && (
        <div className="tactical-alert tactical-alert-danger">
          <AlertOctagon size={16} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Stats Summary Bar (Matching Image 2) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px'
      }}>
        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-hard)', padding: '10px 14px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>CONFIDENTIAL VAULT</div>
          <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '14px', marginTop: '2px' }}>
            {documents.length} ASSETS
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-hard)', padding: '10px 14px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>PQ CRYPTO PROTOCOL</div>
          <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '14px', marginTop: '2px' }}>
            ML-KEM-768 (FIPS 203)
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-hard)', padding: '10px 14px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>STEGANOGRAPHY ENFORCEMENT</div>
          <div style={{ color: '#34d399', fontWeight: 800, fontSize: '14px', marginTop: '2px' }}>
            2D DCT + RS(255, 127)
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-hard)', padding: '10px 14px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>SYMMETRIC CIPHER</div>
          <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '14px', marginTop: '2px' }}>
            AES-256-GCM
          </div>
        </div>
      </div>

      {/* Main Two-Column View: Table on Left + Inspector Drawer on Right (Matching Image 2) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px' }}>
        {/* Document Library Table */}
        <div className="tactical-panel">
          <div className="tactical-panel-header">
            <h3>Secured Confidential Archive</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {filteredDocs.length} displayed
            </span>
          </div>

          <table className="tactical-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th>File Name & Title</th>
                <th>Specs</th>
                <th>SHA3-256 Tamper Anchor</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(doc => {
                const isSelected = activeDoc?.id === doc.id;
                return (
                  <tr
                    key={doc.id}
                    onClick={() => { setSelectedDocId(doc.id); setDistributionResult(null); }}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.1)' : 'transparent'
                    }}
                  >
                    <td className="font-mono" style={{ color: isSelected ? '#38bdf8' : 'var(--text-dim)', fontWeight: 700 }}>
                      DOC-{String(doc.id).padStart(4, '0')}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>{doc.file_name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {(doc.size_bytes / 1024).toFixed(1)} KB &bull; PDF
                      </div>
                    </td>
                    <td>
                      <span className="tactical-badge badge-blue">AES-256 + KEM</span>
                    </td>
                    <td className="font-mono" style={{ color: '#38bdf8', fontSize: '11px' }}>
                      {doc.sha3_hash.slice(0, 16)}...
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedDocId(doc.id); }}
                        className="btn-bracket"
                      >
                        INSPECT
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    No documents found. Click "Ingest Document (PDF)" above to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right-Hand Inspector Drawer (Matching Image 2) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeDoc ? (
            <div className="tactical-panel" style={{ borderLeft: '4px solid #0284c7' }}>
              <div className="tactical-panel-header">
                <h3>INSPECTOR: DOC-{String(activeDoc.id).padStart(4, '0')}</h3>
                <span className="tactical-badge badge-blue">RESTRICTED</span>
              </div>

              <div className="tactical-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
                {/* Forensic Identity */}
                <div style={{ borderBottom: '1px solid #141f32', paddingBottom: '10px' }}>
                  <div style={{ color: 'var(--text-dim)', fontWeight: 700, marginBottom: '6px' }}>
                    DOCUMENT METADATA:
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>File Name:</span>
                    <strong style={{ color: '#ffffff' }}>{activeDoc.file_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>File Size:</span>
                    <span className="font-mono">{(activeDoc.size_bytes / 1024).toFixed(1)} KB</span>
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>SHA3-256 Digest:</span>
                    <div className="font-mono" style={{ color: '#38bdf8', fontSize: '10px', wordBreak: 'break-all', marginTop: '2px', backgroundColor: '#070a12', padding: '4px 6px', border: '1px solid #141e2e' }}>
                      {activeDoc.sha3_hash}
                    </div>
                  </div>
                </div>

                {/* Cryptographic Policy Info */}
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: '#070f1a',
                  border: '1px solid #142845',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <div style={{ color: '#38bdf8', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} />
                    <span>COMMON ENCRYPTION &bull; UNIQUE DECRYPTION</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px', lineHeight: '1.4' }}>
                    Document payload is encrypted once with AES-256-GCM. Ephemeral keys are automatically encapsulated under NIST FIPS 203 ML-KEM-768 lattice keys for enrolled identities.
                  </div>
                </div>

                {/* Optional Custom Recipient Filter Toggle */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setShowCustomRecipients(!showCustomRecipients)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: showCustomRecipients ? '#38bdf8' : 'var(--text-dim)',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline'
                      }}
                    >
                      {showCustomRecipients ? '▼ Hide Recipient Filter (Universal Active)' : '▶ Advanced: Restrict Specific Recipients (Optional)'}
                    </button>
                    {showCustomRecipients && (
                      <span style={{ fontSize: '9px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                        {selectedRecipientIds.length} of {officers.length} selected
                      </span>
                    )}
                  </div>

                  {showCustomRecipients && (
                    <div style={{
                      backgroundColor: '#070b13',
                      border: '1px solid var(--border-hard)',
                      padding: '8px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '6px' }}>
                        <button
                          onClick={() => setSelectedRecipientIds(officers.map(o => o.id))}
                          className="tactical-btn tactical-btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '9px' }}
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedRecipientIds([])}
                          className="tactical-btn tactical-btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '9px' }}
                        >
                          Clear
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                        {officers.map(u => {
                          const isChecked = selectedRecipientIds.includes(u.id);
                          return (
                            <div
                              key={u.id}
                              onClick={() => toggleRecipient(u.id)}
                              style={{
                                padding: '4px 6px',
                                backgroundColor: isChecked ? 'rgba(2, 132, 199, 0.12)' : 'transparent',
                                border: isChecked ? '1px solid #0284c7' : '1px solid #141c2c',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                fontSize: '10px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isChecked ? <CheckSquare size={12} color="#38bdf8" /> : <Square size={12} color="var(--text-dim)" />}
                                <span style={{ color: isChecked ? '#ffffff' : 'var(--text-muted)' }}>{u.name}</span>
                              </div>
                              <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                                @{u.username || u.navy_id}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Action Button */}
                <button
                  className="tactical-btn tactical-btn-primary"
                  onClick={handleDistribute}
                  disabled={isDistributing}
                  style={{ width: '100%', padding: '12px', marginTop: '4px', justifyContent: 'center' }}
                >
                  <Lock size={14} />
                  <span>
                    {isDistributing
                      ? 'COMPUTING ML-KEM-768 POST-QUANTUM KEYS...'
                      : 'ENCRYPT DOCUMENT & GENERATE .ENC'}
                  </span>
                </button>

                {/* Download Button if generated */}
                {distributionResult && (
                  <div style={{
                    padding: '10px',
                    backgroundColor: '#071813',
                    border: '1px solid #065f46',
                    marginTop: '4px'
                  }}>
                    <div style={{ color: '#6ee7b7', fontWeight: 700, fontSize: '11px', marginBottom: '4px' }}>
                      ✓ Package Ready for Export
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '8px' }}>
                      {distributionResult.envelope_file_name} ({distributionResult.total_envelopes} envelopes)
                    </div>
                    <button
                      className="tactical-btn tactical-btn-success"
                      onClick={() => ApiClient.downloadEnvelope(distributionResult.document_id, distributionResult.envelope_file_name)}
                      style={{ width: '100%', padding: '8px', fontSize: '11px' }}
                    >
                      <Download size={13} />
                      <span>Download .enc File</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="tactical-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
              Select a document from the archive to inspect details and distribute.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
