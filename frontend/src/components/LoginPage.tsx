import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { UserAccount, Officer } from '../types';
import { InteractiveSpottedBackground } from './InteractiveSpottedBackground';
import { LedgerSignInForm } from './LedgerSignInForm';
import { LedgerSettingsPanel } from './LedgerSettingsPanel';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount) => void;
  enrolledUsers: Officer[];
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, enrolledUsers: _enrolledUsers }) => {
  const [showLedgerSettings, setShowLedgerSettings] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: 'var(--text-main)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <InteractiveSpottedBackground />

      {/* Brand Header */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: '28px', maxWidth: '520px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '5px 14px',
          borderRadius: '20px',
          color: '#38bdf8',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          marginBottom: '14px'
        }}>
          <img
            src="./logo.png"
            alt="CipherTrace Logo"
            style={{ width: '15px', height: '15px', objectFit: 'contain', filter: 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.5))' }}
          />
          <span>CIPHERTRACE</span>
        </div>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 800,
          letterSpacing: '0.01em',
          color: '#ffffff',
          marginBottom: '8px'
        }}>
          User Authentication
        </h1>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          lineHeight: '1.5'
        }}>
          Sign in with the ledger identity bundle issued to you and your keystore passphrase.
        </p>
      </div>

      {/* Main Authentication Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'rgba(10, 10, 10, 0.94)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border-hard)',
        borderRadius: '6px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden'
      }}>
        {!showLedgerSettings && (
          <button
            type="button"
            onClick={() => setShowLedgerSettings(true)}
            title="Ledger connection"
            aria-label="Ledger connection settings"
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'none',
              border: 'none',
              padding: '4px',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex'
            }}
          >
            <Settings size={15} />
          </button>
        )}
        <div style={{ padding: '24px' }}>
          {showLedgerSettings
            ? <LedgerSettingsPanel onClose={() => setShowLedgerSettings(false)} />
            : <LedgerSignInForm onLoginSuccess={onLoginSuccess} />}
        </div>
      </div>
    </div>
  );
};
