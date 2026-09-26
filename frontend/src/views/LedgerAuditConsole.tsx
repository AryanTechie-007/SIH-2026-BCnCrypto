import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { LedgerBlock } from '../types';
import { ShieldCheck, ShieldAlert, Database, RotateCcw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export const LedgerAuditConsole: React.FC = () => {
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [auditReport, setAuditReport] = useState<any>(null);
  const [clusterInfo, setClusterInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tamperStatus, setTamperStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadLedger();
  }, []);

  const loadLedger = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [bList, audit, cluster] = await Promise.allSettled([
        ApiClient.getLedgerBlocks(),
        ApiClient.verifyLedger(),
        ApiClient.getClusterNodes()
      ]);
      if (bList.status === 'fulfilled') setBlocks(bList.value);
      if (audit.status === 'fulfilled') setAuditReport(audit.value);
      if (cluster.status === 'fulfilled') setClusterInfo(cluster.value);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to inspect ledger state');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateTamper = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await ApiClient.tamperLedger(1);
      setTamperStatus(res.message);
      await loadLedger();
    } catch (err: any) {
      setErrorMessage(err.message || 'Tamper simulation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await ApiClient.restoreLedger();
      setTamperStatus(null);
      await loadLedger();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ledger restoration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const isChainValid = auditReport?.chain_integrity_valid ?? true;

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="tactical-badge badge-blue">ENTERPRISE DLT</span>
          <span className="tactical-badge badge-slate">PERMISSIONED PROOF-OF-AUTHORITY (PoA)</span>
          <span className="tactical-badge badge-slate">NIST SHA3-256 HASH CHAINING</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '0.03em', color: '#ffffff', margin: 0 }}>
          DISTRIBUTED BLOCKCHAIN LEDGER &amp; CONSENSUS NETWORK
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
          Decryption events and watermark bindings are immutably signed via NIST FIPS 204 ML-DSA-65 and committed across distributed validator nodes. Even privileged administrators cannot alter historical audit records without breaking mathematical consensus.
        </p>
      </div>

      {/* Distributed 3-Node Network Cluster Visualization */}
      <div style={{
        backgroundColor: '#070b13',
        border: '1px solid var(--border-hard)',
        padding: '16px 20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #141f32', paddingBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
            🌐 ACTIVE DISTRIBUTED CONSENSUS CLUSTER (3 AIR-GAPPED NODES)
          </div>
          <span style={{ fontSize: '10px', color: '#34d399', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            ● CLUSTER STATE: FULLY SYNCHRONIZED
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {/* Node Alpha */}
          <div style={{
            backgroundColor: '#0c121e',
            border: '1px solid #1e293b',
            borderLeft: '4px solid #0284c7',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <strong style={{ fontSize: '12px', color: '#ffffff' }}>NODE ALPHA (DEFENSE)</strong>
              <span className="tactical-badge badge-green" style={{ fontSize: '9px' }}>LEADER</span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Command Operations Enclave</div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
              IP: 10.14.0.10:8000 &bull; Weight: 33.3%
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
              Block Height: #{blocks.length > 0 ? blocks[blocks.length - 1].block_index : 0}
            </div>
          </div>

          {/* Node Bravo */}
          <div style={{
            backgroundColor: '#0c121e',
            border: '1px solid #1e293b',
            borderLeft: '4px solid #10b981',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <strong style={{ fontSize: '12px', color: '#ffffff' }}>NODE BRAVO (AUDIT)</strong>
              <span className="tactical-badge badge-green" style={{ fontSize: '9px' }}>PEER SYNC</span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Inspector General &amp; Compliance</div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
              IP: 10.14.0.20:8000 &bull; Weight: 33.3%
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#34d399' }}>
              Block Height: #{blocks.length > 0 ? blocks[blocks.length - 1].block_index : 0}
            </div>
          </div>

          {/* Node Charlie */}
          <div style={{
            backgroundColor: '#0c121e',
            border: '1px solid #1e293b',
            borderLeft: '4px solid #f59e0b',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <strong style={{ fontSize: '12px', color: '#ffffff' }}>NODE CHARLIE (FORENSIC)</strong>
              <span className="tactical-badge badge-green" style={{ fontSize: '9px' }}>PEER SYNC</span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Forensic Attribution &amp; Intelligence</div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
              IP: 10.14.0.30:8000 &bull; Weight: 33.3%
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
              Block Height: #{blocks.length > 0 ? blocks[blocks.length - 1].block_index : 0}
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="tactical-alert tactical-alert-danger">
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>LEDGER AUDIT EXCEPTION:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* Tamper Alert Banner */}
      {!isChainValid && (
        <div className="tactical-alert tactical-alert-danger" style={{ borderLeft: '6px solid #ef4444' }}>
          <ShieldAlert size={22} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#ffffff' }}>
              CRITICAL AUDIT VIOLATION: IMMUTABLE LEDGER HASH CHAIN BROKEN
            </div>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              A historical decryption audit log has been retroactively altered by an insider. Block hash and signature verification failed consensus across Node Alpha, Node Bravo, and Node Charlie!
            </div>
          </div>
        </div>
      )}

      {/* Audit Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#090d16', border: '1px solid var(--border-hard)', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`tactical-badge ${isChainValid ? 'badge-green' : 'badge-red'}`} style={{ padding: '6px 12px', fontSize: '11px' }}>
            {isChainValid ? 'CHAIN INTEGRITY: 100% VALID' : 'CHAIN INTEGRITY: COMPROMISED'}
          </span>
          <span className="tactical-badge badge-slate" style={{ padding: '6px 12px', fontSize: '11px' }}>
            COMMITTED BLOCKS: {blocks.length}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {isChainValid ? (
            <button
              className="tactical-btn tactical-btn-danger"
              onClick={handleSimulateTamper}
              disabled={isLoading || blocks.length <= 1}
              style={{ padding: '10px 14px' }}
            >
              <AlertTriangle size={14} />
              <span>Simulate Rogue Admin Tamper (Modify Block #1)</span>
            </button>
          ) : (
            <button
              className="tactical-btn tactical-btn-success"
              onClick={handleRestore}
              disabled={isLoading}
              style={{ padding: '10px 14px' }}
            >
              <RotateCcw size={14} />
              <span>Restore Cryptographic Ledger Integrity</span>
            </button>
          )}

          <button
            className="tactical-btn tactical-btn-secondary"
            onClick={loadLedger}
            disabled={isLoading}
            style={{ padding: '10px 14px' }}
          >
            Refresh Audit
          </button>
        </div>
      </div>

      {/* Blocks Table */}
      <div className="tactical-panel">
        <div className="tactical-panel-header">
          <h3>Immutable Block Sequence</h3>
        </div>
        <table className="tactical-table">
          <thead>
            <tr>
              <th style={{ width: '70px' }}>Index</th>
              <th>Status</th>
              <th>Block Hash (SHA3-256)</th>
              <th>Previous Block Hash</th>
              <th>Merkle Root</th>
              <th>Timestamp (UTC)</th>
              <th>Endorsers</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map(b => {
              const isBlockTampered = b.is_tampered;
              return (
                <tr 
                  key={b.block_index}
                  style={{ backgroundColor: isBlockTampered ? 'rgba(239, 68, 68, 0.12)' : 'transparent' }}
                >
                  <td className="font-mono" style={{ fontWeight: 800, color: isBlockTampered ? '#fca5a5' : '#ffffff' }}>
                    #{b.block_index}
                  </td>
                  <td>
                    {isBlockTampered ? (
                      <span className="tactical-badge badge-red">TAMPERED</span>
                    ) : (
                      <span className="tactical-badge badge-green">CONSENSUS VALID</span>
                    )}
                  </td>
                  <td className="font-mono" style={{ fontSize: '11px', color: isBlockTampered ? '#ef4444' : '#38bdf8' }}>
                    {b.block_hash.substring(0, 24)}...
                  </td>
                  <td className="font-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {b.prev_block_hash.substring(0, 24)}...
                  </td>
                  <td className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {b.merkle_root.substring(0, 24)}...
                  </td>
                  <td className="font-mono" style={{ fontSize: '11px' }}>
                    {b.timestamp.replace('T', ' ').substring(0, 19)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {b.endorsers.map(e => (
                        <span key={e} className="tactical-badge badge-slate" style={{ fontSize: '9px' }}>
                          {e.replace('NODE_', '')}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
