import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { LedgerBlock } from '../types';
import { 
  Database, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCcw, 
  GitCommit, 
  Lock, 
  Users,
  Copy
} from 'lucide-react';

export const LedgerDashboard: React.FC = () => {
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [isTampered, setIsTampered] = useState(false);
  const [tamperMessage, setTamperMessage] = useState<string | null>(null);

  const loadLedger = async () => {
    const blks = await ApiClient.getLedgerBlocks();
    setBlocks([...blks]);
    setIsTampered(blks.some(b => b.isTampered));
  };

  useEffect(() => {
    loadLedger();
  }, []);

  const handleSimulateTamper = async () => {
    // Tamper the latest non-genesis block or block 1
    const targetIdx = blocks.length > 1 ? 1 : 0;
    await ApiClient.tamperLedgerRecord(targetIdx);
    setTamperMessage('Simulated Insider Rogue Administrator modified Block #1 signature to frame another vessel!');
    await loadLedger();
  };

  const handleRestoreIntegrity = async () => {
    await ApiClient.restoreLedgerIntegrity();
    setTamperMessage(null);
    await loadLedger();
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-cyan">PERMISSIONED AIR-GAPPED DLT</span>
          <span className="badge badge-purple">IMMUTABLE MERKLE HASH CHAIN</span>
        </div>
        <h1 style={{ fontSize: '28px', color: '#ffffff', letterSpacing: '-0.02em' }}>
          Offline Distributed Ledger & Tamper Detection Lab
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '850px', marginTop: '4px' }}>
          Inspect the cryptographic audit ledger. Every decryption event is committed across permissioned consensus 
          authorities (Security, Audit, and Forensic Command). Any retroactive tampering breaks hash chaining and Merkle proofs.
        </p>
      </div>

      {/* Tamper Simulation Command Bar */}
      <div className={`glass-panel ${isTampered ? 'glass-panel-crimson' : 'glass-panel-glow'}`} style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: isTampered ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${isTampered ? 'var(--crimson-primary)' : 'var(--emerald-primary)'}`
            }}>
              {isTampered ? <AlertTriangle size={24} color="var(--crimson-primary)" /> : <ShieldAlert size={24} color="var(--emerald-primary)" />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '17px', color: '#ffffff' }}>
                  {isTampered ? 'CRITICAL: LEDGER TAMPERING DETECTED' : 'LEDGER INTEGRITY VERIFIED (ALL NODES AGREE)'}
                </h3>
                <span className={`badge ${isTampered ? 'badge-crimson' : 'badge-emerald'}`}>
                  {isTampered ? 'CHAIN BROKEN' : 'CONSENSUS VALID'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {isTampered 
                  ? tamperMessage || 'A block hash, Merkle root, or signature does not match cryptographic state.'
                  : 'Hash-chained SHA3-256 blocks with Merkle inclusion trees guarantee non-repudiation.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {isTampered ? (
              <button className="btn btn-emerald" onClick={handleRestoreIntegrity}>
                <RotateCcw size={16} /> Restore Ledger Integrity
              </button>
            ) : (
              <button className="btn btn-danger" onClick={handleSimulateTamper}>
                <ShieldAlert size={16} /> Simulate Rogue Admin Attack (Tamper Block #1)
              </button>
            )}
          </div>
        </div>

        {/* Verification Diagnostic Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            {isTampered ? <XCircle size={16} color="var(--crimson-primary)" /> : <CheckCircle2 size={16} color="var(--emerald-primary)" />}
            <span style={{ color: isTampered ? '#fca5a5' : '#ffffff' }}>Hash Chain Continuity</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            {isTampered ? <XCircle size={16} color="var(--crimson-primary)" /> : <CheckCircle2 size={16} color="var(--emerald-primary)" />}
            <span style={{ color: isTampered ? '#fca5a5' : '#ffffff' }}>Merkle Inclusion Proof</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            {isTampered ? <XCircle size={16} color="var(--crimson-primary)" /> : <CheckCircle2 size={16} color="var(--emerald-primary)" />}
            <span style={{ color: isTampered ? '#fca5a5' : '#ffffff' }}>ML-DSA Recipient Sig</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            {isTampered ? <XCircle size={16} color="var(--crimson-primary)" /> : <CheckCircle2 size={16} color="var(--emerald-primary)" />}
            <span style={{ color: isTampered ? '#fca5a5' : '#ffffff' }}>Consensus Node Quorum</span>
          </div>
        </div>
      </div>

      {/* Blocks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={18} color="var(--cyan-primary)" />
          Chronological Audit Blocks ({blocks.length} Blocks)
        </h3>

        {blocks.map((blk, idx) => {
          const isThisBlockTampered = blk.isTampered;
          return (
            <div
              key={blk.blockId}
              className={`glass-panel ${isThisBlockTampered ? 'glass-panel-crimson' : ''}`}
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <GitCommit size={18} color={isThisBlockTampered ? 'var(--crimson-primary)' : 'var(--cyan-primary)'} />
                  <strong style={{ fontSize: '15px', color: '#ffffff' }}>
                    Block #{blk.blockIndex} &bull; {blk.blockId}
                  </strong>
                  {blk.blockIndex === 0 && <span className="badge badge-cyan">GENESIS</span>}
                  {isThisBlockTampered && <span className="badge badge-crimson">TAMPERED SIGNATURE</span>}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Timestamp: {blk.timestamp} UTC
                </div>
              </div>

              {/* Block Hashes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '11px' }}>
                <div style={{ backgroundColor: '#070a12', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>PREVIOUS BLOCK HASH (CHAIN POINTER):</span>
                  <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {blk.previousBlockHash.substring(0, 36)}...
                  </code>
                </div>

                <div style={{ backgroundColor: '#070a12', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>MERKLE ROOT FOR BATCH:</span>
                  <code style={{ fontFamily: 'var(--font-mono)', color: isThisBlockTampered ? 'var(--crimson-primary)' : 'var(--cyan-primary)' }}>
                    {blk.merkleRoot.substring(0, 36)}...
                  </code>
                </div>

                <div style={{ backgroundColor: '#070a12', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>WATERMARK DIGEST COMMITMENT:</span>
                  <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {blk.watermarkHash.substring(0, 36)}...
                  </code>
                </div>

                <div style={{ backgroundColor: '#070a12', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>RECIPIENT ML-DSA-65 SIGNATURE ATTESTATION:</span>
                  <code style={{ fontFamily: 'var(--font-mono)', color: isThisBlockTampered ? 'var(--crimson-primary)' : '#a7f3d0' }}>
                    {blk.recipientSignature.substring(0, 36)}...
                  </code>
                </div>
              </div>

              {/* Endorsers Strip */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={13} color="var(--indigo-primary)" />
                  <span>Consensus Endorsers: </span>
                  {blk.endorsers.map(e => (
                    <span key={e} className="badge badge-purple" style={{ fontSize: '8px', padding: '1px 5px' }}>{e}</span>
                  ))}
                </div>
                <div>Event ID: <strong style={{ color: '#ffffff' }}>{blk.eventId}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
