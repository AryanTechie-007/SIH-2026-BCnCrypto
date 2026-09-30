import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { UserAccount } from '../types';
import { Lock, X, AlertOctagon, LogIn, FileArchive } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onLoginSuccess: (user: UserAccount, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess
}) => {
  const [username, setUsername] = useState('');
  const [bundle, setBundle] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !bundle) {
      setErrorMessage('Please provide your username and identity bundle (.zip).');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await ApiClient.ledgerLogin(username.trim(), bundle);
      onLoginSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ledger authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-hard)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-hard)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-sidebar)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff' }}>
                SECURE OPERATOR AUTHENTICATION
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                HYPERLEDGER FABRIC IDENTITY SIGN-IN
              </div>
            </div>
          </div>
          {currentUser && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {errorMessage && (
            <div className="tactical-alert tactical-alert-danger" style={{ marginBottom: '16px' }}>
              <AlertOctagon size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="tactical-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: '12px' }}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                IDENTITY BUNDLE (.ZIP)
              </label>
              <label className="tactical-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', fontSize: '12px', cursor: 'pointer' }}>
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
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="tactical-btn tactical-btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '6px', justifyContent: 'center' }}
            >
              <LogIn size={15} />
              <span>{isLoading ? 'VERIFYING WITH LEDGER...' : 'SIGN IN TO VAULT'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
