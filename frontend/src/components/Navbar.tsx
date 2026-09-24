import React from 'react';
import { 
  ShieldCheck, 
  Send, 
  Key, 
  Search, 
  Flame, 
  Database, 
  GitBranch, 
  Cpu, 
  Radio
} from 'lucide-react';
import { ApiClient } from '../api/client';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isBackendConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, isBackendConnected }) => {
  const tabs = [
    { id: 'sender', label: 'Sender Studio', icon: Send, badge: 'Distribute' },
    { id: 'recipient', label: 'Recipient Terminal', icon: Key, badge: 'Decrypt' },
    { id: 'investigator', label: 'Forensic Lab', icon: Search, badge: 'Attribution' },
    { id: 'attack-lab', label: 'Attack Simulator', icon: Flame, badge: 'Robustness' },
    { id: 'ledger', label: 'Ledger & Tamper Demo', icon: Database, badge: 'Immutable' },
    { id: 'graph', label: 'Continuity Graph', icon: GitBranch, badge: 'Graph' }
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      backgroundColor: 'rgba(11, 15, 25, 0.95)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Top Security Banner */}
      <div style={{
        padding: '6px 24px',
        backgroundColor: 'rgba(6, 182, 212, 0.05)',
        borderBottom: '1px solid rgba(6, 182, 212, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cyan-primary)', fontWeight: 600 }}>
            <Radio size={12} className="animate-pulse-glow" /> AIR-GAPPED OPERATIONAL MODE (OFFLINE SECURE INFRASTRUCTURE)
          </span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>
            NIST POST-QUANTUM COMPLIANT: <strong>ML-KEM-768 (FIPS 203)</strong> &bull; <strong>ML-DSA-65 (FIPS 204)</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge badge-cyan">SHA3-256 LEDGER</span>
          <button
            onClick={() => {
              const next = ApiClient.getMode() === 'LIVE' ? 'DEMO' : 'LIVE';
              ApiClient.setMode(next);
              window.location.reload();
            }}
            title="Click to toggle between real backend API execution and offline demo simulation"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer'
            }}
          >
            <span className={`badge ${ApiClient.getMode() === 'LIVE' ? 'badge-emerald' : 'badge-amber'}`} style={{ cursor: 'pointer' }}>
              {ApiClient.getMode() === 'LIVE' ? '⚡ MODE: LIVE BACKEND API' : '🛡️ MODE: AIR-GAP DEMO (CLICK TO TOGGLE)'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        maxWidth: '1600px',
        margin: '0 auto'
      }}>
        {/* Logo and Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)'
          }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                background: 'linear-gradient(90deg, #ffffff 0%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                CIPHERTRACE
              </span>
              <span className="badge badge-purple" style={{ fontSize: '9px', padding: '2px 6px' }}>PQC 2.0</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Offline Post-Quantum Document Attribution & Immutable Provenance Platform
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav style={{ display: 'flex', gap: '6px' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: isActive 
                    ? '1px solid rgba(6, 182, 212, 0.5)' 
                    : '1px solid transparent',
                  backgroundColor: isActive 
                    ? 'rgba(6, 182, 212, 0.12)' 
                    : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} color={isActive ? 'var(--cyan-primary)' : 'currentColor'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
