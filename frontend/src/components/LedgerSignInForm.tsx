import React, { useState } from 'react';
import { ApiClient, PassphraseNeededError } from '../api/client';
import { UserAccount } from '../types';
import { LogIn, AlertOctagon, FileArchive, KeyRound, ShieldAlert, ArrowRight, UserCheck } from 'lucide-react';

const MIN_PASSPHRASE_LENGTH = 12;

interface LedgerSignInFormProps {
  onLoginSuccess: (user: UserAccount) => void;
  submitLabel?: string;
}

// identity: username + bundle. unlock: this device has a keystore. create: it does not yet.
type Step = 'identity' | 'unlock' | 'create';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '6px',
  fontFamily: 'var(--font-mono)'
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.03em',
  justifyContent: 'center',
  marginTop: '6px'
};

/**
 * Two-step sign-in. Step 1 sends the username and identity bundle; the worker verifies
 * the bundle with the ledger and says whether this device already has the user's
 * keystore. Step 2 then asks for its passphrase, or for a new one to create it.
 */
export const LedgerSignInForm: React.FC<LedgerSignInFormProps> = ({ onLoginSuccess, submitLabel = 'SIGN IN' }) => {
  const [step, setStep] = useState<Step>('identity');
  const [username, setUsername] = useState('');
  const [bundle, setBundle] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanUser = username.trim().replace(/^@+/, '');

  const backToIdentity = () => {
    setStep('identity');
    setPassphrase('');
    setPassphraseConfirm('');
    setErrorMessage(null);
  };

  const attempt = async (pass?: string, confirm?: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await ApiClient.ledgerLogin(cleanUser, bundle as File, pass, confirm);
      onLoginSuccess(res.user);
    } catch (err: any) {
      if (err instanceof PassphraseNeededError) {
        setStep(err.mode);
      } else {
        setErrorMessage(err.message || 'Ledger authentication failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanUser || !bundle) {
      setErrorMessage('Please provide your username and identity bundle (.zip).');
      return;
    }
    attempt();
  };

  const handlePassphrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) {
      setErrorMessage('Please enter your keystore passphrase.');
      return;
    }
    if (step === 'create') {
      if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
        setErrorMessage(`Your passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
        return;
      }
      if (passphrase !== passphraseConfirm) {
        setErrorMessage('The passphrases do not match.');
        return;
      }
      attempt(passphrase, passphraseConfirm);
    } else {
      attempt(passphrase);
    }
  };

  const errorBox = errorMessage && (
    <div className="tactical-alert tactical-alert-danger">
      <AlertOctagon size={16} style={{ flexShrink: 0 }} />
      <div>{errorMessage}</div>
    </div>
  );

  if (step === 'identity') {
    return (
      <form onSubmit={handleIdentity} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {errorBox}

        <div>
          <label style={labelStyle}>USERNAME</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="tactical-input"
            style={{ width: '100%' }}
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label style={labelStyle}>IDENTITY BUNDLE (.ZIP)</label>
          <label className="tactical-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', cursor: 'pointer' }}>
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

        <button type="submit" disabled={isLoading} className="tactical-btn tactical-btn-primary" style={buttonStyle}>
          <ArrowRight size={15} />
          <span>{isLoading ? 'VERIFYING WITH LEDGER...' : 'CONTINUE'}</span>
        </button>
      </form>
    );
  }

  const isCreate = step === 'create';

  return (
    <form onSubmit={handlePassphrase} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Who is signing in, verified in step 1 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        backgroundColor: 'var(--bg-input)',
        border: '1px solid var(--border-hard)',
        borderRadius: '4px'
      }}>
        <UserCheck size={16} style={{ flexShrink: 0, color: '#10b981' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>{cleanUser}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Identity verified · {bundle?.name}
          </div>
        </div>
        <button
          type="button"
          onClick={backToIdentity}
          disabled={isLoading}
          style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', padding: '4px' }}
        >
          Change
        </button>
      </div>

      {errorBox}

      {isCreate && (
        <div className="tactical-alert tactical-alert-warning" style={{ alignItems: 'flex-start' }}>
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ lineHeight: 1.5 }}>
            <strong>First sign-in on this device.</strong> Choose a passphrase to create your keystore; it
            encrypts your private keys. It is never stored anywhere, so it <strong>cannot be recovered</strong>:
            if you forget it, you lose access to your keys and every document sent to you.
          </div>
        </div>
      )}

      <div>
        <label style={labelStyle}>
          {isCreate ? `NEW KEYSTORE PASSPHRASE (MIN ${MIN_PASSPHRASE_LENGTH} CHARACTERS)` : 'KEYSTORE PASSPHRASE'}
        </label>
        <input
          type="password"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          className="tactical-input"
          style={{ width: '100%' }}
          autoComplete={isCreate ? 'new-password' : 'current-password'}
          autoFocus
          required
        />
      </div>

      {isCreate && (
        <div>
          <label style={labelStyle}>CONFIRM PASSPHRASE</label>
          <input
            type="password"
            value={passphraseConfirm}
            onChange={e => setPassphraseConfirm(e.target.value)}
            className="tactical-input"
            style={{ width: '100%' }}
            autoComplete="new-password"
            required
          />
        </div>
      )}

      <button type="submit" disabled={isLoading} className="tactical-btn tactical-btn-primary" style={buttonStyle}>
        {isCreate ? <KeyRound size={15} /> : <LogIn size={15} />}
        <span>
          {isLoading
            ? (isCreate ? 'CREATING KEYSTORE...' : 'UNLOCKING KEYSTORE...')
            : (isCreate ? 'CREATE KEYSTORE & SIGN IN' : submitLabel)}
        </span>
      </button>
    </form>
  );
};
