import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { LedgerBlock } from '../types';
import { ShieldAlert, Database, RotateCcw, AlertTriangle, Search, Cpu } from 'lucide-react';

export const LedgerAuditConsole: React.FC = () => {
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [auditReport, setAuditReport] = useState<any>(null);
  const [clusterInfo, setClusterInfo] = useState<any>(null);
  const [fabricStatus, setFabricStatus] = useState<any>(null);
  const [fabricRecords, setFabricRecords] = useState<any[]>([]);
  const [searchWm, setSearchWm] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
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
      const [bList, audit, cluster, fStatus, fRecs] = await Promise.allSettled([
        ApiClient.getLedgerBlocks(),
        ApiClient.verifyLedger(),
        ApiClient.getClusterNodes(),
        ApiClient.getFabricStatus(),
        ApiClient.getFabricRecords()
      ]);
      if (bList.status === 'fulfilled') setBlocks(bList.value);
      if (audit.status === 'fulfilled') setAuditReport(audit.value);
      if (cluster.status === 'fulfilled') setClusterInfo(cluster.value);
      if (fStatus.status === 'fulfilled') setFabricStatus(fStatus.value);
      if (fRecs.status === 'fulfilled') setFabricRecords(fRecs.value.records || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to inspect ledger state');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchWatermark = async () => {
    if (!searchWm.trim()) return;
    try {
      setSearchError(null);
      setSearchResult(null);
      const res = await ApiClient.queryFabricByWatermark(searchWm.trim().toLowerCase());
      setSearchResult(res);
    } catch (err: any) {
      setSearchError(err.message || `No record found for watermark ${searchWm.trim()}`);
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
      await ApiClient.restoreLedger();
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
          <span className="tactical-badge badge-blue">HYPERLEDGER FABRIC 2.5</span>
          <span className="tactical-badge badge-slate">NIST FIPS 204 ML-DSA-65 ATTESTATION</span>
          <span className="tactical-badge badge-slate">SHA3-256 HASH CHAINING &amp; MERKLE PROOFS</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '0.03em', color: '#ffffff', margin: 0 }}>
          IMMUTABLE FORENSIC AUDIT LEDGER
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
          Every document decryption and steganographic watermark embedding is immutably committed on-chain across consortium organizations (Org1-Defense &amp; Org2-Audit). Keyed directly by the 20-character watermark ID, any leaked document is traced mathematically to the authenticated recipient.
        </p>
      </div>

      {/* DLT Protocol Status & Multi-Org Consensus Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-hard)', padding: '14px 16px', borderRadius: '4px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>DLT NETWORK TYPE</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
            {fabricStatus?.network_type || 'Hyperledger Fabric 2.5 (DLT)'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Channel: {fabricStatus?.channel || 'mychannel'} &bull; CC: {fabricStatus?.chaincode || 'forensic'}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-hard)', padding: '14px 16px', borderRadius: '4px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>CONSENSUS POLICY</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            {fabricStatus?.endorsement_policy || 'MAJORITY (Org1MSP, Org2MSP)'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Multi-Org Defense &amp; Audit Endorsement
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-hard)', padding: '14px 16px', borderRadius: '4px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>CRYPTOGRAPHIC ENGINE</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
            NIST FIPS 203 / 204
          </div>
          <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '2px' }}>
            ML-KEM-768 &bull; ML-DSA-65 Signatures
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-hard)', padding: '14px 16px', borderRadius: '4px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>COMMITTED AUDIT HEIGHT</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            #{blocks.length} Blocks ({fabricRecords.length} On-Chain Records)
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Chain Integrity: {isChainValid ? '100% Valid' : 'Compromised'}
          </div>
        </div>
      </div>

      {/* Authoritative Ledger Watermark Lookup Box */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-hard)',
        padding: '18px 20px',
        borderRadius: '4px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={15} />
          <span>AUTHORITATIVE LEDGER QUERY — LOOKUP BY WATERMARK ID</span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
          Directly queries smart contract function <code style={{ color: '#38bdf8', backgroundColor: 'var(--bg-input)', padding: '2px 6px', borderRadius: '3px' }}>LookupByWatermark(ctx, watermark_id)</code> on Hyperledger Fabric.
        </p>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            value={searchWm}
            onChange={e => setSearchWm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearchWatermark(); }}
            placeholder="Enter 20-character lowercase hex watermark ID (e.g. a1b2c3d4e5f60718293a)"
            className="tactical-input"
            style={{ flex: 1, padding: '10px 14px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
          />
          <button
            onClick={handleSearchWatermark}
            className="tactical-btn tactical-btn-primary"
            style={{ padding: '10px 18px', fontSize: '12px' }}
          >
            <Search size={14} />
            <span>Query Ledger</span>
          </button>
        </div>

        {searchError && (
          <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '11px', fontFamily: 'var(--font-mono)', borderRadius: '3px' }}>
            ⚠ {searchError}
          </div>
        )}

        {searchResult && (
          <div style={{
            marginTop: '14px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-hard)',
            borderRadius: '4px',
            padding: '14px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
              ✔ ON-CHAIN RECORD RETRIEVED (HYPERLEDGER FABRIC)
            </div>
            <pre style={{
              margin: 0,
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#e2e8f0',
              overflowX: 'auto',
              backgroundColor: '#050811',
              padding: '12px',
              borderRadius: '3px',
              border: '1px solid var(--border-subtle)'
            }}>
              {JSON.stringify(searchResult, null, 2)}
            </pre>
          </div>
        )}
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
              A historical decryption audit log has been retroactively altered by an insider. Block hash and signature verification failed consensus across consortium validator nodes!
            </div>
          </div>
        </div>
      )}

      {/* Audit Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-hard)', padding: '12px 16px', borderRadius: '4px' }}>
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
      <div className="tactical-panel" style={{ borderRadius: '4px', overflow: 'hidden' }}>
        <div className="tactical-panel-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={15} color="#38bdf8" />
            <span>Immutable Block Sequence &amp; SHA3-256 Merkle Ledger</span>
          </h3>
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
              <th>Consensus Endorsers</th>
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
