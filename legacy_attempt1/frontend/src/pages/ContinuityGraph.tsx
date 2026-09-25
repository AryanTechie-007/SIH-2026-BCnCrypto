import React, { useState } from 'react';
import { 
  GitBranch, 
  FileText, 
  Users, 
  Key, 
  Fingerprint, 
  Database, 
  ShieldCheck, 
  ArrowRight, 
  ChevronRight,
  Info
} from 'lucide-react';

interface GraphNode {
  id: string;
  name: string;
  sub: string;
  icon: any;
  type: string;
  color: string;
  details: Record<string, string>;
}

export const ContinuityGraph: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<{
    title: string;
    type: string;
    id: string;
    details: Record<string, string>;
  }>({
    title: 'OPERATION TRIDENT SHIELD',
    type: 'CLASSIFIED_ROOT_DOCUMENT',
    id: 'DOC-2026-X89',
    details: {
      'SHA3-256 Tamper Hash': 'a89f4172c96b3401ef238910021bb49f82d1c01e529fa8194432bc9910ae2817',
      'Classification': 'TOP SECRET // NOFORN',
      'Authority': 'NAVAL CYBER & DEFENSE COMMAND',
      'Origin Date': '2026-09-24 14:00:00'
    }
  });

  const graphData: { level: number; title: string; nodes: GraphNode[] }[] = [
    {
      level: 1,
      title: 'Root Document',
      nodes: [
        {
          id: 'DOC-2026-X89',
          name: 'OPERATION TRIDENT SHIELD',
          sub: 'SHA3-256 Tamper Anchor',
          icon: FileText,
          type: 'DOCUMENT',
          color: 'var(--cyan-primary)',
          details: {
            'Document ID': 'DOC-2026-X89',
            'Canonical SHA3 Hash': 'a89f4172c96b3401ef238910021bb49f82d1c01e529fa8194432bc9910ae2817',
            'Originating Authority': 'Naval Cyber Command',
            'Envelope DEK': 'AES-256-GCM Ephemeral Random'
          }
        }
      ]
    },
    {
      level: 2,
      title: 'Recipients & Envelopes',
      nodes: [
        {
          id: 'NAVY-0231',
          name: 'Capt. A. Verma (Flagship)',
          sub: 'ML-KEM-768 Enclosure',
          icon: Users,
          type: 'RECIPIENT',
          color: 'var(--emerald-primary)',
          details: {
            'Officer ID': 'NAVY-0231',
            'Vessel': 'INS Vikramaditya (Flagship)',
            'Clearance': 'Level-5 Top Secret',
            'ML-KEM Key ID': 'KEM-0231-V1',
            'ML-DSA Key ID': 'SIG-0231-V1'
          }
        },
        {
          id: 'NAVY-0489',
          name: 'Cdr. S. Rao (Destroyer)',
          sub: 'ML-KEM-768 Enclosure',
          icon: Users,
          type: 'RECIPIENT',
          color: 'var(--indigo-primary)',
          details: {
            'Officer ID': 'NAVY-0489',
            'Vessel': 'INS Kolkata (Destroyer Sq 15)',
            'Clearance': 'Level-5 Top Secret',
            'ML-KEM Key ID': 'KEM-0489-V1',
            'ML-DSA Key ID': 'SIG-0489-V1'
          }
        }
      ]
    },
    {
      level: 3,
      title: 'Decryption Sessions',
      nodes: [
        {
          id: 'EVT-9912A',
          name: 'Session #1 (14:32:18 UTC)',
          sub: 'Nonce: NONCE-88A19B',
          icon: Key,
          type: 'SESSION',
          color: 'var(--amber-primary)',
          details: {
            'Session Nonce': 'NONCE-88A19B',
            'Authorized Device': 'DEV-VIKRAM-72A1',
            'Event ID': 'EVT-9912A',
            'Software Version': 'CIPHERTRACE-v1.0.4-AIRGAP'
          }
        },
        {
          id: 'EVT-9912B',
          name: 'Session #2 (16:15:04 UTC)',
          sub: 'Nonce: NONCE-33F41C',
          icon: Key,
          type: 'SESSION',
          color: 'var(--amber-primary)',
          details: {
            'Session Nonce': 'NONCE-33F41C',
            'Authorized Device': 'DEV-VIKRAM-72A1',
            'Event ID': 'EVT-9912B',
            'Note': 'Same recipient decrypting later gets unique session nonce!'
          }
        }
      ]
    },
    {
      level: 4,
      title: 'Forensic Watermarks',
      nodes: [
        {
          id: 'WM-7A91...',
          name: 'Fingerprint WM-7A91B0',
          sub: 'HMAC-SHA3-256 Derived',
          icon: Fingerprint,
          type: 'WATERMARK',
          color: 'var(--cyan-primary)',
          details: {
            'Watermark ID': 'WM-7A91B04E8812A90',
            'Embedding Domain': 'DCT Mid-Frequency Spatial Lattice',
            'ECC Protection': 'Reed-Solomon (255, 127)',
            'Anonymity': 'Pseudonymous (No raw name in payload)'
          }
        },
        {
          id: 'WM-31BC...',
          name: 'Fingerprint WM-31BC92',
          sub: 'HMAC-SHA3-256 Derived',
          icon: Fingerprint,
          type: 'WATERMARK',
          color: 'var(--cyan-primary)',
          details: {
            'Watermark ID': 'WM-31BC9288EFA1120',
            'Embedding Domain': 'DCT Mid-Frequency Spatial Lattice',
            'ECC Protection': 'Reed-Solomon (255, 127)'
          }
        }
      ]
    },
    {
      level: 5,
      title: 'Ledger Commitments',
      nodes: [
        {
          id: 'BLK-0001',
          name: 'Block #1 (Committed)',
          sub: 'ML-DSA-65 Signed',
          icon: Database,
          type: 'LEDGER_BLOCK',
          color: 'var(--emerald-primary)',
          details: {
            'Block Index': '1',
            'Block ID': 'BLK-0001-9912A',
            'Merkle Root': 'mr_root_a892b1129f',
            'Consensus Endorsers': 'Node A (Security), Node B (Audit), Node C (Forensic)',
            'ML-DSA Attestation': 'VERIFIED DETERMINISTIC'
          }
        }
      ]
    }
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-purple">PROVENANCE CONTINUITY ENGINE</span>
          <span className="badge badge-cyan">FULL AUDIT LINEAGE GRAPH</span>
        </div>
        <h1 style={{ fontSize: '28px', color: '#ffffff', letterSpacing: '-0.02em' }}>
          Evidence Continuity & Provenance Lineage Graph
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '850px', marginTop: '4px' }}>
          Visualize the uninterrupted mathematical chain: from the root document hash, through recipient ML-KEM envelopes, 
          session nonces, invisible watermarks, ML-DSA signatures, and consensus ledger blocks.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
        {/* Graph Columns Flow */}
        <div className="glass-panel" style={{ padding: '28px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: '20px', minWidth: '850px', justifyContent: 'space-between' }}>
            {graphData.map((column, colIdx) => (
              <div key={column.title} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  marginBottom: '14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>{column.title}</span>
                  <span className="badge badge-cyan" style={{ fontSize: '8px', padding: '1px 5px' }}>L{column.level}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {column.nodes.map(node => {
                    const Icon = node.icon;
                    const isSelected = selectedNode.id === node.id;
                    return (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNode({
                          title: node.name,
                          type: node.type,
                          id: node.id,
                          details: node.details
                        })}
                        style={{
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                          border: isSelected ? `1px solid ${node.color}` : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: isSelected ? `0 0 16px ${node.color}33` : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <Icon size={14} color={node.color} />
                          <strong style={{ fontSize: '12px', color: '#ffffff' }}>{node.name}</strong>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {node.sub}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Node Inspector Drawer */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Info size={18} color="var(--cyan-primary)" />
            <h3 style={{ fontSize: '16px', color: '#ffffff' }}>Node Cryptographic Details</h3>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <span className="badge badge-cyan" style={{ fontSize: '9px' }}>{selectedNode.type}</span>
            <h4 style={{ fontSize: '16px', color: '#ffffff', marginTop: '6px' }}>{selectedNode.title}</h4>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              Node Identifier: {selectedNode.id}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            {Object.entries(selectedNode.details).map(([key, val]) => (
              <div key={key} style={{ backgroundColor: '#070a12', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  {key}
                </span>
                <span style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '11px', wordBreak: 'break-all' }}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
