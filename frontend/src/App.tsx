import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SenderDashboard } from './pages/SenderDashboard';
import { RecipientDashboard } from './pages/RecipientDashboard';
import { InvestigatorDashboard } from './pages/InvestigatorDashboard';
import { AttackLab } from './pages/AttackLab';
import { LedgerDashboard } from './pages/LedgerDashboard';
import { ContinuityGraph } from './pages/ContinuityGraph';
import { ApiClient } from './api/client';

export function App() {
  const [activeTab, setActiveTab] = useState('sender');
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  useEffect(() => {
    // Check if backend API is online
    async function check() {
      const ok = await ApiClient.checkHealth();
      setIsBackendConnected(ok);
    }
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isBackendConnected={isBackendConnected} 
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'sender' && <SenderDashboard />}
        {activeTab === 'recipient' && <RecipientDashboard />}
        {activeTab === 'investigator' && <InvestigatorDashboard />}
        {activeTab === 'attack-lab' && <AttackLab />}
        {activeTab === 'ledger' && <LedgerDashboard />}
        {activeTab === 'graph' && <ContinuityGraph />}
      </main>

      {/* Global Security Attestation Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '14px 24px',
        backgroundColor: 'rgba(7, 9, 14, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: 'var(--text-dim)',
        maxWidth: '1600px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span><strong>CIPHERTRACE DEFENSE SYSTEMS</strong> &bull; SMART INDIA HACKATHON 2026</span>
          <span>&bull;</span>
          <span>AIR-GAP ARCHITECTURE &bull; NO EXTERNAL KMS DEPENDENCY</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>NIST FIPS 203 (ML-KEM-768)</span>
          <span>NIST FIPS 204 (ML-DSA-65)</span>
          <span>SHA3-256 / AES-256-GCM</span>
          <span className="badge badge-emerald" style={{ fontSize: '9px' }}>SYSTEM OPERATIONAL</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
