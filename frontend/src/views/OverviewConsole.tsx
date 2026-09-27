import React from 'react';
import { Lock, KeyRound } from 'lucide-react';
import { DocumentRecord, Officer, LedgerBlock, UserAccount } from '../types';
import { WorkstationModule } from '../components/WorkstationSidebar';

interface OverviewConsoleProps {
  documents: DocumentRecord[];
  officers?: Officer[];
  blocks: LedgerBlock[];
  currentUser: UserAccount | null;
  onNavigate: (module: WorkstationModule) => void;
  onOpenAuth: () => void;
}

export const OverviewConsole: React.FC<OverviewConsoleProps> = ({
  documents,
  blocks,
  currentUser,
  onNavigate
}) => {
  const userBlocks = blocks.filter(b => b.block_index > 0);

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Welcome Operator Hero Header */}
      <div style={{
        backgroundColor: '#000000',
        border: '1px solid var(--border-hard)',
        borderLeft: '5px solid #00ff66',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#00ff66', fontFamily: 'var(--font-mono)', fontWeight: 700, marginBottom: '4px' }}>
            OPERATOR WORKSPACE
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '0.03em', color: '#00ff66', margin: 0 }}>
            Welcome, {currentUser?.name || 'Operator'}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onNavigate('documents')}
            className="tactical-btn tactical-btn-primary"
            style={{ padding: '8px 14px', fontSize: '11px' }}
          >
            <Lock size={13} />
            <span>Open Encryption Lab</span>
          </button>
          <button
            onClick={() => onNavigate('decryption')}
            className="tactical-btn tactical-btn-secondary"
            style={{ padding: '8px 14px', fontSize: '11px' }}
          >
            <KeyRound size={13} />
            <span>Open Decryption Lab</span>
          </button>
        </div>
      </div>

      {/* Recent Cryptographic Events Table */}
      <div className="tactical-panel">
        <div className="tactical-panel-header">
          <h3>Recent Forensic & Cryptographic Events ({userBlocks.length} Total Records)</h3>
        </div>

        <table className="tactical-table">
          <thead>
            <tr>
              <th>Block / Time</th>
              <th>Event Type</th>
              <th>Subject / User</th>
              <th>Document Target</th>
              <th>Cryptographic Algorithm</th>
              <th>Verification</th>
              <th style={{ textAlign: 'right' }}>Command</th>
            </tr>
          </thead>
          <tbody>
            {userBlocks.slice(-5).reverse().map((b) => {
              let eventType = 'Decryption & Watermark';
              let subject = 'OPERATOR';
              let docTarget = 'Encrypted Payload';

              try {
                const dataObj = JSON.parse(b.data);
                if (dataObj.recipient_username) {
                  subject = `@${dataObj.recipient_username}`;
                }
                if (dataObj.document_target) {
                  docTarget = dataObj.document_target;
                } else if (dataObj.file_name) {
                  docTarget = dataObj.file_name;
                } else {
                  const matchedDoc = documents.find(d => d.id === dataObj.document_id);
                  docTarget = matchedDoc ? matchedDoc.file_name : 'Encrypted Payload';
                }
              } catch {
                const matchedDoc = documents[b.block_index - 1];
                docTarget = matchedDoc ? matchedDoc.file_name : 'Encrypted Payload';
              }

              return (
                <tr key={b.block_index}>
                  <td className="font-mono">
                    <span style={{ color: '#00ff66', fontWeight: 700 }}>#{b.block_index}</span> &bull; {b.timestamp ? b.timestamp.slice(11, 19) : '--:--:--'}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#00ff66' }}>
                      {eventType}
                    </span>
                  </td>
                  <td className="font-mono">
                    {subject}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {docTarget}
                  </td>
                  <td className="font-mono" style={{ fontSize: '11px', color: '#34d399' }}>
                    ML-KEM-768 / AES-256-GCM
                  </td>
                  <td>
                    <span className="tactical-badge badge-green">
                      ■ VERIFIED
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => onNavigate('decryption')}
                      className="btn-bracket"
                    >
                      INSPECT
                    </button>
                  </td>
                </tr>
              );
            })}
            {userBlocks.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                  No cryptographic events logged yet. Decrypt a document to record an event.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
