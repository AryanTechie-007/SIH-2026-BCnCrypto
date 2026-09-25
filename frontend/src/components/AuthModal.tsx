import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { UserAccount } from '../types';
import { ShieldCheck, Lock, User, Key, Cpu, X, AlertOctagon, UserPlus, LogIn, Zap } from 'lucide-react';

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
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rank, setRank] = useState('OFFICER');
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await ApiClient.login({ username: username.trim(), password });
      onLoginSuccess(res.user, res.token);
      onClose();
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
        device_id: deviceId.trim() || undefined
      });
      setSuccessMessage(res.message);
      onLoginSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCreate = async (quickUsername: string, quickName: string, quickRank: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      // Try logging in first in case already created
      try {
        const loginRes = await ApiClient.login({ username: quickUsername, password: 'password123' });
        onLoginSuccess(loginRes.user, loginRes.token);
        onClose();
        return;
      } catch {
        // If not created yet, register
        const regRes = await ApiClient.register({
          username: quickUsername,
          password: 'password123',
          display_name: quickName,
          rank: quickRank,
          device_id: `DEF-HW-${quickUsername.toUpperCase()}`
        });
        onLoginSuccess(regRes.user, regRes.token);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to setup ${quickUsername}`);
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
      backgroundColor: 'rgba(5, 8, 14, 0.88)',
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
        backgroundColor: '#0c121e',
        border: '1px solid var(--border-active)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-hard)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#070b13'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff' }}>
                TACTICAL DEFENSE AUTHENTICATION
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                NIST FIPS 203 / 204 POST-QUANTUM IDENTITY PROTOCOL
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

        {/* Tab Toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-hard)', backgroundColor: '#090e18' }}>
          <button
            onClick={() => { setTab('login'); setErrorMessage(null); }}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              background: tab === 'login' ? '#0f172a' : 'transparent',
              color: tab === 'login' ? '#38bdf8' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'login' ? '2px solid #38bdf8' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            <LogIn size={13} style={{ display: 'inline', marginRight: '6px' }} />
            OPERATOR LOGIN
          </button>
          <button
            onClick={() => { setTab('register'); setErrorMessage(null); }}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              background: tab === 'register' ? '#0f172a' : 'transparent',
              color: tab === 'register' ? '#38bdf8' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'register' ? '2px solid #38bdf8' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            <UserPlus size={13} style={{ display: 'inline', marginRight: '6px' }} />
            ENROLL NEW OPERATOR
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {errorMessage && (
            <div className="tactical-alert tactical-alert-danger" style={{ marginBottom: '16px' }}>
              <AlertOctagon size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="tactical-alert tactical-alert-success" style={{ marginBottom: '16px' }}>
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>{successMessage}</div>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  OPERATOR USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. alice, bob, aryan"
                  className="tactical-input"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '12px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  SECURITY CREDENTIAL / PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter operator password"
                  className="tactical-input"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '12px' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="tactical-btn tactical-btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '6px', justifyContent: 'center' }}
              >
                <LogIn size={15} />
                <span>{isLoading ? 'AUTHENTICATING ENCLAVE...' : 'AUTHENTICATE & ACCESS CONSOLE'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    USERNAME
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. bob"
                    className="tactical-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    FULL CALLSIGN / NAME
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="e.g. Captain Bob"
                    className="tactical-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create password"
                    className="tactical-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    MILITARY RANK
                  </label>
                  <select
                    value={rank}
                    onChange={e => setRank(e.target.value)}
                    className="tactical-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', backgroundColor: '#090e18', color: '#ffffff' }}
                  >
                    <option value="CAPTAIN">CAPTAIN</option>
                    <option value="COMMANDER">COMMANDER</option>
                    <option value="LIEUTENANT">LIEUTENANT</option>
                    <option value="WING COMMANDER">WING COMMANDER</option>
                    <option value="OPERATOR">OPERATOR</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  HARDWARE DEVICE ID (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={deviceId}
                  onChange={e => setDeviceId(e.target.value)}
                  placeholder="Leave blank for auto-generation"
                  className="tactical-input"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                />
              </div>

              <div style={{
                padding: '8px 12px',
                backgroundColor: '#08111e',
                border: '1px solid #14233c',
                fontSize: '10px',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)'
              }}>
                ℹ️ Automatically provisions NIST FIPS 203 ML-KEM-768 & FIPS 204 ML-DSA-65 post-quantum keypairs.
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="tactical-btn tactical-btn-primary"
                style={{ width: '100%', padding: '10px', marginTop: '4px', justifyContent: 'center' }}
              >
                <Cpu size={14} />
                <span>{isLoading ? 'GENERATING NIST PQC KEYS...' : 'PROVISION PQC IDENTITY & ENROLL'}</span>
              </button>
            </form>
          )}

          {/* Quick Setup Shortcuts for Testing */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-hard)' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: '8px' }}>
              ⚡ QUICK TESTING PROVISIONS (1-CLICK SETUP)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleQuickCreate('alice', 'Commander Alice', 'COMMANDER')}
                disabled={isLoading}
                className="tactical-btn tactical-btn-secondary"
                style={{ fontSize: '11px', padding: '8px 10px', justifyContent: 'center' }}
              >
                <Zap size={12} style={{ color: '#38bdf8' }} />
                <span>Login as "Alice" (Sender)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickCreate('bob', 'Captain Bob', 'CAPTAIN')}
                disabled={isLoading}
                className="tactical-btn tactical-btn-secondary"
                style={{ fontSize: '11px', padding: '8px 10px', justifyContent: 'center' }}
              >
                <Zap size={12} style={{ color: '#10b981' }} />
                <span>Login as "Bob" (Recipient)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
