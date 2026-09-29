import React from 'react';
import { LayoutGrid, FolderLock, KeyRound, FileSearch, LogOut, Database } from 'lucide-react';
import { UserAccount } from '../types';

export type WorkstationModule = 'overview' | 'documents' | 'decryption' | 'evidence' | 'audit';

interface WorkstationSidebarProps {
  activeModule: WorkstationModule;
  setActiveModule: (module: WorkstationModule) => void;
  currentUser: UserAccount | null;
  isOnline: boolean;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const WorkstationSidebar: React.FC<WorkstationSidebarProps> = ({
  activeModule,
  setActiveModule,
  currentUser: _currentUser,
  isOnline,
  onOpenAuth: _onOpenAuth,
  onLogout
}) => {
  const navItems = [
    { id: 'overview' as WorkstationModule, label: 'Dashboard', icon: LayoutGrid, tag: 'SYS' },
    { id: 'documents' as WorkstationModule, label: 'Encryption Lab', icon: FolderLock, tag: 'ENC' },
    { id: 'decryption' as WorkstationModule, label: 'Decryption Lab', icon: KeyRound, tag: 'DEC' },
    { id: 'evidence' as WorkstationModule, label: 'Forensic Leak Lab', icon: FileSearch, tag: 'LEAK' },
    { id: 'audit' as WorkstationModule, label: 'Forensic Audit Ledger', icon: Database, tag: 'DLT' }
  ];

  return (
    <aside style={{
      width: '235px',
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-hard)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      flexShrink: 0,
      userSelect: 'none'
    }}>
      {/* Top Brand Section */}
      <div>
        <div style={{
          padding: '18px 16px',
          borderBottom: '1px solid var(--border-hard)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
            color: '#ffffff',
            padding: '6px 8px',
            fontSize: '11px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
          }}>
            CT
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.05em', color: '#ffffff' }}>
              CIPHERTRACE
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              NIST PQC // DEFENSE
            </div>
          </div>
        </div>

        {/* Navigation Modules */}
        <div style={{ padding: '14px 12px 8px' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-dim)',
            padding: '0 8px 8px',
            fontFamily: 'var(--font-mono)'
          }}>
            Workstations
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: '0.01em',
                    color: isActive ? '#38bdf8' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid #38bdf8' : '3px solid transparent',
                    cursor: 'pointer',
                    borderRadius: '0 4px 4px 0',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon size={15} color={isActive ? '#38bdf8' : 'var(--text-dim)'} />
                    <span>{item.label}</span>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color: isActive ? '#38bdf8' : 'var(--text-dim)',
                    backgroundColor: isActive ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid ' + (isActive ? 'rgba(56, 189, 248, 0.25)' : 'var(--border-subtle)'),
                    padding: '1px 5px',
                    borderRadius: '3px'
                  }}>
                    {item.tag}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Status Panel */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border-hard)',
        backgroundColor: 'var(--bg-topbar)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>SYSTEM STATUS</span>
          <span style={{
            color: isOnline ? '#34d399' : '#fb7185',
            fontWeight: 600,
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isOnline ? '#10b981' : '#f43f5e'
            }} />
            {isOnline ? 'ONLINE // SECURE' : 'UNREACHABLE'}
          </span>
        </div>

        {onLogout && (
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={onLogout}
              className="tactical-btn tactical-btn-danger"
              style={{ width: '100%', padding: '6px 10px', fontSize: '11px', justifyContent: 'center' }}
              title="Sign out of workstation"
            >
              <LogOut size={12} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
