import React, { useEffect, useState } from 'react';
import { AlertOctagon, RotateCcw, Save, X } from 'lucide-react';
import { ApiClient, LedgerConnection } from '../api/client';

interface LedgerSettingsPanelProps {
  onClose: () => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '6px',
  fontFamily: 'var(--font-mono)'
};

const hintStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-dim)',
  marginTop: '6px',
  fontFamily: 'var(--font-mono)'
};

const buttonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.03em',
  justifyContent: 'center'
};

/**
 * Where the app reaches the ledger: one host and one port. Each user connects to
 * their own organization's peer; with the port left empty, each org keeps its
 * default port (7051 for Org1, 9051 for Org2).
 */
export const LedgerSettingsPanel: React.FC<LedgerSettingsPanelProps> = ({ onClose }) => {
  const [connection, setConnection] = useState<LedgerConnection | null>(null);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const show = (c: LedgerConnection) => {
    setConnection(c);
    setHost(c.saved?.host ?? c.defaults.host);
    setPort(c.saved?.port != null ? String(c.saved.port) : '');
  };

  useEffect(() => {
    ApiClient.getLedgerConnection().then(show).catch(err => setError(err.message));
  }, []);

  const apply = async (value: { host: string; port: number | null } | null) => {
    try {
      setIsSaving(true);
      setError(null);
      show(await ApiClient.setLedgerConnection(value));
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = port.trim();
    if (trimmed && !/^\d+$/.test(trimmed)) {
      setError('The port must be a number from 1 to 65535, or empty.');
      return;
    }
    apply({ host: host.trim(), port: trimmed ? Number(trimmed) : null });
  };

  const defaults = connection?.defaults;

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', color: '#ffffff' }}>
          LEDGER CONNECTION
        </div>
        <button type="button" onClick={onClose} aria-label="Close ledger settings"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="tactical-alert tactical-alert-danger">
          <AlertOctagon size={16} style={{ flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}

      <div>
        <label style={labelStyle}>HOST</label>
        <input
          type="text"
          value={host}
          onChange={e => setHost(e.target.value)}
          placeholder={defaults?.host ?? 'localhost'}
          className="tactical-input"
          style={{ width: '100%' }}
          spellCheck={false}
          required
        />
      </div>

      <div>
        <label style={labelStyle}>PORT</label>
        <input
          type="text"
          inputMode="numeric"
          value={port}
          onChange={e => setPort(e.target.value)}
          placeholder={defaults ? `Org default (${defaults.org1Port} / ${defaults.org2Port})` : ''}
          className="tactical-input"
          style={{ width: '100%' }}
        />
        <div style={hintStyle}>
          Leave empty to use each organization's default port.
        </div>
      </div>

      {connection && (
        <div style={{ ...hintStyle, marginTop: 0 }}>
          Currently: Org1 users → {connection.peers.org1} · Org2 users → {connection.peers.org2}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" disabled={isSaving || !connection?.saved} onClick={() => apply(null)}
                className="tactical-btn" style={buttonStyle}>
          <RotateCcw size={14} />
          <span>RESET TO DEFAULTS</span>
        </button>
        <button type="submit" disabled={isSaving} className="tactical-btn tactical-btn-primary" style={buttonStyle}>
          <Save size={14} />
          <span>{isSaving ? 'RECONNECTING...' : 'SAVE'}</span>
        </button>
      </div>
    </form>
  );
};
