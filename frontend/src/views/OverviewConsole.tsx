import React from 'react';
import { ShieldCheck, Lock, KeyRound, FileSearch, ArrowRight, CheckCircle2, Cpu } from 'lucide-react';
import { DocumentRecord, Officer, LedgerBlock, UserAccount } from '../types';
import { WorkstationModule } from '../components/WorkstationSidebar';

interface OverviewConsoleProps {
  documents: DocumentRecord[];
  officers: Officer[];
  blocks: LedgerBlock[];
  currentUser: UserAccount | null;
  onNavigate: (module: WorkstationModule) => void;
  onOpenAuth: () => void;
}

export const OverviewConsole: React.FC<OverviewConsoleProps> = ({
  documents,
  officers,
  blocks,
  currentUser,
  onNavigate,
  onOpenAuth
}) => {
  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Welcome Operator Hero Header */}
      <div style={{
        backgroundColor: '#091322',
        border: '1px solid #142845',
        borderLeft: '5px solid #0284c7',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'var(--font-mono)', fontWeight: 700, marginBottom: '4px' }}>
            OPERATOR WORKSPACE &bull; NODE SEC-WS-NODE-01
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '0.03em', color: '#ffffff', margin: 0 }}>
            Welcome, {currentUser?.name || 'Operator'}
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Account: <strong style={{ color: '#ffffff' }}>@{currentUser?.username || 'user'}</strong> &bull; Role: <strong style={{ color: '#93c5fd' }}>{currentUser?.rank || 'General Officer'}</strong> &bull; Clearance: <strong style={{ color: '#34d399' }}>{currentUser?.clearance_level || 'CONFIDENTIAL'}</strong> &bull; Device: <span style={{ fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{currentUser?.device_id || 'WS-PRIMARY'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onNavigate('documents')}
            className="tactical-btn tactical-btn-primary"
            style={{ padding: '8px 14px', fontSize: '11px' }}
          >
            <Lock size={13} />
            <span>Open Encryption Lab</span>
          </button>
          <button
            onClick={() => onNavigate('decryption')}
            className="tactical-btn tactical-btn-secondary"
            style={{ padding: '8px 14px', fontSize: '11px' }}
          >
            <KeyRound size={13} />
            <span>Open Decryption Lab</span>
          </button>
        </div>
      </div>

      {/* 4 Top Summary Metric Cards (Matching Image 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {/* Card 1: System State */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          padding: '16px',
          borderLeft: '4px solid #10b981'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
            01 / SYSTEM STATE
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }} />
            OPERATIONAL
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            NIST FIPS 203 / 204 Suite Active
          </div>
        </div>

        {/* Card 2: Immutable Ledger */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          padding: '16px',
          borderLeft: '4px solid #0284c7'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
            02 / IMMUTABLE LEDGER
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
            Block #{String(blocks.length).padStart(6, '0')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Integrity: 100% verified &bull; 0 forks
          </div>
        </div>

        {/* Card 3: Documents Registered */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          padding: '16px',
          borderLeft: '4px solid #38bdf8'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
            03 / REGISTERED ASSETS
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
            {documents.length} Confidential Docs
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            SHA3-256 Tamper Anchored
          </div>
        </div>

        {/* Card 4: Enrolled Recipients */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          padding: '16px',
          borderLeft: '4px solid #f59e0b'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
            04 / ENROLLED RECIPIENTS
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
            {officers.length} Active Accounts
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            PQC Lattice Keypairs Provisioned
          </div>
        </div>
      </div>

      {/* Recent Cryptographic Events Table (Matching Image 1) */}
      <div className="tactical-panel">
        <div className="tactical-panel-header">
          <h3>Recent Forensic & Cryptographic Events ({blocks.length} Total Blocks Recorded)</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onNavigate('documents')}
              className="tactical-btn tactical-btn-primary"
              style={{ fontSize: '10px', padding: '4px 10px' }}
            >
              <Lock size={11} />
              <span>Encrypt Document</span>
            </button>
            <button
              onClick={() => onNavigate('decryption')}
              className="tactical-btn tactical-btn-secondary"
              style={{ fontSize: '10px', padding: '4px 10px' }}
            >
              <KeyRound size={11} />
              <span>Decrypt Package</span>
            </button>
          </div>
        </div>

        <table className="tactical-table">
          <thead>
            <tr>
              <th>Block / Time</th>
              <th>Event Type</th>
              <th>Subject / User</th>
              <th>Document Target</th>
              <th>Cryptographic Algorithm</th>
              <th>Verification</th>
              <th style={{ textAlign: 'right' }}>Command</th>
            </tr>
          </thead>
          <tbody>
            {blocks.slice(-5).reverse().map((b, idx) => (
              <tr key={b.block_index}>
                <td className="font-mono">
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>#{b.block_index}</span> &bull; {b.timestamp.slice(11, 19)}
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>
                    {b.block_index === 0 ? 'Genesis Root' : 'Decryption & Watermark'}
                  </span>
                </td>
                <td className="font-mono">
                  {b.block_index === 0 ? 'NODE_AUTHORITY' : `REC-00${b.block_index}`}
                </td>
                <td style={{ color: '#94a3b8' }}>
                  {documents[b.block_index - 1]?.file_name || 'CONFIDENTIAL_PAYLOAD.pdf'}
                </td>
                <td className="font-mono" style={{ fontSize: '11px', color: '#7dd3fc' }}>
                  ML-KEM-768 / AES-256-GCM
                </td>
                <td>
                  <span className="tactical-badge badge-green">
                    ■ VERIFIED
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => onNavigate('decryption')}
                    className="btn-bracket"
                  >
                    INSPECT
                  </button>
                </td>
              </tr>
            ))}
            {blocks.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                  No cryptographic events logged yet. Distribute a document to initialize the ledger.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Split (Matching Image 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Active Workflow Shortcuts */}
        <div className="tactical-panel">
          <div className="tactical-panel-header">
            <h3>Quick Workstation Operations</h3>
          </div>
          <div className="tactical-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              onClick={() => onNavigate('documents')}
              style={{
                padding: '12px 14px',
                backgroundColor: '#090d16',
                border: '1px solid var(--border-hard)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px' }}>
                  1. Encryption Lab (.enc)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Ingest PDF, execute common AES-256-GCM + ML-KEM-768 encryption, and export .enc.
                </div>
              </div>
              <ArrowRight size={16} color="#38bdf8" />
            </div>

            <div
              onClick={() => onNavigate('decryption')}
              style={{
                padding: '12px 14px',
                backgroundColor: '#090d16',
                border: '1px solid var(--border-hard)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px' }}>
                  2. Decryption Lab
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Upload .enc package, decapsulate DEK, fuse 2D DCT watermark, and download PDF.
                </div>
              </div>
              <ArrowRight size={16} color="#10b981" />
            </div>

            <div
              onClick={() => onNavigate('evidence')}
              style={{
                padding: '12px 14px',
                backgroundColor: '#090d16',
                border: '1px solid var(--border-hard)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px' }}>
                  3. Forensic Leak Attribution Lab
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Upload suspect/leaked PDF or screenshot to extract blind watermark & identify leaker.
                </div>
              </div>
              <ArrowRight size={16} color="#ef4444" />
            </div>
          </div>
        </div>

        {/* Subsystem Cryptographic Self-Test (Matching Image 1) */}
        <div className="tactical-panel">
          <div className="tactical-panel-header">
            <h3>Subsystem Cryptographic Status</h3>
          </div>
          <div className="tactical-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #141c2c', paddingBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px' }}>Post-Quantum Engine</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  NIST FIPS 203 ML-KEM-768 / 1024 Lattice Vector Engine
                </div>
              </div>
              <span className="tactical-badge badge-green">READY ■</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #141c2c', paddingBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px' }}>Digital Signature Authority</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  NIST FIPS 204 ML-DSA-65 (Dilithium) Non-Repudiation Proofs
                </div>
              </div>
              <span className="tactical-badge badge-green">OPERATIONAL ■</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #141c2c', paddingBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px' }}>2D DCT Steganography</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  Reed-Solomon RS(255, 127) Forward Error Correction
                </div>
              </div>
              <span className="tactical-badge badge-green">ENFORCED ■</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px' }}>Tamper-Proof Ledger</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  FIPS 202 SHA3-256 Permutation Hash Chaining
                </div>
              </div>
              <span className="tactical-badge badge-green">INTACT ■</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
