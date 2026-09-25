import React from 'react';
import { Shield, ShieldAlert, Cpu, Terminal, RefreshCw, UserCheck, LogIn, Key, LogOut } from 'lucide-react';
import { SystemHealth, UserAccount } from '../types';

interface TopHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  systemHealth: SystemHealth | null;
  healthError: string | null;
  onRefreshHealth: () => void;
  currentUser: UserAccount | null;
  onOpenAuth: () => void;
  onLogout?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  setActiveTab,
  systemHealth,
  healthError,
  onRefreshHealth,
  currentUser,
  onOpenAuth,
  onLogout
}) => {
  const tabs = [
    { id: 'sender', label: '1. SECURE DISTRIBUTION' },
    { id: 'recipient', label: '2. RECIPIENT VAULT' },
    { id: 'forensics', label: '3. FORENSIC AUDIT LAB' },
    { id: 'attacks', label: '4. ROBUSTNESS BENCHMARK' },
    { id: 'ledger', label: '5. IMMUTABLE LEDGER' }
  ];

  const isOnline = systemHealth !== null && !healthError;

  return (
    <header style={{ backgroundColor: '#090d16', borderBottom: '1px solid var(--border-hard)' }}>
      {/* Top Banner */}
      <div style={{
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #141c2c'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            backgroundColor: '#0284c7',
            color: '#ffffff',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.05em',
            borderRadius: '2px'
          }}>
            CIPHERTRACE
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.03em', color: '#ffffff' }}>
              POST-QUANTUM CONFIDENTIAL DOCUMENT SECURITY & PROVENANCE PLATFORM
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              ENTERPRISE POST-QUANTUM CRYPTOGRAPHY &bull; NIST FIPS 203 / 204 &bull; FIPS 202 SHA3-256
            </div>
          </div>
        </div>

        {/* Real-time System Status & User Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentUser ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#081322',
              border: '1px solid #0369a1',
              padding: '4px 10px'
            }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
              <div style={{ fontSize: '11px' }}>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>{currentUser.name}</span>
                <span style={{ color: 'var(--text-dim)', marginLeft: '6px' }}>@{currentUser.username} [{currentUser.rank}]</span>
              </div>
              <button
                onClick={onOpenAuth}
                className="tactical-btn tactical-btn-secondary"
                style={{ padding: '2px 6px', fontSize: '10px', marginLeft: '4px' }}
                title="Switch Account"
              >
                Switch
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="tactical-btn tactical-btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '10px' }}
                  title="Sign Out"
                >
                  <LogOut size={10} style={{ display: 'inline', marginRight: '2px' }} />
                  Sign Out
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="tactical-btn tactical-btn-primary"
              style={{ padding: '5px 14px', fontSize: '11px' }}
            >
              <LogIn size={13} />
              <span>SIGN IN / CREATE ACCOUNT</span>
            </button>
          )}

          {isOnline ? (
            <div className="tactical-badge badge-green" style={{ padding: '4px 10px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399', marginRight: '6px' }} />
              CORE ONLINE
            </div>
          ) : (
            <div className="tactical-badge badge-red" style={{ padding: '4px 10px' }}>
              <ShieldAlert size={12} style={{ marginRight: '6px' }} />
              PORT 8000 UNREACHABLE
            </div>
          )}

          <button
            className="tactical-btn tactical-btn-secondary"
            onClick={onRefreshHealth}
            title="Check API Health"
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <nav style={{ display: 'flex', backgroundColor: '#0c121d', padding: '0 16px' }}>
        {tabs.map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 18px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                backgroundColor: isActive ? 'var(--bg-panel)' : 'transparent',
                color: isActive ? '#38bdf8' : 'var(--text-muted)',
                border: 'none',
                borderBottom: isActive ? '2px solid #0284c7' : '2px solid transparent',
                borderRight: '1px solid #141c2c',
                cursor: 'pointer',
                outline: 'none',
                transition: 'none'
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
