import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { DocumentRecord, Officer, DistributionResult } from '../types';
import { Upload, Lock, Download, CheckSquare, Square, Search, ShieldCheck, AlertOctagon } from 'lucide-react';

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
  onOpenAuth: _onOpenAuth
}) => {
  const [selectedDocId, setSelectedDocId] = useState<number | null>(documents.length > 0 ? documents[0].id : null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>(officers.map(o => o.id));
  const [searchQuery, setSearchQuery] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<DistributionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

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
      {/* Top Search & Actions Bar */}
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
              color: 'var(--text-main)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label className="tactical-btn tactical-btn-primary" style={{ padding: '7px 14px', cursor: 'pointer' }}>
            <Upload size={13} />
            <span>Upload &amp; Encrypt</span>
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

      {/* Main Two-Column View: Table on Left + Inspector Drawer on Right */}
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
                <th>File Name &amp; Title</th>
                <th style={{ textAlign: 'right' }}>Specs</th>
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
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent'
                    }}
                  >
                    <td className="font-mono" style={{ color: isSelected ? '#38bdf8' : 'var(--text-dim)', fontWeight: 600 }}>
                      DOC-{String(doc.id).padStart(4, '0')}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{doc.file_name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                        {(doc.size_bytes / 1024).toFixed(1)} KB &bull; PDF
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="tactical-badge badge-blue">AES-256 + KEM</span>
                    </td>
                  </tr>
                );
              })}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    No documents found. Click "Upload &amp; Encrypt" above to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right-Hand Distribution Drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeDoc ? (
            <div className="tactical-panel" style={{ borderLeft: '4px solid #38bdf8' }}>
              <div className="tactical-panel-header">
                <h3>DOC-{String(activeDoc.id).padStart(4, '0')}</h3>
                <span className="tactical-badge badge-blue">RESTRICTED</span>
              </div>

              <div className="tactical-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
                {/* Forensic Identity */}
                <div style={{ borderBottom: '1px solid var(--border-hard)', paddingBottom: '10px' }}>
                  <div style={{ color: 'var(--text-dim)', fontWeight: 700, marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
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
                </div>

                {/* Cryptographic Policy Info */}
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-hard)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} />
                    <span>COMMON ENCRYPTION &bull; UNIQUE DECRYPTION</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px', lineHeight: '1.4' }}>
                    Document payload is encrypted once with AES-256-GCM. Ephemeral keys are automatically encapsulated under NIST FIPS 203 ML-KEM-768 lattice keys for enrolled identities.
                  </div>
                </div>

                {/* Recipient Selection Section - Always visible and prominent */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      DESIGNATE RECIPIENTS:
                    </div>
                    <span style={{ fontSize: '10px', color: '#3b82f6', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {selectedRecipientIds.length} of {officers.length} selected
                    </span>
                  </div>

                  <div style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-hard)',
                    borderRadius: '4px',
                    padding: '10px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Check recipients to grant access:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedRecipientIds(officers.map(o => o.id))}
                          className="tactical-btn tactical-btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '10px' }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedRecipientIds([])}
                          className="tactical-btn tactical-btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '10px' }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '180px', overflowY: 'auto' }}>
                      {officers.map(u => {
                        const isChecked = selectedRecipientIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => toggleRecipient(u.id)}
                            style={{
                              padding: '7px 10px',
                              backgroundColor: isChecked ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                              border: isChecked ? '1px solid #3b82f6' : '1px solid var(--border-hard)',
                              borderRadius: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              fontSize: '11px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isChecked ? <CheckSquare size={14} color="#3b82f6" /> : <Square size={14} color="var(--text-dim)" />}
                              <span style={{ color: isChecked ? '#ffffff' : 'var(--text-muted)', fontWeight: isChecked ? 600 : 400 }}>{u.name}</span>
                            </div>
                            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                              @{u.username || u.navy_id}
                            </span>
                          </div>
                        );
                      })}
                      {officers.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-dim)', fontSize: '11px' }}>
                          No registered recipients found. Create identities under Account Management.
                        </div>
                      )}
                    </div>
                  </div>
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
                    padding: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '4px',
                    marginTop: '4px'
                  }}>
                    <div style={{ color: '#34d399', fontWeight: 700, fontSize: '11px', marginBottom: '4px' }}>
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
              Select a document from the archive to configure recipient distribution and encrypt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
