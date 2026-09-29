import React from 'react';
import { LayoutGrid, FolderLock, KeyRound, FileSearch, LogOut, Sparkles } from 'lucide-react';
import { UserAccount } from '../types';

export type WorkstationModule = 'overview' | 'transform' | 'documents' | 'decryption' | 'evidence';

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
    { id: 'transform' as WorkstationModule, label: 'Content Transform', icon: Sparkles, tag: 'AI' },
    { id: 'documents' as WorkstationModule, label: 'Encryption Lab', icon: FolderLock, tag: 'ENC' },
    { id: 'decryption' as WorkstationModule, label: 'Decryption Lab', icon: KeyRound, tag: 'DEC' },
    { id: 'evidence' as WorkstationModule, label: 'Forensic Leak Lab', icon: FileSearch, tag: 'LEAK' }
  ];

  return (
    <aside style={{
      width: '230px',
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
          padding: '16px',
          borderBottom: '1px solid var(--border-hard)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            backgroundColor: '#00ff66',
            color: '#000000',
            padding: '5px 7px',
            fontSize: '11px',
            fontWeight: 900,
            letterSpacing: '0.05em',
            borderRadius: '2px'
          }}>
            CT
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: '#00ff66' }}>
              CIPHERTRACE
            </div>
          </div>
        </div>

        {/* Modules Section */}
        <div style={{ padding: '12px 12px 8px' }}>
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
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.02em',
                    color: isActive ? '#00ff66' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'rgba(0, 255, 102, 0.12)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid #00ff66' : '3px solid transparent',
                    cursor: 'pointer',
                    borderRadius: '0 2px 2px 0',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon size={15} color={isActive ? '#00ff66' : 'var(--text-dim)'} />
                    <span>{item.label}</span>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color: isActive ? '#00ff66' : 'var(--text-dim)',
                    opacity: 0.8
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
        backgroundColor: '#000000',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-dim)' }}>STATUS:</span>
          <span style={{ color: isOnline ? '#00ff66' : '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isOnline ? '#00ff66' : '#f87171' }} />
            {isOnline ? 'ONLINE' : 'UNREACHABLE'}
          </span>
        </div>

        {onLogout && (
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={onLogout}
              className="tactical-btn tactical-btn-danger"
              style={{ width: '100%', padding: '6px 10px', fontSize: '10px', justifyContent: 'center' }}
              title="Sign out of workstation"
            >
              <LogOut size={11} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
