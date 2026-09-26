import React, { useState, useEffect } from 'react';
import { User, LogIn, LogOut, ShieldCheck, Key, RefreshCw } from 'lucide-react';
import { UserAccount, SystemHealth } from '../types';

interface WorkstationHeaderProps {
  activeModuleTitle: string;
  currentUser: UserAccount | null;
  systemHealth: SystemHealth | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onRefreshHealth: () => void;
}

export const WorkstationHeader: React.FC<WorkstationHeaderProps> = ({
  activeModuleTitle,
  currentUser,
  systemHealth,
  onOpenAuth,
  onLogout,
  onRefreshHealth
}) => {
  const [timeUtc, setTimeUtc] = useState('');
  const [timeLoc, setTimeLoc] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25));
      setTimeLoc(now.toTimeString().slice(0, 8));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header style={{
      height: '48px',
      backgroundColor: 'var(--bg-topbar)',
      borderBottom: '1px solid var(--border-hard)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-dim)',
      position: 'relative',
      zIndex: 50
    }}>
      {/* Left System Origin Telemetry */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>SYS-ORIGIN: <strong style={{ color: '#ffffff' }}>LOCALHOST</strong></span>
        <span>/</span>
        <span style={{ color: '#38bdf8', fontWeight: 700 }}>
          {activeModuleTitle.toUpperCase()}
        </span>
        <span>/</span>
        <span>STATION ID: <strong style={{ color: '#94a3b8' }}>0X7E3A</strong></span>
      </div>

      {/* Right Clocks, Status & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div>
          UTC <strong style={{ color: '#ffffff' }}>{timeUtc || '12:00:00'}</strong>
        </div>
        <div>
          LOC <strong style={{ color: '#ffffff' }}>{timeLoc || '17:30:00'}</strong>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          backgroundColor: '#0a1d2e',
          border: '1px solid #0284c7',
          color: '#38bdf8',
          fontSize: '10px',
          fontWeight: 700,
          borderRadius: '2px'
        }}>
          <span>■</span>
          <span>SECURE CLUSTER</span>
        </div>

        <button
          onClick={onRefreshHealth}
          title="Refresh Core Telemetry"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <RefreshCw size={12} />
        </button>

        {/* User Account / Avatar Dropdown */}
        <div style={{ position: 'relative' }}>
          {currentUser ? (
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#0e1726',
                border: '1px solid #1e2d44',
                padding: '4px 10px',
                borderRadius: '2px',
                cursor: 'pointer',
                color: '#ffffff'
              }}
            >
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 800
              }}>
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700 }}>@{currentUser.username}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="tactical-btn tactical-btn-primary"
              style={{ padding: '4px 10px', fontSize: '10px' }}
            >
              <LogIn size={11} />
              <span>SIGN IN / ENROLL</span>
            </button>
          )}

          {/* Profile Dropdown Menu */}
          {showProfileMenu && currentUser && (
            <div
              style={{
                position: 'absolute',
                top: '36px',
                right: 0,
                width: '240px',
                backgroundColor: '#0c121e',
                border: '1px solid #1e2d44',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.7)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 100
              }}
            >
              <div style={{ borderBottom: '1px solid #141c2c', paddingBottom: '8px' }}>
                <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '12px' }}>
                  {currentUser.name}
                </div>
                <div style={{ color: '#38bdf8', fontSize: '10px' }}>
                  @{currentUser.username} &bull; {currentUser.rank}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '9px', marginTop: '2px' }}>
                  ID: {currentUser.navy_id}
                </div>
              </div>

              <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                <div>Device: <span style={{ color: '#ffffff' }}>{currentUser.device_id}</span></div>
                <div style={{ marginTop: '2px' }}>Clearance: <span style={{ color: '#34d399' }}>{currentUser.clearance_level}</span></div>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  onClick={() => { setShowProfileMenu(false); onOpenAuth(); }}
                  className="tactical-btn tactical-btn-secondary"
                  style={{ flex: 1, padding: '6px', fontSize: '10px', justifyContent: 'center' }}
                >
                  Switch
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); onLogout(); }}
                  className="tactical-btn tactical-btn-danger"
                  style={{ flex: 1, padding: '6px', fontSize: '10px', justifyContent: 'center' }}
                >
                  <LogOut size={11} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
