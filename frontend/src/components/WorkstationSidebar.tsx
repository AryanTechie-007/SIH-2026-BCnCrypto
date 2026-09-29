import React from 'react';
import { LayoutGrid, FolderLock, KeyRound, FileSearch, LogOut, Users } from 'lucide-react';
import { UserAccount } from '../types';

export type WorkstationModule = 'overview' | 'documents' | 'decryption' | 'evidence' | 'accounts';

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
  currentUser,
  isOnline,
  onOpenAuth: _onOpenAuth,
  onLogout
}) => {
  const navItems = [
    { id: 'overview' as WorkstationModule, label: 'Dashboard', icon: LayoutGrid },
    { id: 'documents' as WorkstationModule, label: 'Encryption Lab', icon: FolderLock },
    { id: 'decryption' as WorkstationModule, label: 'Decryption Lab', icon: KeyRound },
    { id: 'evidence' as WorkstationModule, label: 'Forensic Leak Lab', icon: FileSearch },
    { id: 'accounts' as WorkstationModule, label: 'Account Management', icon: Users }
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
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
            color: '#ffffff',
            padding: '6px 8px',
            fontSize: '11px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
          }}>
            CT
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff' }}>
              CIPHERTRACE
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
              Document Security
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
            Navigation
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                    gap: '10px',
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#3b82f6' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                    cursor: 'pointer',
                    borderRadius: '0 4px 4px 0',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={16} color={isActive ? '#3b82f6' : 'var(--text-dim)'} />
                  <span>{item.label}</span>
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
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {/* User Card */}
        {currentUser && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '12px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {currentUser.name}
              </div>
              <div style={{
                color: 'var(--text-dim)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)'
              }}>
                @{currentUser.username}
              </div>
            </div>

            <button
              onClick={onLogout}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border-hard)',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '5px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Log Out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}

        {/* System Node Telemetry */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isOnline ? '#10b981' : '#f43f5e',
              boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none'
            }} />
            <span>{isOnline ? 'System Online' : 'Offline'}</span>
          </div>
          <span>v2.0</span>
        </div>
      </div>
    </aside>
  );
};
