import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  ShieldCheck,
  Copy,
  Check,
  Edit3,
  Lock,
  Layers,
  HelpCircle,
  FileDown
} from 'lucide-react';
import { ApiClient } from '../api/client';
import {
  TransformJobView,
  FormatResult,
  FormatInfo,
  GroundingPassage,
  SourceBlock,
  JobSettings
} from '../types';

interface ContentTransformConsoleProps {
  onSendToEncryptionLab?: (title: string, content: string) => void;
}

const SAMPLE_INCIDENT_TEXT = `INCIDENT REPORT: CRITICAL ZERO-DAY EXPLOITATION IN CRYPTO-ROUTER FIRMWARE
Classification: TOP SECRET // ORCON
Date: 2026-09-28
Affected Systems: EdgeRouter Core v4.19 through v5.2

SUMMARY:
A memory-corruption vulnerability (CVE-2026-8812) in the cryptographic session handshake allows unauthenticated remote attackers to execute arbitrary shellcode with root privileges. Active in-the-wild exploitation was detected by the Cyber Defense Operations Center targeting key distribution relays.

KEY TECHNICAL DETAILS:
- Vulnerability Type: Heap buffer overflow in ASN.1 parsing routine of quantum-resistant key encapsulation tunnel.
- Attack Vector: Remote network via port 8443 without pre-authentication.
- Impact: Full host compromise, extraction of localized ephemeral keys, and telemetry eavesdropping.
- Indicator of Compromise (IoC): Inbound payloads containing magic byte sequence 0x7F4B454D from ASN 45102 IPs (198.51.100.24, 203.0.113.88).

RECOMMENDED REMEDIATION & MITIGATION:
1. Immediate isolation: Segment all management interfaces from public routing tables.
2. Temporary workaround: Disable legacy fallback cipher suites and enforce ML-KEM-1024 hybrid encapsulation exclusively.
3. Patch deployment: Apply security hotfix v5.2.1-sec immediately across all perimeter nodes.
4. Revocation: Cycle all node identity certificates issued prior to 2026-09-28T00:00:00Z.`;

