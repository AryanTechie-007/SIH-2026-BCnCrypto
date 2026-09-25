import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { Officer, DocumentRecord, DecryptionResult } from '../types';
import { ShieldCheck, ShieldAlert, Cpu, Download, CheckCircle2, Lock, Key, AlertOctagon, Upload, FileText, Check, X } from 'lucide-react';

interface RecipientConsoleProps {
  currentOperator?: Officer | null;
}

export const RecipientConsole: React.FC<RecipientConsoleProps> = ({ currentOperator }) => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<number | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  
  // Cross-device .enc file mode
  const [decryptMode, setDecryptMode] = useState<'envelope_file' | 'repository'>('envelope_file');
  const [uploadedEncFile, setUploadedEncFile] = useState<File | null>(null);
  const [parsedEnvelope, setParsedEnvelope] = useState<any | null>(null);

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [decryptionResult, setDecryptionResult] = useState<DecryptionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentOperator) {
      setSelectedOfficerId(currentOperator.id);
    }
  }, [currentOperator]);

  const loadData = async () => {
    try {
      setErrorMessage(null);
      const [uList, dList] = await Promise.all([
        ApiClient.getOfficers(),
        ApiClient.getDocuments()
      ]);
      setOfficers(uList);
      setDocuments(dList);
      if (uList.length > 0 && !selectedOfficerId) setSelectedOfficerId(uList[0].id);
      if (dList.length > 0 && !selectedDocId) setSelectedDocId(dList[0].id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize Recipient Terminal');
    }
  };

  const handleEncFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setDecryptionResult(null);
    setActiveStep(0);
    setUploadedEncFile(file);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json.format !== 'CIPHERTRACE_PQC_ENVELOPE') {
        setErrorMessage("Warning: File does not match CIPHERTRACE_PQC_ENVELOPE format. Decryption may fail.");
      }
      setParsedEnvelope(json);
    } catch {
      setParsedEnvelope(null);
      setErrorMessage("Could not parse file as JSON. Please ensure you uploaded a valid .enc envelope.");
    }
  };

  const steps = [
    { title: '1. ML-KEM-768 Decapsulation', desc: 'Validating recipient private lattice key & decapsulating ephemeral 256-bit DEK' },
    { title: '2. AES-256-GCM Decryption', desc: 'Verifying 128-bit authentication tag & recovering plaintext vector payload' },
    { title: '3. Session Formulation', desc: 'Generating non-repeatable session nonce & canonical viewing parameters' },
    { title: '4. 2D DCT Steganography', desc: 'Synthesizing HMAC-SHA3-256 watermark & modulating 150 DPI luminance lattice' },
    { title: '5. ML-DSA-65 Signature', desc: 'Recipient post-quantum key signs access event (NIST FIPS 204 non-repudiation)' },
    { title: '6. Immutable Ledger Commit', desc: 'Broadcasting signed audit proof to permissioned distributed consensus nodes' }
  ];

  const handleDecrypt = async () => {
    if (!selectedOfficerId) {
      setErrorMessage("No recipient identity selected.");
      return;
    }

    try {
      setIsDecrypting(true);
      setErrorMessage(null);
      setDecryptionResult(null);
      setActiveStep(1);

      let res: DecryptionResult;

      if (decryptMode === 'envelope_file') {
        if (!uploadedEncFile) {
          setErrorMessage("Please upload a .enc package file to decrypt.");
          setIsDecrypting(false);
          setActiveStep(0);
          return;
        }
        res = await ApiClient.decryptEnvelopeFile(uploadedEncFile, selectedOfficerId);
      } else {
        if (!selectedDocId) {
          setErrorMessage("Please select a document from the repository.");
          setIsDecrypting(false);
          setActiveStep(0);
          return;
        }
        res = await ApiClient.decryptDocument(selectedDocId, selectedOfficerId);
      }

      // Progress animation
      for (let s = 2; s <= 6; s++) {
        setActiveStep(s);
        await new Promise(r => setTimeout(r, 160));
      }

      setDecryptionResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Cryptographic enclave rejected decryption attempt.');
      setDecryptionResult(null);
      setActiveStep(0);
    } finally {
      setIsDecrypting(false);
    }
  };

  const selectedOfficer = officers.find(o => o.id === selectedOfficerId);

  // Check if selected officer is authorized in uploaded envelope
  const isOfficerAuthorizedInEnvelope = parsedEnvelope && selectedOfficer
    ? parsedEnvelope.recipients?.some((r: any) => r.recipient_id === selectedOfficer.id || r.username === selectedOfficer.username)
    : null;

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="tactical-badge badge-green">STAGE 2</span>
          <span className="tactical-badge badge-slate">ATOMIC PQC DECRYPTION</span>
          <span className="tactical-badge badge-slate">CROSS-DEVICE .ENC VERIFICATION</span>
          <span className="tactical-badge badge-slate">NON-REPUDIATION ATTESTATION</span>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.03em', color: '#ffffff' }}>
          SECURE RECIPIENT VAULT & CRYPTOGRAPHIC DECAPSULATION
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
          Decapsulate received .enc envelopes across devices using NIST ML-KEM-768 lattice keys. Each session fuses an invisible 2D DCT watermark and auto-signs a non-repudiable ML-DSA-65 audit proof.
        </p>
      </div>

      {/* Strict Access Denied / Error Alert */}
      {errorMessage && (
        <div className="tactical-alert tactical-alert-danger" style={{ marginBottom: '20px' }}>
          <AlertOctagon size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '2px', fontSize: '13px' }}>
              SECURITY ACCESS EXCEPTION
            </strong>
            <span style={{ fontSize: '12px' }}>{errorMessage}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '20px' }}>
        {/* Left Column: Operator Identity & Decryption Target */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Active Operator Selector */}
          <div className="tactical-panel">
            <div className="tactical-panel-header">
              <h3>Active Recipient Identity</h3>
            </div>
            <div className="tactical-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {officers.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', padding: '10px' }}>
                  No user accounts found. Please sign in or create an account first.
                </div>
              ) : (
                officers.map(u => {
                  const isSelected = selectedOfficerId === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedOfficerId(u.id);
                        setDecryptionResult(null);
                        setErrorMessage(null);
                        setActiveStep(0);
                      }}
                      style={{
                        padding: '12px',
                        backgroundColor: isSelected ? '#122338' : '#090d15',
                        border: isSelected ? '1px solid #0284c7' : '1px solid var(--border-hard)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? '#ffffff' : 'var(--text-muted)' }}>
                          {u.name}
                        </span>
                        <span className="tactical-badge badge-slate">{u.rank}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                        @{u.username || u.navy_id} &bull; Device: {u.device_id}
                      </div>
                      <div className="font-mono" style={{ fontSize: '10px', color: '#0284c7' }}>
                        ML-KEM: {u.ml_kem_pub_preview}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="tactical-panel">
            <div className="tactical-panel-header">
              <h3>Decryption Source Selection</h3>
            </div>
            <div className="tactical-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setDecryptMode('envelope_file'); setDecryptionResult(null); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: decryptMode === 'envelope_file' ? '#0369a1' : '#0a101d',
                    color: '#ffffff',
                    border: '1px solid var(--border-hard)',
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  UPLOAD .ENC FILE
                </button>
                <button
                  type="button"
                  onClick={() => { setDecryptMode('repository'); setDecryptionResult(null); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: decryptMode === 'repository' ? '#0369a1' : '#0a101d',
                    color: '#ffffff',
                    border: '1px solid var(--border-hard)',
                    cursor: 'pointer'
                  }}
                >
                  <FileText size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  LOCAL REPOSITORY
                </button>
              </div>

              {decryptMode === 'envelope_file' ? (
                <div>
                  <label
                    style={{
                      display: 'block',
                      border: '1px dashed var(--border-active)',
                      padding: '24px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: uploadedEncFile ? '#081726' : '#080d16'
                    }}
                  >
                    <Upload size={22} style={{ margin: '0 auto 8px', color: '#38bdf8' }} />
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                      {uploadedEncFile ? uploadedEncFile.name : 'Select or Drop .enc Package'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Portable NIST FIPS 203 Envelope (.enc)
                    </div>
                    <input
                      type="file"
                      accept=".enc,.json"
                      onChange={handleEncFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>

                  {/* Envelope Metadata Inspector */}
                  {parsedEnvelope && (
                    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#090e18', border: '1px solid var(--border-hard)', fontSize: '11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-dim)' }}>FILE:</span>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>{parsedEnvelope.file_name}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-dim)' }}>SHA3:</span>
                        <span className="font-mono" style={{ color: '#38bdf8' }}>{parsedEnvelope.sha3_256?.substring(0, 16)}...</span>
                      </div>

                      <div style={{ borderTop: '1px solid #141f32', paddingTop: '6px', marginTop: '6px' }}>
                        <div style={{ color: 'var(--text-dim)', marginBottom: '4px', fontSize: '10px' }}>
                          DESIGNATED RECIPIENTS IN ENVELOPE:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {parsedEnvelope.recipients?.map((r: any) => (
                            <span key={r.recipient_id} className="tactical-badge badge-slate" style={{ fontSize: '10px' }}>
                              {r.name || r.username} ({r.navy_id})
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Access Check Indicator */}
                      <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #141f32' }}>
                        {isOfficerAuthorizedInEnvelope ? (
                          <div style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} />
                            <span>ACCESS PERMITTED (Recipient key envelope verified)</span>
                          </div>
                        ) : (
                          <div style={{ color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={13} />
                            <span>ACCESS WILL BE REJECTED (Recipient not in envelope)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Select Document from Database
                  </label>
                  {documents.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>No documents in database. Use Stage 1 to upload & encrypt.</div>
                  ) : (
                    <select
                      value={selectedDocId || ''}
                      onChange={e => setSelectedDocId(Number(e.target.value))}
                      className="tactical-input"
                      style={{ width: '100%', padding: '8px', backgroundColor: '#090e18', color: '#ffffff' }}
                    >
                      {documents.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.file_name} ({d.sha3_hash.substring(0, 10)}...)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Action Button */}
              <button
                className="tactical-btn tactical-btn-primary"
                onClick={handleDecrypt}
                disabled={isDecrypting || (decryptMode === 'envelope_file' && !uploadedEncFile)}
                style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: '8px' }}
              >
                <Cpu size={15} />
                <span>
                  {isDecrypting
                    ? 'EXECUTING PQC DECAPSULATION...'
                    : 'DECRYPT & APPLY SECURE WATERMARK'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Decryption Sequence & Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Sequence Visualizer */}
          <div className="tactical-panel">
            <div className="tactical-panel-header">
              <h3>6-Step Atomic PQC Decryption Protocol</h3>
            </div>
            <div className="tactical-panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {steps.map((st, idx) => {
                  const stepNum = idx + 1;
                  const isDone = activeStep >= stepNum || decryptionResult !== null;
                  const isCurrent = activeStep === stepNum && !decryptionResult;

                  return (
                    <div
                      key={stepNum}
                      style={{
                        padding: '12px',
                        backgroundColor: isDone ? '#091c14' : isCurrent ? '#0d2238' : '#080d15',
                        border: isDone ? '1px solid #10b981' : isCurrent ? '1px solid #38bdf8' : '1px solid var(--border-hard)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: isDone ? '#6ee7b7' : isCurrent ? '#38bdf8' : 'var(--text-dim)' }}>
                          {st.title}
                        </span>
                        {isDone ? (
                          <CheckCircle2 size={14} color="#10b981" />
                        ) : isCurrent ? (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38bdf8', display: 'inline-block' }} />
                        ) : null}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {st.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Decryption Success & Download */}
          {decryptionResult && (
            <div className="tactical-panel" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="tactical-panel-header" style={{ backgroundColor: '#071813' }}>
                <h3 style={{ color: '#6ee7b7' }}>
                  Decryption Successful &bull; Viewing Event #{decryptionResult.event_id} Committed
                </h3>
                <button
                  className="tactical-btn tactical-btn-success"
                  onClick={() => ApiClient.downloadWatermarkedPdf(decryptionResult.event_id, `WATERMARKED_RECIPIENT_${decryptionResult.recipient_name.replace(/\s+/g, '_')}.pdf`)}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  <Download size={14} />
                  <span>Download Watermarked PDF</span>
                </button>
              </div>
              <div className="tactical-panel-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ padding: '12px', backgroundColor: '#090d15', border: '1px solid var(--border-hard)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>RECIPIENT USER</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                      {decryptionResult.recipient_name}
                    </div>
                    <div className="font-mono" style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>
                      {decryptionResult.recipient_navy_id}
                    </div>
                  </div>

                  <div style={{ padding: '12px', backgroundColor: '#090d15', border: '1px solid var(--border-hard)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>2D DCT WATERMARK ID</div>
                    <div className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                      {decryptionResult.watermark_id}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Reed-Solomon (255, 127) FEC
                    </div>
                  </div>

                  <div style={{ padding: '12px', backgroundColor: '#090d15', border: '1px solid var(--border-hard)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>LEDGER BLOCK RECORD</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                      Block #{decryptionResult.ledger_block_index}
                    </div>
                    <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px', wordBreak: 'break-all' }}>
                      {decryptionResult.ledger_block_hash.substring(0, 24)}...
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '16px', padding: '10px', backgroundColor: '#090d15', border: '1px solid var(--border-hard)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginRight: '8px' }}>NIST FIPS 204 SIGNATURE:</span>
                    <span className="font-mono" style={{ fontSize: '11px', color: '#38bdf8' }}>{decryptionResult.ml_dsa_signature_preview}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
                    NON-REPUDIABLE PROOF ATTESTED
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
