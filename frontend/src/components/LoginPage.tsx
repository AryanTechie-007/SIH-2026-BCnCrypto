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
        rank: 'Officer / Analyst',
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
      backgroundColor: '#000000',
      backgroundImage: 'radial-gradient(ellipse at 50% 20%, rgba(0, 255, 102, 0.10), transparent 70%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: '#00ff66'
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px', maxWidth: '540px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#000000',
          border: '1px solid #00ff66',
          padding: '4px 12px',
          borderRadius: '20px',
          color: '#00ff66',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          marginBottom: '10px'
        }}>
          <Shield size={13} />
          <span>CIPHERTRACE &bull; FORENSIC SECURITY PLATFORM</span>
        </div>
        <h1 style={{
          fontSize: '25px',
          fontWeight: 900,
          letterSpacing: '0.04em',
          color: '#00ff66',
          marginBottom: '6px'
        }}>
          Operator Authentication
        </h1>
        <p style={{
          fontSize: '12px',
          color: 'var(--text-dim)',
          lineHeight: '1.5',
          fontFamily: 'var(--font-mono)'
        }}>
          Enter credentials to authenticate into the secure workstation.
        </p>
      </div>

      {/* Main Authentication Card */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: '#000000',
        border: '1px solid var(--border-hard)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95)',
        overflow: 'hidden'
      }}>
        {/* Card Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-hard)', backgroundColor: '#000000' }}>
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMessage(null); }}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              letterSpacing: '0.05em',
              background: tab === 'login' ? '#042f1a' : 'transparent',
              color: tab === 'login' ? '#00ff66' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'login' ? '2px solid #00ff66' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
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
              padding: '14px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              letterSpacing: '0.05em',
              background: tab === 'register' ? '#042f1a' : 'transparent',
              color: tab === 'register' ? '#00ff66' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'register' ? '2px solid #00ff66' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <UserPlus size={14} />
            <span>REGISTER NEW IDENTITY</span>
          </button>
        </div>

        {/* Card Body */}
        <div style={{ padding: '22px' }}>
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
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', fontFamily: 'var(--font-mono)' }}>
                  OPERATOR USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter operator username or ID"
                  className="tactical-input"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '12px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', fontFamily: 'var(--font-mono)' }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter security password"
                  className="tactical-input"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '12px' }}
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
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  justifyContent: 'center',
                  marginTop: '4px'
                }}
              >
                <LogIn size={15} />
                <span>{isLoading ? 'VERIFYING CREDENTIALS...' : 'LOG IN'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                  USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Choose unique username"
                  className="tactical-input"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                  FULL NAME
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Operator Name"
                  className="tactical-input"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="tactical-input"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="tactical-btn tactical-btn-primary"
                style={{ width: '100%', padding: '11px', justifyContent: 'center', marginTop: '4px' }}
              >
                <Cpu size={14} />
                <span>{isLoading ? 'GENERATING PQC LATTICE KEYS...' : 'REGISTER & ENROLL'}</span>
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
