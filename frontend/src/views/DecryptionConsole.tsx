import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { Officer, DocumentRecord, DecryptionResult, UserAccount } from '../types';
import { Upload, Key, FileCheck, Download, AlertOctagon, RefreshCw } from 'lucide-react';

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
  onOpenAuth: _onOpenAuth
}) => {
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [keystorePassword, setKeystorePassword] = useState('');

  // File upload state
  const [uploadedEncFile, setUploadedEncFile] = useState<File | null>(null);
  const [parsedEnvelope, setParsedEnvelope] = useState<any | null>(null);

  // Execution states
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [activeStage, setActiveStage] = useState<number>(0);
  const [decryptionResult, setDecryptionResult] = useState<DecryptionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Strictly bind recipient identity to the currently authenticated operator session
  useEffect(() => {
    if (currentUser) {
      const match = officers.find(o => o.username === currentUser.username || o.navy_id === currentUser.navy_id || o.id === currentUser.id);
      if (match) {
        setSelectedRecipientId(match.id);
      } else if (currentUser.id) {
        setSelectedRecipientId(currentUser.id);
      }
    }
  }, [currentUser, officers]);

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

      // Stage progression animation
      setActiveStage(2);
      await new Promise(r => setTimeout(r, 120));
      setActiveStage(3);

      if (!uploadedEncFile) {
        setErrorMessage("Please upload an encrypted .enc package file first.");
        setIsDecrypting(false);
        setActiveStage(0);
        return;
      }
      const result = await ApiClient.decryptEnvelopeFile(uploadedEncFile, selectedRecipientId, undefined, keystorePassword);

      // Finish stages
      setActiveStage(4);
      await new Promise(r => setTimeout(r, 150));
      setActiveStage(5);
      await new Promise(r => setTimeout(r, 150));
      setActiveStage(6);
      await new Promise(r => setTimeout(r, 150));
      setActiveStage(7);

      setDecryptionResult(result);
      setKeystorePassword('');
      if (onDecryptionSuccess) onDecryptionSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Decryption failed. Recipient may not be authorized for this document.');
      setActiveStage(0);
    } finally {
      setIsDecrypting(false);
    }
  };

  const selectedOfficer = officers.find(o => o.id === selectedRecipientId) || (currentUser ? (currentUser as unknown as Officer) : undefined);

  // Check if selected recipient is authorized in parsed envelope
  const isRecipientInEnvelope = () => {
    if (!parsedEnvelope) return true;
    const envList = parsedEnvelope.recipients || parsedEnvelope.envelopes;
    if (!envList || !Array.isArray(envList)) return true;
    return envList.some((env: any) => 
      env.recipient_id === selectedRecipientId || 
      (currentUser && env.username === currentUser.username) ||
      (currentUser && env.navy_id === currentUser.navy_id)
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 7-Step Pipeline Breadcrumb Bar */}
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

          return (
            <div
              key={stage.num}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                backgroundColor: isCurrent ? 'rgba(56, 189, 248, 0.12)' : isDone ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-input)',
                border: isCurrent ? '1px solid #38bdf8' : isDone ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-hard)',
                borderRadius: '3px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: isCurrent ? '#38bdf8' : isDone ? '#34d399' : 'var(--text-dim)', fontWeight: 700 }}>
                  {stage.num}
                </span>
                <span style={{ color: isCurrent ? '#38bdf8' : isDone ? '#34d399' : 'var(--text-dim)', fontSize: '11px' }}>
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
        <div className="tactical-alert tactical-alert-danger">
          <AlertOctagon size={16} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Main Two-Column Stage & Audit View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Left Column: Security Parameter & Stage Audit */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          borderRadius: '4px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              SECURITY PARAMETER &amp; STAGE AUDIT
            </div>
            <span style={{ fontSize: '10px', color: '#34d399', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              LIVE TELEMETRY
            </span>
          </div>

          {/* Encrypted Package File Upload Input */}
          <div style={{
            border: '1px dashed var(--border-hard)',
            padding: '20px 16px',
            backgroundColor: 'var(--bg-input)',
            textAlign: 'center',
            borderRadius: '4px'
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
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                padding: '9px 18px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: '3px',
                marginBottom: '10px'
              }}
            >
              <Upload size={14} />
              SELECT .ENC PACKAGE TO DECRYPT
            </label>

            {uploadedEncFile ? (
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#38bdf8', marginTop: '6px' }}>
                FILE LOADED: <span style={{ color: '#ffffff', fontWeight: 600 }}>{uploadedEncFile.name}</span> ({(uploadedEncFile.size / 1024).toFixed(1)} KB)
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

          {/* Recipient Identity Section - Bound to Authenticated Session */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                DECRYPTING AS RECIPIENT IDENTITY:
              </div>
              {selectedOfficer && (
                <span style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  color: isRecipientInEnvelope() ? '#10b981' : '#f87171',
                  fontWeight: 700
                }}>
                  {isRecipientInEnvelope() ? '■ ENVELOPE PERMITTED' : '⚠ KEY NOT IN ENVELOPE'}
                </span>
              )}
            </div>

            {/* Authenticated Operator Identity Badge (Strictly Locked) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-input)',
              border: isRecipientInEnvelope() ? '1px solid var(--border-hard)' : '1px solid #7f1d1d',
              borderLeft: isRecipientInEnvelope() ? '4px solid #10b981' : '4px solid #ef4444',
              borderRadius: '4px',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  flexShrink: 0
                }}>
                  {selectedOfficer?.name ? selectedOfficer.name.charAt(0).toUpperCase() : (currentUser?.name?.charAt(0) || 'U')}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedOfficer?.name || currentUser?.name || 'Authenticated User'} ({selectedOfficer?.navy_id || currentUser?.navy_id || 'ID-PENDING'})
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                    ACCOUNT: <span style={{ color: '#38bdf8' }}>@{currentUser?.username || 'user'}</span> &bull; STATUS: <span style={{ color: '#10b981' }}>ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>

            {!isRecipientInEnvelope() && (
              <div style={{
                marginTop: '6px',
                padding: '6px 10px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                borderRadius: '3px'
              }}>
                ⚠ ACCESS RESTRICTED: The uploaded package does not contain a post-quantum key envelope for @{currentUser?.username}. Log into the authorized recipient's account to decrypt.
              </div>
            )}
          </div>

          {/* Keystore Passcode - unlocks the recipient's ML-KEM-768 / ML-DSA-65 private keys */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                KEYSTORE PASSCODE (16-BIT PSEUDORANDOM VALUE):
              </div>
              {currentUser?.keystore_password && (
                <button
                  type="button"
                  onClick={() => setKeystorePassword(currentUser.keystore_password || '')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Auto-Fill My Passcode ({currentUser.keystore_password})
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. 0x7B4E"
              autoComplete="off"
              value={keystorePassword}
              onChange={e => setKeystorePassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !isDecrypting) handleExecuteDecrypt(); }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-hard)',
                color: '#ffffff',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                borderRadius: '3px'
              }}
            />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Find your unique 16-bit passcode under the <strong>Account Management</strong> tab.
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleExecuteDecrypt}
            disabled={isDecrypting || !uploadedEncFile}
            style={{
              padding: '14px',
              backgroundColor: isDecrypting ? '#1e293b' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              letterSpacing: '0.04em',
              cursor: isDecrypting || !uploadedEncFile ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              borderRadius: '3px'
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

        {/* Right Column: Decryption Complete & Sealed Audit */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          borderRadius: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: '#38bdf8' }}>
              DECRYPTION COMPLETE
            </div>
            <span style={{
              fontSize: '10px',
              color: decryptionResult ? '#10b981' : 'var(--text-dim)',
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
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Document:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>DOC-{decryptionResult.document_id}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Recipient:</span>
                  <span style={{ color: '#ffffff', fontWeight: 700 }}>
                    {decryptionResult.recipient_name} ({decryptionResult.recipient_navy_id})
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Session ID:</span>
                  <span style={{ color: '#38bdf8' }}>{decryptionResult.session_nonce.slice(0, 16)}...</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Watermark ID:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{decryptionResult.watermark_id}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Signature:</span>
                  <span style={{ color: '#10b981' }}>Valid (ML-DSA-65 NIST FIPS 204)</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Ledger Status:</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>
                    Committed to Local Block #{decryptionResult.ledger_block_index}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Block Hash:</span>
                  <span style={{ color: 'var(--text-muted)' }}>{decryptionResult.ledger_block_hash.slice(0, 20)}...</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hard)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Timestamp:</span>
                  <span style={{ color: 'var(--text-main)' }}>{decryptionResult.timestamp}</span>
                </div>

                <div style={{ borderTop: '1px solid var(--border-hard)', paddingTop: '8px' }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>CRYPTO CHECKSUM (SHA3-256 ROOT):</span>
                  <div style={{
                    color: '#38bdf8',
                    fontSize: '10px',
                    wordBreak: 'break-all',
                    backgroundColor: 'var(--bg-input)',
                    padding: '6px',
                    marginTop: '4px',
                    border: '1px solid var(--border-hard)',
                    borderRadius: '3px'
                  }}>
                    {decryptionResult.ml_dsa_signature_preview || decryptionResult.watermark_hex.slice(0, 64)}
                  </div>
                </div>
              </div>

              {/* Post-Commit Operational Actions */}
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
                    backgroundColor: '#0284c7',
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
                    gap: '8px',
                    borderRadius: '3px'
                  }}
                >
                  <Download size={15} />
                  <span>RELEASE &amp; DOWNLOAD WATERMARKED PDF</span>
                </button>

                <button
                  onClick={() => ApiClient.downloadEvidencePackage(decryptionResult.event_id)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    padding: '8px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    borderRadius: '3px'
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
                backgroundColor: 'var(--bg-input)',
                padding: '10px',
                border: '1px solid var(--border-hard)',
                lineHeight: '1.4',
                borderRadius: '3px'
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
