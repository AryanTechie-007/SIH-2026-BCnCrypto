import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { ForensicAnalysisResult } from '../types';
import { Search, ShieldAlert, CheckCircle2, XCircle, Download, FileSearch, AlertOctagon, RefreshCw, FileText } from 'lucide-react';

export const EvidenceConsole: React.FC = () => {
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
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header Bar */}
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
          <span style={{ color: 'var(--text-dim)' }}>FORENSIC EVALUATION LAB:</span>
          <span style={{ color: '#ffffff', fontWeight: 700 }}>2D DCT FREQUENCY DECODING</span>
          <span style={{
            backgroundColor: '#1c1917',
            color: '#f59e0b',
            border: '1px solid #78350f',
            padding: '2px 6px',
            fontSize: '9px',
            fontWeight: 700
          }}>
            REED-SOLOMON (255, 127) FEC
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--text-dim)' }}>
          <span>TARGET ENGINE: <strong style={{ color: '#38bdf8' }}>BLIND EXTRACTION</strong></span>
          <span>LEDGER ANCHOR: <strong style={{ color: '#ffffff' }}>SHA3-256</strong></span>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '12px 16px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontFamily: 'var(--font-mono)'
        }}>
          <AlertOctagon size={16} color="#ef4444" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Left Column: Suspect File Ingestion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-hard)',
            padding: '20px'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.04em',
              borderBottom: '1px solid var(--border-hard)',
              paddingBottom: '10px',
              marginBottom: '16px'
            }}>
              SUSPECT ARTIFACT INGESTION
            </div>

            <label
              style={{
                display: 'block',
                border: '1px dashed var(--border-hard)',
                padding: '28px 16px',
                textAlign: 'center',
                backgroundColor: '#070b13',
                cursor: 'pointer',
                transition: 'border-color 0.2s'
              }}
            >
              <FileSearch size={32} color="#f87171" style={{ margin: '0 auto 10px' }} />
              
              {suspectFile ? (
                <>
                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px', wordBreak: 'break-all' }}>
                    {suspectFile.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                    {(suspectFile.size / 1024).toFixed(1)} KB &bull; READY FOR SCAN
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px' }}>
                    SELECT OR DROP LEAKED FILE
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px', lineHeight: '1.4' }}>
                    Supports: Leaked PDF, Mobile Screenshots (PNG / JPG / WEBP), Cropped Scans
                  </div>
                </>
              )}
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf"
                style={{ display: 'none' }}
              />
            </label>

            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || !suspectFile}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '12px',
                backgroundColor: isAnalyzing || !suspectFile ? '#1e293b' : '#dc2626',
                color: '#ffffff',
                border: 'none',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                letterSpacing: '0.04em',
                cursor: isAnalyzing || !suspectFile ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>EXTRACTING 2D DCT FREQUENCY LATTICE...</span>
                </>
              ) : (
                <>
                  <Search size={14} />
                  <span>{suspectFile ? `EXECUTE FORENSIC ANALYSIS` : `SELECT SUSPECT FILE TO BEGIN`}</span>
                </>
              )}
            </button>
          </div>

          {/* Verification Protocol Info Card */}
          <div style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-hard)',
            padding: '16px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}>
            <div style={{ color: '#ffffff', fontWeight: 700, marginBottom: '10px', fontSize: '11px' }}>
              THE 6 CRYPTOGRAPHIC GATES:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-dim)' }}>
              <div><strong style={{ color: '#94a3b8' }}>Gate 1:</strong> Watermark &amp; RS(255,127) Parity</div>
              <div><strong style={{ color: '#94a3b8' }}>Gate 2:</strong> Decryption Session in Ledger</div>
              <div><strong style={{ color: '#94a3b8' }}>Gate 3:</strong> ML-DSA-65 Recipient Signature</div>
              <div><strong style={{ color: '#94a3b8' }}>Gate 4:</strong> Merkle Inclusion Audit Proof</div>
              <div><strong style={{ color: '#94a3b8' }}>Gate 5:</strong> Document SHA3-256 Digest Match</div>
              <div><strong style={{ color: '#94a3b8' }}>Gate 6:</strong> Hash Chain Ledger Integrity</div>
            </div>
          </div>

        </div>

        {/* Right Column: Forensic Dossier & Attribution Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {analysisResult ? (
            <div style={{
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-hard)',
              borderLeft: `4px solid ${analysisResult.status === 'IDENTIFIED' ? '#10b981' : '#ef4444'}`,
              padding: '20px'
            }}>
              {/* Card Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-hard)',
                paddingBottom: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: analysisResult.status === 'IDENTIFIED' ? '#34d399' : '#f87171'
                  }}>
                    {analysisResult.status === 'IDENTIFIED' ? 'POSITIVE ATTRIBUTION CONFIRMED' : 'ATTRIBUTION FAILED'}
                  </div>
                  <span style={{
                    backgroundColor: analysisResult.status === 'IDENTIFIED' ? '#064e3b' : '#7f1d1d',
                    color: analysisResult.status === 'IDENTIFIED' ? '#6ee7b7' : '#fca5a5',
                    padding: '2px 8px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700
                  }}>
                    CONFIDENCE: {analysisResult.overall_confidence}%
                  </span>
                </div>

                {analysisResult.decryption_event && (
                  <button
                    onClick={() => ApiClient.downloadEvidencePackage(analysisResult.decryption_event!.event_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#0a1d2e',
                      border: '1px solid #0284c7',
                      color: '#38bdf8',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={13} />
                    <span>EXPORT EVIDENCE JSON</span>
                  </button>
                )}
              </div>

              {/* Attributed Identity Box */}
              {analysisResult.recipient && analysisResult.overall_confidence > 0 && analysisResult.status !== 'UNATTRIBUTED' ? (
                <div style={{
                  backgroundColor: '#070b13',
                  border: '1px solid var(--border-hard)',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: '10px',
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    marginBottom: '10px'
                  }}>
                    ATTRIBUTED RECIPIENT &amp; DEVICE IDENTIFIER
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', fontFamily: 'var(--font-mono)' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>NAME &amp; ROLE:</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                        {analysisResult.recipient.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#38bdf8' }}>{analysisResult.recipient.rank}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>ACCOUNT IDENTIFIER:</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                        {analysisResult.recipient.navy_id}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{analysisResult.recipient.command_unit}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>REGISTERED DEVICE ID:</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#f87171', marginTop: '2px' }}>
                        {analysisResult.recipient.device_id}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>CLEARANCE: {analysisResult.recipient.clearance_level}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#0a0d14',
                  border: '1px solid #1e293b',
                  padding: '14px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    ✕
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      AUDIT STATUS: NO RECIPIENT ATTRIBUTED
                    </div>
                    <div style={{ fontSize: '12px', color: '#f87171', fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: '2px' }}>
                      All registered officers cleared (0% match). No authentic cryptographic watermark detected.
                    </div>
                  </div>
                </div>
              )}

              {/* Narrative Summary */}
              <div style={{
                backgroundColor: '#070b13',
                border: '1px solid #141f32',
                padding: '12px',
                fontSize: '12px',
                color: '#e2e8f0',
                lineHeight: '1.5',
                marginBottom: '16px',
                fontFamily: 'var(--font-mono)'
              }}>
                {analysisResult.analysis_narrative}
              </div>

              {/* The 6 Verification Gates Checklist */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '8px'
                }}>
                  CRYPTOGRAPHIC VERIFICATION GATES AUDIT:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontFamily: 'var(--font-mono)' }}>
                  {[
                    { label: 'Gate 1: Watermark & RS Parity', ok: analysisResult.verification_gates.watermark_valid },
                    { label: 'Gate 2: Decryption Session in Ledger', ok: analysisResult.verification_gates.ledger_event_exists },
                    { label: 'Gate 3: NIST FIPS 204 ML-DSA-65 Signature', ok: analysisResult.verification_gates.ml_dsa_signature_valid },
                    { label: 'Gate 4: Merkle Root Inclusion Proof', ok: analysisResult.verification_gates.merkle_inclusion_valid },
                    { label: 'Gate 5: Document SHA3-256 Digest Match', ok: analysisResult.verification_gates.document_hash_match },
                    { label: 'Gate 6: Hash Chain Ledger Integrity', ok: analysisResult.verification_gates.ledger_chain_integrity }
                  ].map(g => (
                    <div
                      key={g.label}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: g.ok ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        border: g.ok ? '1px solid #059669' : '1px solid #991b1b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px'
                      }}
                    >
                      <span style={{ color: g.ok ? '#e2e8f0' : '#fca5a5' }}>{g.label}</span>
                      <span style={{
                        color: g.ok ? '#34d399' : '#f87171',
                        fontWeight: 800,
                        fontSize: '10px'
                      }}>
                        {g.ok ? '■ PASS' : '✖ FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Telemetry */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                <div style={{ backgroundColor: '#070b13', padding: '10px', border: '1px solid var(--border-hard)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>RECOVERED PAYLOAD:</div>
                  <div style={{ color: '#34d399', fontWeight: 700, marginTop: '2px', wordBreak: 'break-all' }}>
                    {analysisResult.extracted_payload_hex || 'N/A'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#070b13', padding: '10px', border: '1px solid var(--border-hard)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>BIT ERROR RATE (BER):</div>
                  <div style={{ color: '#38bdf8', fontWeight: 700, marginTop: '2px' }}>
                    {analysisResult.bit_error_rate.toFixed(2)}%
                  </div>
                </div>

                <div style={{ backgroundColor: '#070b13', padding: '10px', border: '1px solid var(--border-hard)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>ECC RECOVERY:</div>
                  <div style={{ color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>
                    {analysisResult.payload_recovery_pct.toFixed(1)}%
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div style={{
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-hard)',
              padding: '80px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)'
            }}>
              <FileSearch size={40} color="var(--text-dim)" style={{ opacity: 0.3, marginBottom: '16px' }} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                AWAITING SUSPECT ARTIFACT INGESTION
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', maxWidth: '360px', lineHeight: '1.5' }}>
                Ingest a leaked document or mobile screen capture on the left. The forensic decoder will perform blind 2D DCT frequency extraction, match against the immutable ledger, and display positive user attribution here.
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
