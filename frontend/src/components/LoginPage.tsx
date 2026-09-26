import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { UserAccount, Officer } from '../types';
import { Lock, LogIn, UserPlus, Shield, KeyRound, AlertOctagon, ShieldCheck, Cpu } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount, token: string) => void;
  enrolledUsers: Officer[];
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, enrolledUsers }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rank, setRank] = useState('Officer / Analyst');
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please provide both username and password.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await ApiClient.login({ username: username.trim(), password });
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
        rank,
        device_id: deviceId.trim() || `DEV-${username.trim().toUpperCase()}`
      });
      setSuccessMessage(res.message);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Identity registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (uname: string) => {
    setUsername(uname);
    setPassword('password123');
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#05080e',
      backgroundImage: 'radial-gradient(ellipse at 50% 20%, rgba(2, 132, 199, 0.12), transparent 70%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: '#ffffff'
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px', maxWidth: '540px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#0a1d2e',
          border: '1px solid #0284c7',
          padding: '4px 12px',
          borderRadius: '20px',
          color: '#38bdf8',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          marginBottom: '12px'
        }}>
          <Shield size={13} />
          <span>CIPHERTRACE 2.0 &bull; FORENSIC SECURITY PLATFORM</span>
        </div>
        <h1 style={{
          fontSize: '26px',
          fontWeight: 900,
          letterSpacing: '0.04em',
          color: '#ffffff',
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
          Enter credentials to access the Post-Quantum Encryption Lab, Decryption Lab, and Forensic Leak Attribution Lab.
        </p>
      </div>

      {/* Main Authentication Card */}
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: '#0c121e',
        border: '1px solid #1e293b',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
        overflow: 'hidden'
      }}>
        {/* Card Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-hard)', backgroundColor: '#070b13' }}>
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
              background: tab === 'login' ? '#0c121e' : 'transparent',
              color: tab === 'login' ? '#38bdf8' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'login' ? '2px solid #38bdf8' : '2px solid transparent',
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
              background: tab === 'register' ? '#0c121e' : 'transparent',
              color: tab === 'register' ? '#38bdf8' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'register' ? '2px solid #38bdf8' : '2px solid transparent',
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
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                  OPERATOR USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. user_aryan, officer_sharma"
                  className="tactical-input"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '12px' }}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your security password"
                  className="tactical-input"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '12px' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="tactical-btn tactical-btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  justifyContent: 'center',
                  marginTop: '6px'
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                    ROLE / RANK
                  </label>
                  <input
                    type="text"
                    value={rank}
                    onChange={e => setRank(e.target.value)}
                    placeholder="Role"
                    className="tactical-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                    required
                  />
                </div>
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

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                  DEVICE IDENTIFIER (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={deviceId}
                  onChange={e => setDeviceId(e.target.value)}
                  placeholder="e.g. WORKSTATION-ALPHA"
                  className="tactical-input"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                />
              </div>

              <div style={{
                padding: '8px 10px',
                backgroundColor: '#08111e',
                border: '1px solid #14233c',
                fontSize: '10px',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)'
              }}>
                ℹ️ Automatically generates post-quantum ML-KEM-768 lattice keypair and ML-DSA-65 digital signature keys upon enrollment.
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

          {/* Quick-Fill Helper for Testing (No "Login as Sender/Recipient", just quick populate) */}
          {enrolledUsers.length > 0 && tab === 'login' && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-hard)' }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--text-dim)',
                letterSpacing: '0.05em',
                marginBottom: '8px',
                fontFamily: 'var(--font-mono)'
              }}>
                ENROLLED SYSTEM ACCOUNTS (CLICK TO AUTOFILL):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                {enrolledUsers.slice(0, 4).map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickLogin(u.username || u.navy_id)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#070b13',
                      border: '1px solid var(--border-hard)',
                      color: '#ffffff',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '2px',
                      textAlign: 'left'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>{u.name}</span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: '6px', fontSize: '10px' }}>[{u.rank}]</span>
                    </div>
                    <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                      @{u.username || u.navy_id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '10px 20px',
          backgroundColor: '#070b13',
          borderTop: '1px solid var(--border-hard)',
          fontSize: '10px',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>NIST FIPS 203 / 204 SUITE</span>
          <span>AES-256-GCM + 2D DCT STEGO</span>
        </div>
      </div>
    </div>
  );
};
