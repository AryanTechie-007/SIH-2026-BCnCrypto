import React from 'react';
import { LayoutGrid, FolderLock, KeyRound, FileSearch, ShieldCheck, User } from 'lucide-react';
import { UserAccount } from '../types';

export type WorkstationModule = 'overview' | 'documents' | 'decryption' | 'evidence';

interface WorkstationSidebarProps {
  activeModule: WorkstationModule;
  setActiveModule: (module: WorkstationModule) => void;
  currentUser: UserAccount | null;
  blocksCount: number;
  isOnline: boolean;
}

export const WorkstationSidebar: React.FC<WorkstationSidebarProps> = ({
  activeModule,
  setActiveModule,
  currentUser,
  blocksCount,
  isOnline
}) => {
  const navItems = [
    { id: 'overview' as WorkstationModule, label: 'Dashboard', icon: LayoutGrid, tag: 'SYS' },
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
            backgroundColor: '#0284c7',
            color: '#ffffff',
            padding: '5px 7px',
            fontSize: '11px',
            fontWeight: 900,
            letterSpacing: '0.05em',
            borderRadius: '2px'
          }}>
            CT
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: '#ffffff' }}>
              CIPHERTRACE
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              SEC-WS-NODE-01
            </div>
          </div>
        </div>

        {/* Modules Section */}
        <div style={{ padding: '16px 12px 8px' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            paddingLeft: '8px',
            marginBottom: '10px'
          }}>
            Workstation Modules
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
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.02em',
                    color: isActive ? '#38bdf8' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'rgba(2, 132, 199, 0.12)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid #38bdf8' : '3px solid transparent',
                    cursor: 'pointer',
                    borderRadius: '0 2px 2px 0',
                    textAlign: 'left'
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
        backgroundColor: '#070b13',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: 'var(--text-dim)' }}>STATUS:</span>
          <span style={{ color: isOnline ? '#34d399' : '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isOnline ? '#34d399' : '#f87171' }} />
            {isOnline ? 'ONLINE' : 'UNREACHABLE'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: 'var(--text-dim)' }}>LEDGER HEAD:</span>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>
            #{String(blocksCount).padStart(6, '0')}
          </span>
        </div>

        <div style={{ borderTop: '1px solid #141f32', paddingTop: '8px', marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: 'var(--text-dim)' }}>USER:</span>
            <span style={{ color: '#ffffff', fontWeight: 700 }}>
              @{currentUser?.username || 'anonymous'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>ROLE:</span>
            <span style={{ color: '#94a3b8' }}>
              {currentUser?.rank || 'General User'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
