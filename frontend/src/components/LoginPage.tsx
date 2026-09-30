import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { UserAccount, Officer } from '../types';
import { LogIn, AlertOctagon, FileArchive } from 'lucide-react';
import { InteractiveSpottedBackground } from './InteractiveSpottedBackground';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount, token: string) => void;
  enrolledUsers: Officer[];
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, enrolledUsers: _enrolledUsers }) => {
  const [username, setUsername] = useState('');
  const [bundle, setBundle] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().replace(/^@+/, '');
    if (!cleanUser || !bundle) {
      setErrorMessage('Please provide your username and identity bundle (.zip).');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await ApiClient.ledgerLogin(cleanUser, bundle);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ledger authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

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
            src="/logo.png"
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
          Sign in with the ledger identity bundle issued to you.
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
        <div style={{ padding: '24px' }}>
          {errorMessage && (
            <div className="tactical-alert tactical-alert-danger" style={{ marginBottom: '16px' }}>
              <AlertOctagon size={16} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="tactical-input"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                IDENTITY BUNDLE (.ZIP)
              </label>
              <label className="tactical-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <FileArchive size={14} style={{ flexShrink: 0, color: '#38bdf8' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: bundle ? '#ffffff' : 'var(--text-dim)' }}>
                  {bundle ? bundle.name : 'Choose bundle file…'}
                </span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={e => setBundle(e.target.files?.[0] ?? null)}
                  style={{ display: 'none' }}
                />
              </label>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                Issued by your ledger administrator. It contains your private key; do not share it.
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="tactical-btn tactical-btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.03em',
                justifyContent: 'center',
                marginTop: '6px'
              }}
            >
              <LogIn size={15} />
              <span>{isLoading ? 'VERIFYING WITH LEDGER...' : 'SIGN IN'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
