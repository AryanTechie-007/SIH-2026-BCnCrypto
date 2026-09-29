import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { Officer, UserAccount } from '../types';
import { UserPlus, Key, Copy, Check, Eye, EyeOff, Search, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface AccountManagementConsoleProps {
  officers: Officer[];
  currentUser: UserAccount | null;
  onAccountCreated: () => void;
}

export const AccountManagementConsole: React.FC<AccountManagementConsoleProps> = ({
  officers,
  currentUser: _currentUser,
  onAccountCreated
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // New account form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const toggleShowPassword = (id: number) => {
    setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPassword = (id: number, pwd?: string) => {
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let generated = '';
    for (let i = 0; i < 16; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password) {
      setFormError('Username and password are required.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      setFormSuccess(null);

      const res = await ApiClient.register({
        username: cleanUser,
        password: password,
        display_name: fullName.trim() || cleanUser,
        rank: 'User',
        device_id: `DEV-${cleanUser.toUpperCase()}`
      });

      setFormSuccess(`Identity '${res.user.name}' successfully enrolled! Keystore password saved.`);
      setFullName('');
      setUsername('');
      setPassword('');
      onAccountCreated();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create identity account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOfficers = officers.filter(o =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.username && o.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    o.navy_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-hard)',
        borderLeft: '4px solid #2563eb',
        borderRadius: '4px',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
            Account Management &amp; Keystore Directory
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            Enroll user identities and retrieve saved cryptographic keystore credentials.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            padding: '6px 14px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: '#3b82f6'
          }}>
            <ShieldCheck size={14} />
            <span>{officers.length} Registered Identities</span>
          </div>
          <button
            onClick={onAccountCreated}
            className="tactical-btn tactical-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid: Create Form on Left, Accounts Directory on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Left Column: Create New Identity */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-panel-alt)',
            borderBottom: '1px solid var(--border-hard)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '12px',
            letterSpacing: '0.04em'
          }}>
            <UserPlus size={16} color="#3b82f6" />
            <span>ENROLL NEW IDENTITY</span>
          </div>

          <form onSubmit={handleCreateAccount} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {formError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '10px',
                borderRadius: '3px',
                fontSize: '11px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                color: '#6ee7b7',
                padding: '10px',
                borderRadius: '3px',
                fontSize: '11px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <ShieldCheck size={15} style={{ flexShrink: 0 }} />
                <span>{formSuccess}</span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>
                FULL NAME
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-hard)',
                  borderRadius: '3px',
                  color: '#ffffff',
                  fontSize: '12px'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-hard)',
                  borderRadius: '3px',
                  color: '#ffffff',
                  fontSize: '12px'
                }}
                required
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  KEYSTORE PASSWORD
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    fontSize: '10px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Generate Strong
                </button>
              </div>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-hard)',
                  borderRadius: '3px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)'
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="tactical-btn tactical-btn-primary"
              style={{
                marginTop: '10px',
                padding: '11px',
                fontSize: '12px',
                fontWeight: 700,
                width: '100%',
                backgroundColor: '#2563eb',
                borderColor: '#3b82f6'
              }}
            >
              <Key size={14} />
              <span>{isSubmitting ? 'GENERATING PQC KEYSTORE...' : 'ENROLL IDENTITY & SAVE KEYSTORE'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Keystore Directory Table */}
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          {/* Table Header with Search */}
          <div style={{
            backgroundColor: 'var(--bg-panel-alt)',
            borderBottom: '1px solid var(--border-hard)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '12px', letterSpacing: '0.04em' }}>
              SAVED IDENTITIES &amp; KEYSTORE PASSWORDS
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-input)', padding: '5px 10px', borderRadius: '4px', border: '1px solid var(--border-hard)', maxWidth: '280px', flex: 1 }}>
              <Search size={13} color="var(--text-dim)" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '11px',
                  width: '100%'
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="tactical-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>User ID</th>
                  <th>Keystore Password</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOfficers.map(user => {
                  const isVisible = showPasswordMap[user.id] || false;
                  const isCopied = copiedId === user.id;
                  const pwd = user.keystore_password || '';

                  return (
                    <tr key={user.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{user.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>@{user.username || user.navy_id}</div>
                      </td>
                      <td className="font-mono" style={{ color: '#3b82f6', fontSize: '11px' }}>
                        {user.navy_id}
                      </td>
                      <td>
                        {pwd ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="font-mono" style={{
                              color: isVisible ? '#60a5fa' : 'var(--text-muted)',
                              fontSize: '12px',
                              letterSpacing: isVisible ? 'normal' : '0.15em'
                            }}>
                              {isVisible ? pwd : '••••••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleShowPassword(user.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                              title={isVisible ? 'Hide password' : 'Show password'}
                            >
                              {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Standard Protected</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {pwd ? (
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(user.id, pwd)}
                            className="tactical-btn"
                            style={{
                              padding: '4px 10px',
                              fontSize: '10px',
                              backgroundColor: isCopied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(37, 99, 235, 0.1)',
                              borderColor: isCopied ? '#10b981' : '#2563eb',
                              color: isCopied ? '#34d399' : '#3b82f6'
                            }}
                          >
                            {isCopied ? <Check size={11} /> : <Copy size={11} />}
                            <span>{isCopied ? 'Copied!' : 'Copy Password'}</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Enrolled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredOfficers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                      No identities registered yet. Use the form on the left to enroll your first user identity.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
