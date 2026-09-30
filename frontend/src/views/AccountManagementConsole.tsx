import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { Officer, UserAccount, LedgerIdentityStatus } from '../types';
import {
  Key,
  RefreshCw,
  UserCheck,
  HardDrive,
  Lock,
  Terminal,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface AccountManagementConsoleProps {
  officers?: Officer[];
  currentUser: UserAccount | null;
  onAccountCreated?: () => void;
  onOpenAuth?: () => void;
}

const panel: React.CSSProperties = {
  backgroundColor: 'var(--bg-panel)',
  border: '1px solid var(--border-hard)',
  borderRadius: '4px',
  overflow: 'hidden'
};

const panelHeader: React.CSSProperties = {
  backgroundColor: 'var(--bg-panel-alt)',
  borderBottom: '1px solid var(--border-hard)',
  padding: '14px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between'
};

const panelTitle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: '12px',
  letterSpacing: '0.04em'
};

const tag: React.CSSProperties = {
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
  backgroundColor: 'rgba(255,255,255,0.05)',
  padding: '2px 8px',
  borderRadius: '3px'
};

function formatUtc(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const Field: React.FC<{ label: string; value: React.ReactNode; color?: string; last?: boolean }> = ({ label, value, color, last }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    borderBottom: last ? 'none' : '1px dashed var(--border-subtle)',
    paddingBottom: last ? 0 : '8px'
  }}>
    <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>{label}</span>
    <span className="font-mono" style={{ color: color || '#e2e8f0', fontSize: '11px', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
  </div>
);

const PublicKey: React.FC<{ title: string; standard: string; purpose: string; preview?: string; fingerprint?: string; color: string }> = (
  { title, standard, purpose, preview, fingerprint, color }
) => (
  <div style={{ backgroundColor: 'var(--bg-core)', border: '1px solid var(--border-subtle)', borderRadius: '3px', padding: '12px 14px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color }}>{title}</span>
      <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{standard}</span>
    </div>
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{purpose}</div>
    <div className="font-mono" style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all' }}>
      {preview || 'No key on record'}
    </div>
    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px' }}>
      SHA-256 FINGERPRINT
      <div className="font-mono" style={{ color: '#cbd5e1', fontSize: '11px', wordBreak: 'break-all', marginTop: '2px' }}>
        {fingerprint || '—'}
      </div>
    </div>
  </div>
);

const RegistryStatus: React.FC<{ status: LedgerIdentityStatus | null; loading: boolean }> = ({ status, loading }) => {
  let color = 'var(--text-muted)';
  let icon = <RefreshCw size={14} className="spin" />;
  let text: React.ReactNode = 'Checking the ledger key registry…';

  if (!loading && status) {
    switch (status.key_registry_status) {
      case 'REGISTERED':
        color = '#10b981';
        icon = <ShieldCheck size={14} />;
        text = <>Published on the ledger key registry on {formatUtc(status.registered_at)}. Matches the keys on this device.</>;
        break;
      case 'NOT_REGISTERED':
        color = '#f59e0b';
        icon = <AlertTriangle size={14} />;
        text = 'Not published on the ledger key registry yet. Sign in again to publish your public keys.';
        break;
      case 'MISMATCH':
        color = '#ef4444';
        icon = <AlertTriangle size={14} />;
        text = 'The keys registered on the ledger do not match the keys on this device. Senders will encrypt to the ledger keys.';
        break;
      default:
        color = 'var(--text-muted)';
        icon = <AlertTriangle size={14} />;
        text = <>Ledger unavailable{status.detail ? `: ${status.detail}` : ''}</>;
    }
  } else if (!loading) {
    icon = <AlertTriangle size={14} />;
    text = 'Could not read the ledger status.';
  }

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      alignItems: 'flex-start',
      fontSize: '11px',
      color,
      border: '1px solid var(--border-subtle)',
      backgroundColor: 'rgba(0, 0, 0, 0.25)',
      borderRadius: '4px',
      padding: '10px 12px',
      lineHeight: 1.5
    }}>
      <span style={{ flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
};

export const AccountManagementConsole: React.FC<AccountManagementConsoleProps> = ({
  currentUser,
  onOpenAuth
}) => {
  const [profile, setProfile] = useState<UserAccount | null>(currentUser);
  const [ledger, setLedger] = useState<LedgerIdentityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    setIsLedgerLoading(true);
    try {
      const data = await ApiClient.getCurrentUser();
      if (data) setProfile(data);
    } catch {
      if (currentUser) setProfile(currentUser);
    } finally {
      setIsLoading(false);
    }
    try {
      setLedger(await ApiClient.getLedgerIdentity());
    } catch {
      setLedger(null);
    } finally {
      setIsLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setProfile(currentUser);
    }
    refresh();
  }, [currentUser?.id, currentUser?.username]);

  // If no user is logged in
  if (!profile) {
    return (
      <div style={{ padding: '32px 24px', maxWidth: '800px', margin: '40px auto 0 auto' }}>
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-hard)',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '6px',
          padding: '32px',
          textAlign: 'center'
        }}>
          <ShieldAlert size={48} color="#3b82f6" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
            Not signed in
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
            Sign in with your ledger identity bundle and keystore passphrase to see your account and public keys.
          </p>
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="tactical-btn tactical-btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#2563eb',
                borderColor: '#3b82f6',
                margin: '0 auto'
              }}
            >
              <UserCheck size={14} />
              <span>SIGN IN</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const cert = ledger?.certificate;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Page Header */}
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
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            My Account
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Your ledger identity, local keystore, and the public keys others use to reach you.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={isLoading || isLedgerLoading}
          className="tactical-btn tactical-btn-secondary"
          style={{ padding: '6px 14px', fontSize: '11px' }}
          title="Reload your account and ledger status"
        >
          <RefreshCw size={12} className={isLoading || isLedgerLoading ? 'spin' : ''} />
          <span>{isLoading || isLedgerLoading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '20px', alignItems: 'start' }}>

        {/* Left Column: Ledger Identity */}
        <div style={panel}>
          <div style={panelHeader}>
            <div style={panelTitle}>
              <UserCheck size={16} color="#3b82f6" />
              <span>LEDGER IDENTITY</span>
            </div>
            <span style={tag}>HYPERLEDGER FABRIC</span>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '6px',
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                border: '1px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 800,
                color: '#60a5fa'
              }}>
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profile.username}
                </div>
                <div style={{ fontSize: '12px', color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {profile.fabric_msp_id || 'Organization unknown'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="ORGANIZATION" value={profile.fabric_msp_id || '—'} color="#38bdf8" />
              <Field label="CERTIFICATE NAME" value={cert?.common_name || (isLedgerLoading ? '…' : '—')} />
              <Field label="CERTIFICATE ROLE" value={cert?.role || (isLedgerLoading ? '…' : '—')} />
              <Field label="ISSUED BY" value={cert?.issuer || (isLedgerLoading ? '…' : '—')} />
              <Field label="EXPIRES" value={cert ? formatUtc(cert.expires_at) : (isLedgerLoading ? '…' : '—')} last />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Keystore */}
          <div style={{ ...panel, borderTop: '3px solid #2563eb' }}>
            <div style={panelHeader}>
              <div style={panelTitle}>
                <Key size={16} color="#3b82f6" />
                <span>LOCAL KEYSTORE</span>
              </div>
              <span style={tag}>ARGON2ID + AES-256-GCM</span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                padding: '12px 14px',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#bfdbfe',
                lineHeight: 1.5,
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start'
              }}>
                <Lock size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#60a5fa' }} />
                <div>
                  Your ML-KEM and ML-DSA private keys live only in this keystore on this device, encrypted under
                  your <strong>passphrase</strong>. The passphrase is never stored: it unlocks the keystore for
                  this session and is forgotten when you sign out. It cannot be recovered if forgotten.
                </div>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-core)',
                border: '1px solid var(--border-hard)',
                borderRadius: '4px',
                padding: '16px 20px'
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>
                  KEYSTORE STATUS
                </div>
                {profile.keystore_file ? (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={15} />
                    Unlocked for this session
                  </span>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No keystore on this device</span>
                )}
              </div>

              <div style={{
                fontSize: '11px',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                padding: '12px 14px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <HardDrive size={11} />
                  <span>KEYSTORE FILE</span>
                </div>
                <div className="font-mono" style={{ color: '#ffffff', fontSize: '11px', wordBreak: 'break-all' }}>
                  {profile.keystore_file || 'Not on this device'}
                </div>
              </div>
            </div>
          </div>

          {/* Public Keys */}
          <div style={panel}>
            <div style={panelHeader}>
              <div style={panelTitle}>
                <Terminal size={16} color="#38bdf8" />
                <span>PUBLIC KEYS</span>
              </div>
              <span style={tag}>NIST FIPS 203 &amp; 204</span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <RegistryStatus status={ledger} loading={isLedgerLoading} />

              <PublicKey
                title="ML-KEM-768 Encapsulation Key"
                standard="FIPS 203 · 1184 bytes"
                purpose="Senders use this key to encrypt documents for you."
                preview={profile.ml_kem_pub_preview}
                fingerprint={profile.kem_key_fingerprint}
                color="#38bdf8"
              />

              <PublicKey
                title="ML-DSA-65 Verification Key"
                standard="FIPS 204 · 1952 bytes"
                purpose="Verifies your signatures on decryption records. Its fingerprint appears on each of your ledger records."
                preview={profile.ml_dsa_pub_preview}
                fingerprint={profile.dsa_key_fingerprint}
                color="#60a5fa"
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
