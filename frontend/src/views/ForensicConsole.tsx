import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { ForensicAnalysisResult } from '../types';
import { Search, ShieldAlert, CheckCircle2, XCircle, Download, FileSearch, AlertOctagon } from 'lucide-react';

export const ForensicConsole: React.FC = () => {
  const [suspectFile, setSuspectFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ForensicAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSuspectFile(file);
      setAnalysisResult(null);
      setErrorMessage(null);
    }
  };

  const handleRunAnalysis = async () => {
    if (!suspectFile) {
      setErrorMessage("No suspect leaked document selected for ingestion.");
      return;
    }

    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setAnalysisResult(null);

      const res = await ApiClient.analyzeLeakedDocument(suspectFile);
      setAnalysisResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || "Forensic analysis pipeline failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="tactical-badge badge-red">STAGE 3</span>
          <span className="tactical-badge badge-slate">2D DCT FREQUENCY LATTICE EXTRACTION</span>
          <span className="tactical-badge badge-slate">REED-SOLOMON (255, 127) ECC</span>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.03em', color: '#ffffff' }}>
          BLIND FORENSIC EXTRACTION & LEAK ATTRIBUTION LAB
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
          Upload leaked or suspect confidential documents. The engine extracts the frequency-domain watermark, resolves the immutable ledger record, and authenticates the recipient's post-quantum signature.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="tactical-alert tactical-alert-danger" style={{ marginBottom: '20px' }}>
          <AlertOctagon size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <strong>FORENSIC LAB EXCEPTION:</strong> {errorMessage}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '20px' }}>
        {/* Left Column: Suspect Ingestion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="tactical-panel">
            <div className="tactical-panel-header">
              <h3>Suspect Document Ingestion</h3>
            </div>
            <div className="tactical-panel-body">
              <label 
                style={{
                  display: 'block',
                  border: '1px dashed var(--border-active)',
                  padding: '30px 20px',
                  textAlign: 'center',
                  backgroundColor: '#090d15',
                  cursor: 'pointer'
                }}
              >
                <FileSearch size={36} color="#ef4444" style={{ margin: '0 auto 10px' }} />
                {suspectFile ? (
                  <>
                    <div style={{ fontWeight: 700, color: '#ffffff', wordBreak: 'break-all' }}>{suspectFile.name}</div>
                    <div className="font-mono" style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>
                      {(suspectFile.size / 1024).toFixed(1)} KB &bull; Ingested
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 700, color: '#ffffff' }}>Select / Drop Leaked File</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Supports: PDF, Screen Captures (JPG/PNG), Cropped Documents
                    </div>
                  </>
                )}
                <input type="file" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf" style={{ display: 'none' }} />
              </label>

              <div style={{ marginTop: '16px' }}>
                <button
                  className="tactical-btn tactical-btn-danger"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing || !suspectFile}
                  style={{ width: '100%', padding: '14px', fontSize: '13px' }}
                >
                  <Search size={16} />
                  <span>
                    {isAnalyzing 
                      ? 'EXECUTING 2D DCT FREQUENCY DECODING...' 
                      : suspectFile 
                      ? `ANALYZE ${suspectFile.name.toUpperCase()}` 
                      : 'INGEST SUSPECT FILE TO BEGIN'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Verification Gates Reference */}
          <div className="tactical-panel">
            <div className="tactical-panel-header">
              <h3>The 6 Cryptographic Verification Gates</h3>
            </div>
            <div className="tactical-panel-body" style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div><strong>Gate 1:</strong> Watermark Payload Format & RS Parity Valid</div>
              <div><strong>Gate 2:</strong> Decryption Session Exists in Immutable Ledger</div>
              <div><strong>Gate 3:</strong> NIST FIPS 204 ML-DSA-65 Signature Authenticity</div>
              <div><strong>Gate 4:</strong> Ledger Merkle Root Inclusion Proof Valid</div>
              <div><strong>Gate 5:</strong> Original Document SHA3-256 Digest Match</div>
              <div><strong>Gate 6:</strong> Distributed Consensus Hash Chaining Intact</div>
            </div>
          </div>
        </div>

        {/* Right Column: Attribution Results Dossier */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {analysisResult ? (
            <div className="tactical-panel" style={{ borderLeft: `4px solid ${analysisResult.status === 'IDENTIFIED' ? '#10b981' : '#ef4444'}` }}>
              <div className="tactical-panel-header" style={{ backgroundColor: analysisResult.status === 'IDENTIFIED' ? '#071813' : '#1c0f13' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ color: analysisResult.status === 'IDENTIFIED' ? '#6ee7b7' : '#fca5a5' }}>
                    {analysisResult.status === 'IDENTIFIED' ? 'POSITIVE ATTRIBUTION CONFIRMED' : 'ATTRIBUTION FAILED'}
                  </h3>
                  <span className={`tactical-badge ${analysisResult.status === 'IDENTIFIED' ? 'badge-green' : 'badge-red'}`}>
                    CONFIDENCE: {analysisResult.overall_confidence}%
                  </span>
                </div>

                {analysisResult.decryption_event && (
                  <button
                    className="tactical-btn tactical-btn-secondary"
                    onClick={() => ApiClient.downloadEvidencePackage(analysisResult.decryption_event!.event_id)}
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    <Download size={13} />
                    <span>Export Evidence JSON</span>
                  </button>
                )}
              </div>

              <div className="tactical-panel-body">
                {/* Identified Leaker Card */}
                {analysisResult.recipient && (
                  <div style={{ backgroundColor: '#090d15', border: '1px solid var(--border-hard)', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Attributed Recipient & Device Identifier
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NAME & ROLE:</div>
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '14px' }}>
                          {analysisResult.recipient.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#38bdf8' }}>{analysisResult.recipient.rank}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>USER ACCOUNT ID:</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: '#ffffff' }}>
                          {analysisResult.recipient.navy_id}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{analysisResult.recipient.command_unit}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>REGISTERED DEVICE TOKEN:</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: '#ef4444' }}>
                          {analysisResult.recipient.device_id}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ACCESS LEVEL: {analysisResult.recipient.clearance_level}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Narrative Summary */}
                <div style={{ backgroundColor: '#060910', border: '1px solid #141c2d', padding: '12px', fontSize: '12px', color: 'var(--text-main)', marginBottom: '16px' }}>
                  {analysisResult.analysis_narrative}
                </div>

                {/* The 6 Verification Gates Checklist */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Cryptographic Verification Gate Audit
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {[
                      { label: 'Gate 1: Watermark Payload Format & RS Parity', ok: analysisResult.verification_gates.watermark_valid },
                      { label: 'Gate 2: Decryption Session Ledger Presence', ok: analysisResult.verification_gates.ledger_event_exists },
                      { label: 'Gate 3: NIST FIPS 204 ML-DSA-65 Signature', ok: analysisResult.verification_gates.ml_dsa_signature_valid },
                      { label: 'Gate 4: Merkle Root Inclusion Verification', ok: analysisResult.verification_gates.merkle_inclusion_valid },
                      { label: 'Gate 5: Document SHA3-256 Digest Verification', ok: analysisResult.verification_gates.document_hash_match },
                      { label: 'Gate 6: Distributed Ledger Hash Chain Integrity', ok: analysisResult.verification_gates.ledger_chain_integrity }
                    ].map(g => (
                      <div
                        key={g.label}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: g.ok ? '#081712' : '#1c0f13',
                          border: g.ok ? '1px solid #065f46' : '1px solid #7f1d1d',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '11px'
                        }}
                      >
                        <span style={{ color: g.ok ? '#e2e8f0' : '#fca5a5' }}>{g.label}</span>
                        {g.ok ? (
                          <span className="tactical-badge badge-green">PASS</span>
                        ) : (
                          <span className="tactical-badge badge-red">FAIL</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Steganography Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '11px' }}>
                  <div style={{ backgroundColor: '#090d15', padding: '10px', border: '1px solid var(--border-hard)' }}>
                    <div style={{ color: 'var(--text-dim)' }}>RECOVERED PAYLOAD:</div>
                    <div className="font-mono" style={{ color: '#6ee7b7' }}>{analysisResult.extracted_payload_hex || 'N/A'}</div>
                  </div>
                  <div style={{ backgroundColor: '#090d15', padding: '10px', border: '1px solid var(--border-hard)' }}>
                    <div style={{ color: 'var(--text-dim)' }}>BIT ERROR RATE (BER):</div>
                    <div className="font-mono" style={{ color: '#38bdf8' }}>{analysisResult.bit_error_rate.toFixed(2)}%</div>
                  </div>
                  <div style={{ backgroundColor: '#090d15', padding: '10px', border: '1px solid var(--border-hard)' }}>
                    <div style={{ color: 'var(--text-dim)' }}>ECC RECOVERY:</div>
                    <div className="font-mono" style={{ color: '#ffffff' }}>{analysisResult.payload_recovery_pct.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="tactical-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Awaiting Suspect Document Ingestion
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
                Select a leaked file on the left and execute the forensic pipeline to view cryptographic attribution.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
