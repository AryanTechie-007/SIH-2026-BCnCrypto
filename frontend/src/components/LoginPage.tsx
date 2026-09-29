import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { UserAccount, Officer } from '../types';
import { LogIn, UserPlus, Shield, AlertOctagon, ShieldCheck, Cpu } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount, token: string) => void;
  enrolledUsers: Officer[];
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, enrolledUsers: _enrolledUsers }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().replace(/^@+/, '');
    if (!cleanUser || !password) {
      setErrorMessage('Please provide both username and password.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await ApiClient.login({ username: cleanUser, password });
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Username and password are required.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await ApiClient.register({
        username: username.trim(),
        password,
        display_name: displayName.trim() || username.trim(),
        rank: 'User',
        device_id: `DEV-${username.trim().toUpperCase()}`
      });
      setSuccessMessage(res.message);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Identity registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-core)',
      backgroundImage: 'radial-gradient(circle at 50% 15%, rgba(2, 132, 199, 0.08), transparent 60%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: 'var(--text-main)'
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px', maxWidth: '520px' }}>
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
          <Shield size={13} />
          <span>CIPHERTRACE &bull; POST-QUANTUM WORKSTATION</span>
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
          Access the NIST FIPS 203 & 204 quantum-resistant cryptographic workstation.
        </p>
      </div>

      {/* Main Authentication Card */}
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-hard)',
        borderRadius: '6px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        {/* Card Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-hard)', backgroundColor: 'var(--bg-panel-alt)' }}>
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMessage(null); }}
            style={{
              flex: 1,
              padding: '13px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.05em',
              background: tab === 'login' ? 'var(--bg-panel)' : 'transparent',
              color: tab === 'login' ? '#38bdf8' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'login' ? '2px solid #38bdf8' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <LogIn size={14} />
            <span>LOG IN</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setErrorMessage(null); }}
            style={{
              flex: 1,
              padding: '13px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.05em',
              background: tab === 'register' ? 'var(--bg-panel)' : 'transparent',
              color: tab === 'register' ? '#38bdf8' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'register' ? '2px solid #38bdf8' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <UserPlus size={14} />
            <span>ENROLL IDENTITY</span>
          </button>
        </div>

        {/* Card Body */}
        <div style={{ padding: '24px' }}>
          {errorMessage && (
            <div className="tactical-alert tactical-alert-danger" style={{ marginBottom: '16px' }}>
              <AlertOctagon size={16} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="tactical-alert tactical-alert-success" style={{ marginBottom: '16px' }}>
              <ShieldCheck size={16} style={{ flexShrink: 0 }} />
              <div>{successMessage}</div>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                  USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. alice, bob, charlie"
                  className="tactical-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter security password"
                  className="tactical-input"
                  required
                />
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
                <span>{isLoading ? 'AUTHENTICATING...' : 'ACCESS WORKSTATION'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', fontFamily: 'var(--font-mono)' }}>
                  DESIRED USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Unique username identifier"
                  className="tactical-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', fontFamily: 'var(--font-mono)' }}>
                  FULL NAME
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Alice Chen"
                  className="tactical-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', fontFamily: 'var(--font-mono)' }}>
                  SECURITY CREDENTIAL PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create strong passphrase"
                  className="tactical-input"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="tactical-btn tactical-btn-primary"
                style={{ width: '100%', padding: '11px', justifyContent: 'center', marginTop: '6px' }}
              >
                <Cpu size={14} />
                <span>{isLoading ? 'GENERATING NIST PQC LATTICE KEYSTORE...' : 'GENERATE KEYSTORE & ENROLL'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
