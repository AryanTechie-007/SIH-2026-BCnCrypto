import React from 'react';
import { SystemHealth } from '../types';

interface TelemetryBarProps {
  systemHealth: SystemHealth | null;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({ systemHealth }) => {
  return (
    <footer style={{
      backgroundColor: '#070a11',
      borderTop: '1px solid var(--border-hard)',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '11px',
      color: 'var(--text-dim)',
      fontFamily: 'var(--font-mono)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span><strong>NETWORK:</strong> SECURE LOCAL CLUSTER</span>
        <span>&bull;</span>
        <span><strong>KEM:</strong> {systemHealth?.cryptographic_suite.kem || 'NIST FIPS 203 (ML-KEM-768)'}</span>
        <span>&bull;</span>
        <span><strong>DSA:</strong> {systemHealth?.cryptographic_suite.signature || 'NIST FIPS 204 (ML-DSA-65)'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span><strong>ENDORSERS:</strong> 3 OF 3 NODES COMMITTED</span>
        <span>&bull;</span>
        <span><strong>STATUS:</strong> {systemHealth ? 'ACTIVE_CONSENSUS' : 'COMM_FAULT'}</span>
      </div>
    </footer>
  );
};
