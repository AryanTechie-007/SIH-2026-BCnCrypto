import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { LedgerBlock } from '../types';
import { ShieldCheck, ShieldAlert, Database, RotateCcw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export const LedgerAuditConsole: React.FC = () => {
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [auditReport, setAuditReport] = useState<any>(null);
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
      const [bList, audit] = await Promise.all([
        ApiClient.getLedgerBlocks(),
        ApiClient.verifyLedger()
      ]);
      setBlocks(bList);
      setAuditReport(audit);
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
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="tactical-badge badge-blue">STAGE 5</span>
          <span className="tactical-badge badge-slate">PERMISSIONED DISTRIBUTED LEDGER</span>
          <span className="tactical-badge badge-slate">SHA3-256 HASH CHAINING</span>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.03em', color: '#ffffff' }}>
          IMMUTABLE DISTRIBUTED LEDGER & INSIDER TAMPER AUDIT
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
          Every decryption event is committed across permissioned consensus nodes. Cryptographic hash chaining prevents privileged insider administrators from secretly altering historical audit logs.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="tactical-alert tactical-alert-danger" style={{ marginBottom: '20px' }}>
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <strong>LEDGER AUDIT EXCEPTION:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* Tamper Alert Banner */}
      {!isChainValid && (
        <div className="tactical-alert tactical-alert-danger" style={{ marginBottom: '20px', borderLeft: '6px solid #ef4444' }}>
          <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#ffffff' }}>
              CRITICAL AUDIT VIOLATION: IMMUTABLE LEDGER HASH CHAIN BROKEN
            </div>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              A historical decryption audit log has been retroactively altered by an insider. Block hash and signature verification failed consensus.
            </div>
          </div>
        </div>
      )}

      {/* Audit Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`tactical-badge ${isChainValid ? 'badge-green' : 'badge-red'}`} style={{ padding: '6px 12px', fontSize: '12px' }}>
            {isChainValid ? 'CHAIN INTEGRITY: 100% VALID' : 'CHAIN INTEGRITY: COMPROMISED'}
          </span>
          <span className="tactical-badge badge-slate" style={{ padding: '6px 12px', fontSize: '12px' }}>
            TOTAL BLOCKS: {blocks.length}
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