export const ContentTransformConsole: React.FC<ContentTransformConsoleProps> = ({
  onSendToEncryptionLab
}) => {
  // Config state
  const [inputMode, setInputMode] = useState<'text' | 'url'>('text');
  const [sourceText, setSourceText] = useState<string>(SAMPLE_INCIDENT_TEXT);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [selectedFormats, setSelectedFormats] = useState<string[]>([
    'advisory',
    'exec_summary',
    'deck',
    'x_thread',
    'linkedin'
  ]);
  const [audience, setAudience] = useState<JobSettings['audience']>('technical');
  const [tone, setTone] = useState<JobSettings['tone']>('urgent');
  const [detailLevel, setDetailLevel] = useState<JobSettings['detail_level']>('detailed');
  const [objective, setObjective] = useState<JobSettings['objective']>('warn');

  // Metadata from backend
  const [availableFormats, setAvailableFormats] = useState<FormatInfo[]>([]);

  // Execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJob, setCurrentJob] = useState<TransformJobView | null>(null);
  const [selectedOutputIndex, setSelectedOutputIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'artifact' | 'grounding' | 'blocks'>('artifact');
  const [copied, setCopied] = useState(false);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editedPassageText, setEditedPassageText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load formats on mount
  useEffect(() => {
    async function loadMeta() {
      try {
        const fmts = await ApiClient.getTransformFormats();
        if (fmts && fmts.length > 0) {
          setAvailableFormats(fmts);
        }
      } catch (err) {
        console.warn('Failed to load transform metadata, using defaults:', err);
      }
    }
    loadMeta();
  }, []);

  const toggleFormat = (fmtId: string) => {
    setSelectedFormats(prev =>
      prev.includes(fmtId) ? prev.filter(f => f !== fmtId) : [...prev, fmtId]
    );
  };

  const handleStartTransform = async () => {
    if (selectedFormats.length === 0) {
      setErrorMessage('Please select at least one output artifact format.');
      return;
    }
    if (inputMode === 'text' && !sourceText.trim()) {
      setErrorMessage('Please provide source document text.');
      return;
    }
    if (inputMode === 'url' && !sourceUrl.trim()) {
      setErrorMessage('Please enter a target URL to ingest.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const settings: JobSettings = {
        audience,
        tone,
        detail_level: detailLevel,
        objective
      };

      let job: TransformJobView;
      if (inputMode === 'url') {
        job = await ApiClient.createTransformJobFromUrl(sourceUrl, selectedFormats, settings);
      } else {
        job = await ApiClient.createTransformJob(sourceText, selectedFormats, settings);
      }

      setCurrentJob(job);
      setSelectedOutputIndex(0);

      // Start watching status updates via SSE
      ApiClient.watchTransformJob(
        job.id,
        (updated: TransformJobView) => {
          setCurrentJob(updated);
          if (updated.status === 'done' || updated.status === 'failed') {
            setIsSubmitting(false);
          }
        },
        () => {
          // SSE fallback: fetch once
          ApiClient.getTransformJob(job.id).then(j => {
            setCurrentJob(j);
            if (j.status === 'done' || j.status === 'failed') {
              setIsSubmitting(false);
            }
          }).catch(() => {});
        }
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Transform job initiation failed');
      setIsSubmitting(false);
    }
  };

  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentOutput: FormatResult | null =
    currentJob?.outputs && currentJob.outputs[selectedOutputIndex]
      ? currentJob.outputs[selectedOutputIndex]
      : null;

  const currentMainArtifact = currentOutput?.artifacts?.[0] ?? null;

  const handleSavePassageEdit = async (path: string) => {
    if (!currentJob || !currentOutput) return;
    const formatKey = currentOutput.name || currentOutput.format || '';
    try {
      const updatedOutput = await ApiClient.editPassage(
        currentJob.id,
        formatKey,
        path,
        editedPassageText
      );
      // Update in currentJob state
      setCurrentJob(prev => {
        if (!prev) return null;
        return {
          ...prev,
          outputs: prev.outputs.map(o => ((o.name || o.format) === (updatedOutput.name || updatedOutput.format) ? updatedOutput : o))
        };
      });
      setEditingPath(null);
    } catch (err: any) {
      setErrorMessage('Failed to save passage edit: ' + err.message);
    }
  };

  const handleAcceptPassage = async (path: string) => {
    if (!currentJob || !currentOutput) return;
    const formatKey = currentOutput.name || currentOutput.format || '';
    try {
      const updatedOutput = await ApiClient.acceptPassage(
        currentJob.id,
        formatKey,
        path,
        true
      );
      setCurrentJob(prev => {
        if (!prev) return null;
        return {
          ...prev,
          outputs: prev.outputs.map(o => ((o.name || o.format) === (updatedOutput.name || updatedOutput.format) ? updatedOutput : o))
        };
      });
    } catch (err: any) {
      setErrorMessage('Failed to accept passage: ' + err.message);
    }
  };

  const handleSendToEncryption = () => {
    if (!currentOutput || !currentMainArtifact) return;
    const formatKey = currentOutput.name || currentOutput.format || '';
    const title = `${formatKey.toUpperCase()} - ${currentJob?.id.slice(0, 8)}`;
    const content = currentMainArtifact.text || currentMainArtifact.parts.join('\n\n');
    if (onSendToEncryptionLab) {
      onSendToEncryptionLab(title, content);
    } else {
      handleCopyText(content);
      alert('Content copied to clipboard! Navigate to Encryption Lab to encrypt with ML-KEM.');
    }
  };

  const defaultFormatList = [
    { name: 'advisory', label: 'Security Advisory (PDF+MD)' },
    { name: 'exec_summary', label: 'Executive Summary (PDF+MD)' },
    { name: 'deck', label: 'Presentation Deck (PPTX)' },
    { name: 'x_thread', label: 'X / Twitter Thread' },
    { name: 'linkedin', label: 'LinkedIn Post' }
  ];

  const displayFormats = availableFormats.length > 0 ? availableFormats : defaultFormatList;

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-main)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--border-hard)',
        marginBottom: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: '#00ff66',
              color: '#000',
              padding: '4px 8px',
              borderRadius: '2px',
              fontSize: '11px',
              fontWeight: 900
            }}>
              TRANSFORM-AI
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.02em' }}>
              Multi-Artifact Content Intelligence
            </h1>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            One-to-many communication synthesis with strict provenance citations, source block grounding, and NIST PQC export.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setSourceText(SAMPLE_INCIDENT_TEXT)}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-hard)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: '2px'
            }}
          >
            Load Sample Incident
          </button>
        </div>
      </div>

      {errorMessage && (
        <div style={{
          backgroundColor: 'rgba(255, 77, 77, 0.1)',
          border: '1px solid #ff4d4d',
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '2px',
          color: '#ff4d4d',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Input Setup & Results */}
      <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '24px' }}>
        {/* Left Column: Source & Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Source Input Card */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-hard)',
            borderRadius: '4px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: '#00ff66' }}>
                1. SOURCE INGESTION
              </div>
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-core)', padding: '2px', borderRadius: '3px' }}>
                <button
                  onClick={() => setInputMode('text')}
                  style={{
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '2px',
                    backgroundColor: inputMode === 'text' ? 'rgba(0, 255, 102, 0.2)' : 'transparent',
                    color: inputMode === 'text' ? '#00ff66' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Raw Text
                </button>
                <button
                  onClick={() => setInputMode('url')}
                  style={{
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '2px',
                    backgroundColor: inputMode === 'url' ? 'rgba(0, 255, 102, 0.2)' : 'transparent',
                    color: inputMode === 'url' ? '#00ff66' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  URL Extract
                </button>
              </div>
            </div>

            {/* Ingestion Content */}
            {inputMode === 'text' ? (
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  SOURCE CONTENT (BLOCK-INDEXED)
                </label>
                <textarea
                  rows={11}
                  value={sourceText}
                  onChange={e => setSourceText(e.target.value)}
                  placeholder="Paste security telemetry, CVE report, incident dispatch..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: 'var(--bg-core)',
                    border: '1px solid var(--border-hard)',
                    color: 'var(--text-main)',
                    borderRadius: '2px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono, monospace)',
                    lineHeight: '1.4',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  LIVE TARGET URL (TRAFILATURA INGESTION)
                </label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  placeholder="https://cve.mitre.org/data/refs/ref..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: 'var(--bg-core)',
                    border: '1px solid var(--border-hard)',
                    color: 'var(--text-main)',
                    borderRadius: '2px',
                    fontSize: '12px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>

          {/* Formats Selector Card */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-hard)',
            borderRadius: '4px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: '#00ff66', marginBottom: '12px' }}>
              2. TARGET ARTIFACTS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayFormats.map(fmt => {
                const isSelected = selectedFormats.includes(fmt.name);
                return (
                  <div
                    key={fmt.name}
                    onClick={() => toggleFormat(fmt.name)}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: isSelected ? 'rgba(0, 255, 102, 0.08)' : 'var(--bg-core)',
                      border: isSelected ? '1px solid #00ff66' : '1px solid var(--border-hard)',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ cursor: 'pointer', accentColor: '#00ff66' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#00ff66' : 'var(--text-main)' }}>
                        {fmt.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Persona & Brand Settings Card */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-hard)',
            borderRadius: '4px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: '#00ff66', marginBottom: '12px' }}>
              3. AUDIENCE & TONE SYNTHESIS
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  TARGET AUDIENCE
                </label>
                <select
                  value={audience}
                  onChange={e => setAudience(e.target.value as JobSettings['audience'])}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: 'var(--bg-core)',
                    border: '1px solid var(--border-hard)',
                    color: 'var(--text-main)',
                    borderRadius: '2px',
                    fontSize: '11px'
                  }}
                >
                  <option value="executive">C-Suite / Executives</option>
                  <option value="technical">Technical Ops</option>
                  <option value="general_public">General Public</option>
                  <option value="media">Media & Press</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  TONE OF VOICE
                </label>
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value as JobSettings['tone'])}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: 'var(--bg-core)',
                    border: '1px solid var(--border-hard)',
                    color: 'var(--text-main)',
                    borderRadius: '2px',
                    fontSize: '11px'
                  }}
                >
                  <option value="urgent">Urgent / Critical</option>
                  <option value="formal">Formal</option>
                  <option value="neutral">Neutral</option>
                  <option value="conversational">Conversational</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  DETAIL LEVEL
                </label>
                <select
                  value={detailLevel}
                  onChange={e => setDetailLevel(e.target.value as JobSettings['detail_level'])}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: 'var(--bg-core)',
                    border: '1px solid var(--border-hard)',
                    color: 'var(--text-main)',
                    borderRadius: '2px',
                    fontSize: '11px'
                  }}
                >
                  <option value="detailed">Detailed</option>
                  <option value="standard">Standard</option>
                  <option value="brief">Brief</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  COMMUNICATION OBJECTIVE
                </label>
                <select
                  value={objective}
                  onChange={e => setObjective(e.target.value as JobSettings['objective'])}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: 'var(--bg-core)',
                    border: '1px solid var(--border-hard)',
                    color: 'var(--text-main)',
                    borderRadius: '2px',
                    fontSize: '11px'
                  }}
                >
                  <option value="warn">Warn / Alert</option>
                  <option value="inform">Inform</option>
                  <option value="persuade">Persuade</option>
                  <option value="instruct">Instruct</option>
                  <option value="announce">Announce</option>
                </select>
              </div>
            </div>
          </div>

          {/* Trigger Button */}
          <button
            onClick={handleStartTransform}
            disabled={isSubmitting}
            style={{
              padding: '14px',
              backgroundColor: isSubmitting ? 'rgba(0, 255, 102, 0.4)' : '#00ff66',
              color: '#000',
              fontWeight: 800,
              fontSize: '13px',
              letterSpacing: '0.05em',
              border: 'none',
              borderRadius: '3px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 0 15px rgba(0, 255, 102, 0.3)'
            }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>TRANSFORMING CONTENT...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>GENERATE MULTI-FORMAT ARTIFACTS</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Execution Lifecycle & Generated Artifacts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Pipeline Tracker Card */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-hard)',
            borderRadius: '4px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: '#00ff66' }}>
                  PIPELINE WORKFLOW
                </span>
                {currentJob && (
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    padding: '2px 6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '2px',
                    color: 'var(--text-muted)'
                  }}>
                    JOB-{currentJob.id.slice(0, 8)}
                  </span>
                )}
              </div>

              {currentJob && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: currentJob.status === 'done' ? '#00ff66' : currentJob.status === 'failed' ? '#ff4d4d' : '#eab308'
                  }}>
                    {currentJob.status}
                  </span>
                </div>
              )}
            </div>

            {/* Pipeline Stage Indicators */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { name: 'ingest', label: '1. Ingestion', desc: 'Block parsing & indexing' },
                { name: 'understand', label: '2. Understand', desc: 'ContentBrief & claims' },
                { name: 'format', label: '3. Formats', desc: 'Schema generation' },
                { name: 'verify', label: '4. Grounding', desc: 'Citation verification' }
              ].map(stage => {
                const matchingStep = currentJob?.steps?.find(s => s.name === stage.name);
                const isDone = matchingStep?.status === 'done' || currentJob?.status === 'done';
                const isRunning = matchingStep?.status === 'running';

                return (
                  <div
                    key={stage.name}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: isRunning ? 'rgba(0, 255, 102, 0.12)' : isDone ? 'rgba(0, 255, 102, 0.05)' : 'var(--bg-core)',
                      border: isRunning ? '1px solid #00ff66' : isDone ? '1px solid rgba(0, 255, 102, 0.4)' : '1px solid var(--border-hard)',
                      borderRadius: '3px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      {isDone ? (
                        <CheckCircle2 size={12} color="#00ff66" />
                      ) : isRunning ? (
                        <RefreshCw size={12} color="#00ff66" className="animate-spin" />
                      ) : (
                        <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid var(--border-hard)' }} />
                      )}
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isRunning || isDone ? '#00ff66' : 'var(--text-muted)' }}>
                        {stage.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                      {stage.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Results Viewer */}
          {currentJob?.outputs && currentJob.outputs.length > 0 ? (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-hard)',
              borderRadius: '4px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              flex: 1
            }}>
              {/* Artifact Selector Tabs */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-hard)',
                paddingBottom: '10px',
                marginBottom: '14px',
                gap: '8px',
                overflowX: 'auto'
              }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {currentJob.outputs.map((out: FormatResult, idx: number) => {
                    const isSelected = idx === selectedOutputIndex;
                    const formatKey = out.name || out.format || '';
                    const formatTitle = out.label || formatKey.replace('_', ' ');
                    return (
                      <button
                        key={formatKey}
                        onClick={() => setSelectedOutputIndex(idx)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isSelected ? 'rgba(0, 255, 102, 0.15)' : 'transparent',
                          color: isSelected ? '#00ff66' : 'var(--text-muted)',
                          border: isSelected ? '1px solid #00ff66' : '1px solid var(--border-hard)',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          textTransform: 'uppercase'
                        }}
                      >
                        {formatTitle}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-tabs: Artifact view vs Grounding report vs Ingested blocks */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setActiveTab('artifact')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: activeTab === 'artifact' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: activeTab === 'artifact' ? '#fff' : 'var(--text-dim)',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Output Content
                  </button>
                  <button
                    onClick={() => setActiveTab('grounding')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: activeTab === 'grounding' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: activeTab === 'grounding' ? '#fff' : 'var(--text-dim)',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Grounding Proofs
                  </button>
                  <button
                    onClick={() => setActiveTab('blocks')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: activeTab === 'blocks' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: activeTab === 'blocks' ? '#fff' : 'var(--text-dim)',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Source Blocks ({currentJob.source?.blocks?.length || 0})
                  </button>
                </div>
              </div>

              {/* Sub-tab 1: Artifact Output & Actions */}
              {activeTab === 'artifact' && currentOutput && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {/* Action Toolbar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-core)',
                    borderRadius: '2px',
                    border: '1px solid var(--border-hard)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#00ff66' }}>
                        FORMAT: {(currentOutput.name || currentOutput.format || '').toUpperCase()}
                      </span>
                      {currentMainArtifact && (
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                          {currentMainArtifact.filename} ({currentMainArtifact.media_type})
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Send to Quantum Encryption Lab */}
                      <button
                        onClick={handleSendToEncryption}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(0, 255, 102, 0.15)',
                          border: '1px solid #00ff66',
                          color: '#00ff66',
                          borderRadius: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        <Lock size={12} />
                        <span>ENCRYPT WITH ML-KEM</span>
                      </button>

                      {/* Download Artifact Files */}
                      {currentOutput.artifacts?.map(art => (
                        <a
                          key={art.filename}
                          href={ApiClient.getArtifactDownloadUrl(currentJob.id, currentOutput.name || currentOutput.format || '', art.filename)}
                          download
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-hard)',
                            color: 'var(--text-main)',
                            borderRadius: '2px',
                            textDecoration: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Download size={12} />
                          <span>{art.filename.split('.').pop()?.toUpperCase()}</span>
                        </a>
                      ))}

                      {/* Copy to Clipboard */}
                      {currentMainArtifact && (
                        <button
                          onClick={() => handleCopyText(currentMainArtifact.text || currentMainArtifact.parts.join('\n\n'))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-hard)',
                            color: 'var(--text-main)',
                            borderRadius: '2px',
                            cursor: 'pointer'
                          }}
                        >
                          {copied ? <Check size={12} color="#00ff66" /> : <Copy size={12} />}
                          <span>{copied ? 'COPIED' : 'COPY'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Passages with Grounding & Inline Editing */}
                  {currentOutput.grounding?.passages && currentOutput.grounding.passages.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                      {currentOutput.grounding.passages.map((p: GroundingPassage) => {
                        const isEditing = editingPath === p.path;
                        const isSupported = p.verdict === 'supported';
                        return (
                          <div
                            key={p.path}
                            style={{
                              padding: '12px',
                              backgroundColor: isSupported ? 'var(--bg-core)' : 'rgba(255, 77, 77, 0.05)',
                              border: isSupported ? '1px solid var(--border-hard)' : '1px solid rgba(255, 77, 77, 0.3)',
                              borderRadius: '3px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                                  {p.path}
                                </span>
                                {isSupported ? (
                                  <span style={{ fontSize: '10px', color: '#00ff66', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ShieldCheck size={11} /> Grounded
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '10px', color: '#ff4d4d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={11} /> Review Citation ({p.verdict || 'unverified'})
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                {isEditing ? (
                                  <button
                                    onClick={() => handleSavePassageEdit(p.path)}
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '10px',
                                      backgroundColor: '#00ff66',
                                      color: '#000',
                                      fontWeight: 700,
                                      border: 'none',
                                      borderRadius: '2px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Save
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingPath(p.path);
                                      setEditedPassageText(p.text);
                                    }}
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '10px',
                                      backgroundColor: 'transparent',
                                      color: 'var(--text-muted)',
                                      border: '1px solid var(--border-hard)',
                                      borderRadius: '2px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                  >
                                    <Edit3 size={10} /> Edit
                                  </button>
                                )}

                                {!isSupported && (
                                  <button
                                    onClick={() => handleAcceptPassage(p.path)}
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '10px',
                                      backgroundColor: 'rgba(0, 255, 102, 0.1)',
                                      color: '#00ff66',
                                      border: '1px solid #00ff66',
                                      borderRadius: '2px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Accept
                                  </button>
                                )}
                              </div>
                            </div>

                            {isEditing ? (
                              <textarea
                                rows={3}
                                value={editedPassageText}
                                onChange={e => setEditedPassageText(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  backgroundColor: 'var(--bg-card)',
                                  border: '1px solid #00ff66',
                                  color: 'var(--text-main)',
                                  borderRadius: '2px',
                                  fontSize: '12px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            ) : (
                              <div style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-main)' }}>
                                {p.text}
                              </div>
                            )}

                            {p.blocks && p.blocks.length > 0 && (
                              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>PROVENANCE BLOCKS:</span>
                                {p.blocks.map((bId: string) => (
                                  <span
                                    key={bId}
                                    style={{
                                      fontSize: '10px',
                                      fontFamily: 'monospace',
                                      backgroundColor: 'rgba(0, 255, 102, 0.1)',
                                      color: '#00ff66',
                                      padding: '1px 5px',
                                      borderRadius: '2px',
                                      border: '1px solid rgba(0, 255, 102, 0.3)'
                                    }}
                                  >
                                    {bId}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Raw Content Box */
                    <pre style={{
                      margin: 0,
                      padding: '14px',
                      backgroundColor: 'var(--bg-core)',
                      border: '1px solid var(--border-hard)',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono, monospace)',
                      lineHeight: '1.5',
                      color: 'var(--text-main)',
                      whiteSpace: 'pre-wrap',
                      overflowY: 'auto',
                      maxHeight: '520px'
                    }}>
                      {currentMainArtifact?.text || currentMainArtifact?.parts.join('\n\n') || 'Artifact generated.'}
                    </pre>
                  )}
                </div>
              )}

              {/* Sub-tab 2: Grounding Proofs */}
              {activeTab === 'grounding' && currentOutput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto' }}>
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-core)',
                    border: '1px solid var(--border-hard)',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>GROUNDING REPORT</div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: currentOutput.grounding?.passages.every(p => p.verdict === 'supported') ? '#00ff66' : '#ff4d4d',
                        marginTop: '2px'
                      }}>
                        {currentOutput.grounding?.passages.every(p => p.verdict === 'supported')
                          ? '100% PROVEN GROUNDED'
                          : 'CITATION VERIFICATION REQUIRED'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>PASSAGES INSPECTED</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                        {currentOutput.grounding?.passages?.length || 0} Passages
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentOutput.grounding?.passages?.map((p: GroundingPassage, i: number) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: p.verdict === 'supported' ? 'var(--bg-core)' : 'rgba(255, 77, 77, 0.08)',
                          border: p.verdict === 'supported' ? '1px solid var(--border-hard)' : '1px solid #ff4d4d',
                          borderRadius: '2px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: p.verdict === 'supported' ? '#00ff66' : '#ff4d4d' }}>
                            {p.path} ({p.verdict?.toUpperCase() || 'UNKNOWN'})
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                            Blocks: {(p.blocks || []).join(', ') || 'None'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {p.text}
                        </div>
                        {p.reasons && p.reasons.length > 0 && (
                          <div style={{ fontSize: '10px', color: '#ff4d4d', marginTop: '4px' }}>
                            Reasons: {p.reasons.join('; ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Ingested Source Blocks */}
              {activeTab === 'blocks' && currentJob.source?.blocks && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                  {currentJob.source.blocks.map((b: SourceBlock) => (
                    <div
                      key={b.id}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-core)',
                        border: '1px solid var(--border-hard)',
                        borderRadius: '2px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          color: '#00ff66',
                          backgroundColor: 'rgba(0, 255, 102, 0.1)',
                          padding: '1px 6px',
                          borderRadius: '2px'
                        }}>
                          [{b.id}]
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                          Type: {b.type} | Words: {b.text.split(/\s+/).length}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {b.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div style={{
              flex: 1,
              backgroundColor: 'var(--bg-card)',
              border: '1px dashed var(--border-hard)',
              borderRadius: '4px',
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}>
              <Sparkles size={36} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                No Active Artifact Transformation
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', maxWidth: '380px', margin: 0 }}>
                Configure source intelligence on the left and select your desired artifacts (Security Advisory, Executive Summary, Presentation Deck, or Social Dispatches) to synthesize.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
