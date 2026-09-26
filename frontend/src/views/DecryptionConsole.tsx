import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { Officer, DocumentRecord, DecryptionResult, UserAccount } from '../types';
import { Upload, Key, FileCheck, CheckCircle2, Download, AlertOctagon, RefreshCw, Shield, ChevronRight } from 'lucide-react';

interface DecryptionConsoleProps {
  documents: DocumentRecord[];
  officers: Officer[];
  currentUser: UserAccount | null;
  onDecryptionSuccess?: () => void;
  onOpenAuth?: () => void;
}

export const DecryptionConsole: React.FC<DecryptionConsoleProps> = ({
  documents,
  officers,
  currentUser,
  onDecryptionSuccess,
  onOpenAuth
}) => {
  const [decryptMode, setDecryptMode] = useState<'envelope_file' | 'repository'>('envelope_file');
  const [selectedDocId, setSelectedDocId] = useState<number | null>(documents.length > 0 ? documents[0].id : null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  
  // File upload state
  const [uploadedEncFile, setUploadedEncFile] = useState<File | null>(null);
  const [parsedEnvelope, setParsedEnvelope] = useState<any | null>(null);

  // Execution states
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [activeStage, setActiveStage] = useState<number>(0);
  const [decryptionResult, setDecryptionResult] = useState<DecryptionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState<string>('PIPE-' + Math.floor(1000 + Math.random() * 9000) + '-MLKEM');
  const [countdown, setCountdown] = useState<string>('12:00');

  // Match recipient to current user or first available officer
  useEffect(() => {
    if (currentUser) {
      const match = officers.find(o => o.username === currentUser.username || o.navy_id === currentUser.navy_id);
      if (match) {
        setSelectedRecipientId(match.id);
        return;
      }
    }
    if (officers.length > 0 && selectedRecipientId === null) {
      setSelectedRecipientId(officers[0].id);
    }
  }, [currentUser, officers]);

  // Keep selectedDocId valid
  useEffect(() => {
    if (documents.length > 0 && selectedDocId === null) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents]);

  const stages = [
    { num: '01', name: 'Selection' },
    { num: '02', name: 'Auth' },
    { num: '03', name: 'Decryption' },
    { num: '04', name: 'Fingerprint' },
    { num: '05', name: 'Signature' },
    { num: '06', name: 'Ledger Commit' },
    { num: '07', name: 'Release' }
  ];

  const handleEncFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setDecryptionResult(null);
    setActiveStage(1);
    setUploadedEncFile(file);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setParsedEnvelope(json);
      // If envelope contains recipients, auto-select if current user is in it
      if (json.envelopes && Array.isArray(json.envelopes)) {
        const allowedIds = json.envelopes.map((env: any) => env.recipient_id);
        if (selectedRecipientId && !allowedIds.includes(selectedRecipientId)) {
          setSelectedRecipientId(allowedIds[0] || null);
        }
      }
    } catch {
      setParsedEnvelope(null);
      setErrorMessage("Could not parse file as JSON. Please ensure you uploaded a valid .enc package.");
    }
  };

  const handleExecuteDecrypt = async () => {
    if (!selectedRecipientId) {
      setErrorMessage("Please select a recipient identity to authorize decryption.");
      return;
    }

    try {
      setIsDecrypting(true);
      setErrorMessage(null);
      setDecryptionResult(null);
      setPipelineId('PIPE-' + Math.floor(1000 + Math.random() * 9000) + '-MLKEM');

      // Stage progression animation
      setActiveStage(2);
      await new Promise(r => setTimeout(r, 120));
      setActiveStage(3);

      let result: DecryptionResult;

      if (decryptMode === 'envelope_file') {
        if (!uploadedEncFile) {
          setErrorMessage("Please upload an encrypted .enc package file first.");
          setIsDecrypting(false);
          setActiveStage(0);
          return;
        }
        result = await ApiClient.decryptEnvelopeFile(uploadedEncFile, selectedRecipientId);
      } else {
        if (!selectedDocId) {
          setErrorMessage("Please select a document from the repository to decrypt.");
          setIsDecrypting(false);
          setActiveStage(0);
          return;
        }
        result = await ApiClient.decryptDocument(selectedDocId, selectedRecipientId);
      }

      // Finish stages
      setActiveStage(4);
      await new Promise(r => setTimeout(r, 150));
      setActiveStage(5);
      await new Promise(r => setTimeout(r, 150));
      setActiveStage(6);
      await new Promise(r => setTimeout(r, 150));
      setActiveStage(7);

      setDecryptionResult(result);
      if (onDecryptionSuccess) onDecryptionSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Decryption failed. Recipient may not be authorized for this document.');
      setActiveStage(0);
    } finally {
      setIsDecrypting(false);
    }
  };

  const selectedOfficer = officers.find(o => o.id === selectedRecipientId);
  const activeDocument = documents.find(d => d.id === selectedDocId);

  // Check if selected recipient is authorized in parsed envelope
  const isRecipientInEnvelope = () => {
    if (!parsedEnvelope || !parsedEnvelope.envelopes) return true;
    return parsedEnvelope.envelopes.some((env: any) => env.recipient_id === selectedRecipientId);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Pipeline Execution Header (Matching Image 4) */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-hard)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--text-dim)' }}>DECRYPTION LAB PIPELINE:</span>
          <span style={{ color: '#ffffff', fontWeight: 700 }}>{pipelineId}</span>
          <span style={{
            backgroundColor: '#0a1d2e',
            color: '#38bdf8',
            border: '1px solid #0284c7',
            padding: '2px 6px',
            fontSize: '9px',
            fontWeight: 700
          }}>
            ISOLATED ENCLAVE 0
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-dim)' }}>
          <span>STAGE: <strong style={{ color: '#38bdf8' }}>0{activeStage || 1} OF 07</strong></span>
          <span>SESSION CACHE LIFESPAN: <strong style={{ color: '#ffffff' }}>12:00</strong></span>
        </div>
      </div>

      {/* 7-Step Pipeline Breadcrumb Bar (Matching Image 4) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '6px',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-hard)',
        padding: '10px 14px'
      }}>
        {stages.map((stage, idx) => {
          const stepNum = idx + 1;
          const isDone = activeStage > stepNum;
          const isCurrent = activeStage === stepNum;
          const isPending = activeStage < stepNum;

          return (
            <div
              key={stage.num}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                backgroundColor: isCurrent ? 'rgba(2, 132, 199, 0.15)' : isDone ? 'rgba(16, 185, 129, 0.1)' : '#070b13',
                border: isCurrent ? '1px solid #38bdf8' : isDone ? '1px solid #059669' : '1px solid var(--border-hard)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: isCurrent ? '#38bdf8' : isDone ? '#34d399' : 'var(--text-dim)', fontWeight: 700 }}>
                  {stage.num}
                </span>
                <span style={{ color: isCurrent ? '#ffffff' : isDone ? '#e2e8f0' : 'var(--text-dim)', fontSize: '11px' }}>
                  {stage.name}
                </span>
              </div>
              <span style={{ fontSize: '10px', color: isDone ? '#34d399' : isCurrent ? '#38bdf8' : 'var(--text-dim)' }}>
                {isDone ? '✓' : isCurrent ? '■' : '·'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error Alert if any */}
      {errorMessage && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '12px 16px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertOctagon size={16} color="#ef4444" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Two-Column Stage & Audit View (Matching Image 4) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Left Column: Security Parameter & Stage Audit */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff' }}>
              SECURITY PARAMETER &amp; STAGE AUDIT
            </div>
            <span style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              LIVE TELEMETRY
            </span>
          </div>

          {/* Mode Selector Tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setDecryptMode('envelope_file')}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                backgroundColor: decryptMode === 'envelope_file' ? '#0a1d2e' : 'transparent',
                border: decryptMode === 'envelope_file' ? '1px solid #0284c7' : '1px solid var(--border-hard)',
                color: decryptMode === 'envelope_file' ? '#38bdf8' : 'var(--text-dim)',
                cursor: 'pointer',
                fontWeight: decryptMode === 'envelope_file' ? 700 : 500
              }}
            >
              DECRYPT UPLOADED .ENC PACKAGE
            </button>
            <button
              onClick={() => setDecryptMode('repository')}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                backgroundColor: decryptMode === 'repository' ? '#0a1d2e' : 'transparent',
                border: decryptMode === 'repository' ? '1px solid #0284c7' : '1px solid var(--border-hard)',
                color: decryptMode === 'repository' ? '#38bdf8' : 'var(--text-dim)',
                cursor: 'pointer',
                fontWeight: decryptMode === 'repository' ? 700 : 500
              }}
            >
              DECRYPT REPOSITORY DOCUMENT
            </button>
          </div>

          {/* Mode 1: Encrypted File Upload Input */}
          {decryptMode === 'envelope_file' ? (
            <div style={{
              border: '1px dashed var(--border-hard)',
              padding: '16px',
              backgroundColor: '#070b13',
              textAlign: 'center'
            }}>
              <input
                type="file"
                id="enc-file-input"
                accept=".enc,.json"
                onChange={handleEncFileUpload}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="enc-file-input"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#0a1d2e',
                  border: '1px solid #0284c7',
                  color: '#38bdf8',
                  padding: '8px 16px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginBottom: '10px'
                }}
              >
                <Upload size={14} />
                SELECT .ENC PACKAGE TO DECRYPT
              </label>

              {uploadedEncFile ? (
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#ffffff', marginTop: '6px' }}>
                  FILE LOADED: <span style={{ color: '#38bdf8' }}>{uploadedEncFile.name}</span> ({(uploadedEncFile.size / 1024).toFixed(1)} KB)
                  {parsedEnvelope && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>
                      Target: DOC-{parsedEnvelope.document_id} &bull; Authorized Envelopes: {parsedEnvelope.envelopes?.length || 0}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Upload the .enc package generated during document distribution
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
                SELECT CLASSIFIED REPOSITORY ASSET:
              </div>
              <select
                value={selectedDocId || ''}
                onChange={e => setSelectedDocId(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#070b13',
                  border: '1px solid var(--border-hard)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {documents.length === 0 ? (
                  <option value="" disabled>No documents in repository. Ingest a document in Encryption Lab or upload a .enc package above.</option>
                ) : (
                  documents.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      DOC-{doc.id}: {doc.file_name} ({(doc.size_bytes / 1024).toFixed(1)} KB)
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Recipient Identity Selection */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                DECRYPTING AS RECIPIENT IDENTITY:
              </div>
              {selectedOfficer && (
                <span style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  color: isRecipientInEnvelope() ? '#34d399' : '#f87171',
                  fontWeight: 700
                }}>
                  {isRecipientInEnvelope() ? '■ ENVELOPE PERMITTED' : '⚠ KEY NOT IN ENVELOPE'}
                </span>
              )}
            </div>

            <select
              value={selectedRecipientId || ''}
              onChange={e => setSelectedRecipientId(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 10px',
                backgroundColor: '#070b13',
                border: '1px solid var(--border-hard)',
                color: '#ffffff',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {officers.map(officer => (
                <option key={officer.id} value={officer.id}>
                  {officer.name} ({officer.navy_id}) — {officer.rank} [{officer.clearance_level}]
                </option>
              ))}
            </select>
          </div>

          {/* Cryptographic Telemetry Parameters (Matching Image 4) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#070b13',
            border: '1px solid var(--border-hard)',
            padding: '14px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}>
            <div>
              <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginBottom: '2px' }}>
                AUTHORIZED RECIPIENT BINDING
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>
                  {selectedOfficer ? `${selectedOfficer.navy_id} - ${selectedOfficer.name}` : 'Unselected'}
                </span>
                <span style={{ color: '#34d399', fontSize: '10px' }}>
                  {selectedOfficer?.clearance_level || 'VERIFIED'}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #141f32', paddingTop: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginBottom: '2px' }}>
                POST-QUANTUM CRYPTOGRAPHIC ENGINE
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Kyber / ML-KEM-768 Shared Key Decapsulation (FIPS 203)</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>ARMED</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #141f32', paddingTop: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginBottom: '2px' }}>
                DYNAMIC WATERMARK INSERTION
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>2D DCT Multi-Band Frequency Transform (Blind Extraction)</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>READY</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #141f32', paddingTop: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginBottom: '2px' }}>
                DUAL POST-QUANTUM ENDORSEMENT
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>ML-DSA-65 Recipient Sign (NIST FIPS 204)</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>VERIFIED</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #141f32', paddingTop: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginBottom: '2px' }}>
                LOCAL TRANSACTION BROADCAST STATE
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Tamper-Evident SHA3-256 Hash Chain Ledger</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>SYNCHRONIZED</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleExecuteDecrypt}
            disabled={isDecrypting || (!uploadedEncFile && decryptMode === 'envelope_file')}
            style={{
              padding: '14px',
              backgroundColor: isDecrypting ? '#1e293b' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              letterSpacing: '0.04em',
              cursor: isDecrypting || (!uploadedEncFile && decryptMode === 'envelope_file') ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {isDecrypting ? (
              <>
                <RefreshCw size={15} className="spin" />
                <span>EXECUTING STAGE 0{activeStage}: CRYPTOGRAPHIC DECAPSULATION...</span>
              </>
            ) : (
              <>
                <Key size={15} />
                <span>EXECUTE POST-QUANTUM DECRYPTION</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Decryption Complete & Sealed Audit (Matching Image 4) */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff' }}>
              DECRYPTION COMPLETE
            </div>
            <span style={{
              fontSize: '10px',
              color: decryptionResult ? '#34d399' : 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700
            }}>
              {decryptionResult ? 'SEALED AUDIT ATTESTED' : 'AWAITING PIPELINE'}
            </span>
          </div>

          {decryptionResult ? (
            <>
              {/* Detailed Sealed Audit Fields */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #141f32', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Document:</span>
                  <span style={{ color: '#ffffff', fontWeight: 700 }}>DOC-{decryptionResult.document_id}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #141f32', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Recipient:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                    {decryptionResult.recipient_name} ({decryptionResult.recipient_navy_id})
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #141f32', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Session ID:</span>
                  <span style={{ color: '#94a3b8' }}>{decryptionResult.session_nonce.slice(0, 16)}...</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #141f32', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Watermark ID:</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>{decryptionResult.watermark_id}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #141f32', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Signature:</span>
                  <span style={{ color: '#38bdf8' }}>Valid (ML-DSA-65 NIST FIPS 204)</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #141f32', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Ledger Status:</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>
                    Committed to Local Block #{decryptionResult.ledger_block_index}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #141f32', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Block Hash:</span>
                  <span style={{ color: 'var(--text-muted)' }}>{decryptionResult.ledger_block_hash.slice(0, 20)}...</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #141f32', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Timestamp:</span>
                  <span style={{ color: '#ffffff' }}>{decryptionResult.timestamp}</span>
                </div>

                <div style={{ borderTop: '1px solid #141f32', paddingTop: '8px' }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>CRYPTO CHECKSUM (SHA3-256 ROOT):</span>
                  <div style={{
                    color: '#94a3b8',
                    fontSize: '10px',
                    wordBreak: 'break-all',
                    backgroundColor: '#070b13',
                    padding: '6px',
                    marginTop: '4px',
                    border: '1px solid var(--border-hard)'
                  }}>
                    {decryptionResult.ml_dsa_signature_preview || decryptionResult.watermark_hex.slice(0, 64)}
                  </div>
                </div>
              </div>

              {/* Post-Commit Operational Actions (Matching Image 4) */}
              <div style={{
                marginTop: '10px',
                borderTop: '1px solid var(--border-hard)',
                paddingTop: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  POST-COMMIT OPERATIONAL GATES:
                </div>

                <button
                  onClick={() => ApiClient.downloadWatermarkedPdf(
                    decryptionResult.event_id,
                    `CIPHERTRACE_DOC_${decryptionResult.document_id}_${decryptionResult.recipient_navy_id}.pdf`
                  )}
                  style={{
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Download size={15} />
                  <span>RELEASE &amp; DOWNLOAD WATERMARKED PDF</span>
                </button>

                <button
                  onClick={() => ApiClient.downloadEvidencePackage(decryptionResult.event_id)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-hard)',
                    color: 'var(--text-dim)',
                    padding: '8px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <FileCheck size={13} />
                  <span>EXPORT SEALED AUDIT (.JSON / .SIG)</span>
                </button>
              </div>

              <div style={{
                fontSize: '10px',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                backgroundColor: '#070b13',
                padding: '10px',
                border: '1px solid var(--border-hard)',
                lineHeight: '1.4'
              }}>
                ℹ <strong>FORENSIC NOTICE:</strong> This document contains an invisible 2D DCT steganographic watermark permanently bound to <strong>{decryptionResult.recipient_name}</strong>. If printed, screenshotted, or leaked, the Evidence console can extract and attribute the exact source.
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)'
            }}>
              <Key size={36} color="var(--text-dim)" style={{ opacity: 0.3, marginBottom: '16px' }} />
              <div style={{ color: '#ffffff', fontWeight: 700, marginBottom: '6px' }}>
                SEALED AUDIT AWAITING PIPELINE EXECUTION
              </div>
              <div style={{ maxWidth: '320px', lineHeight: '1.5' }}>
                Select or upload your .enc package on the left and execute post-quantum decryption. Once verified against the blockchain ledger, the watermarked document will be released here.
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
