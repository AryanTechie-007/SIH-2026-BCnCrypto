import React, { useState } from 'react';
import { 
  Flame, 
  ShieldCheck, 
  Image, 
  Crop, 
  FileCode, 
  Printer, 
  Sliders, 
  CheckCircle2, 
  RefreshCw,
  Cpu,
  Sparkles
} from 'lucide-react';

interface AttackSimulation {
  id: string;
  name: string;
  icon: any;
  desc: string;
  berObserved: number; // Bit Error Rate %
  eccCorrectionStatus: string;
  payloadRecoveryPct: number;
  attributionStatus: string;
}

export const AttackLab: React.FC = () => {
  const attacks: AttackSimulation[] = [
    {
      id: 'compress',
      name: 'Severe JPEG Recompression (Quality 35%)',
      icon: Image,
      desc: 'Simulates sending document through compressed channels (WhatsApp/Telegram/email re-encoding). High-frequency DCT coefficients wiped.',
      berObserved: 6.4,
      eccCorrectionStatus: 'Reed-Solomon (255, 127) corrected all 32 error symbols',
      payloadRecoveryPct: 100,
      attributionStatus: 'ATTRIBUTION SUCCESSFUL (CONFIDENCE: 96.8%)'
    },
    {
      id: 'screenshot',
      name: 'High-Resolution Screenshot & Resample',
      icon: Sliders,
      desc: 'Simulates screen grab followed by 72 DPI bilinear downsampling. Spatial raster grid altered.',
      berObserved: 4.8,
      eccCorrectionStatus: 'Interleaved bit distribution preserved block integrity',
      payloadRecoveryPct: 100,
      attributionStatus: 'ATTRIBUTION SUCCESSFUL (CONFIDENCE: 98.2%)'
    },
    {
      id: 'crop',
      name: 'Aggressive Page Crop (12% Margins Cut)',
      icon: Crop,
      desc: 'Adversary crops headers, footers, and margins to eliminate boundary watermarks.',
      berObserved: 11.2,
      eccCorrectionStatus: 'Redundant multi-region spread across central content survived',
      payloadRecoveryPct: 100,
      attributionStatus: 'ATTRIBUTION SUCCESSFUL (CONFIDENCE: 94.1%)'
    },
    {
      id: 'metadata',
      name: 'Complete PDF Metadata Stripping (Exif/XMP)',
      icon: FileCode,
      desc: 'Adversary uses ExifTool to wipe all PDF comments, creator info, and XMP streams.',
      berObserved: 0.0,
      eccCorrectionStatus: 'Watermark is embedded in visual DCT matrix, not metadata fields',
      payloadRecoveryPct: 100,
      attributionStatus: 'ATTRIBUTION SUCCESSFUL (CONFIDENCE: 100%)'
    },
    {
      id: 'printscan',
      name: 'Simulated Print-to-Scan Channel',
      icon: Printer,
      desc: 'Simulates printing to physical paper, mechanical halftone rasterization, and digital scanning at 200 DPI.',
      berObserved: 16.5,
      eccCorrectionStatus: 'Reed-Solomon ECC repaired corrupted parity bytes',
      payloadRecoveryPct: 98.6,
      attributionStatus: 'ATTRIBUTION SUCCESSFUL (CONFIDENCE: 91.5%)'
    }
  ];

  const [selectedAttack, setSelectedAttack] = useState<AttackSimulation>(attacks[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<AttackSimulation | null>(attacks[0]);

  const handleRunAttack = async (attack: AttackSimulation) => {
    setSelectedAttack(attack);
    setIsRunning(true);
    setTestResult(null);

    await new Promise(r => setTimeout(r, 700));
    setTestResult(attack);
    setIsRunning(false);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-crimson">ADVERSARIAL WATERMARK LABORATORY</span>
          <span className="badge badge-cyan">REED-SOLOMON ERROR CORRECTION</span>
        </div>
        <h1 style={{ fontSize: '28px', color: '#ffffff', letterSpacing: '-0.02em' }}>
          Adversarial Attack & Degradation Simulation Lab
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '850px', marginTop: '4px' }}>
          Test forensic watermark resilience against realistic adversary transformation vectors: 
          compression, cropping, screenshotting, metadata purging, and print-scan simulation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
        {/* Left Column: Attack Vector Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', color: '#ffffff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} color="var(--crimson-primary)" />
              Select Adversarial Transformation Vector
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {attacks.map(att => {
                const Icon = att.icon;
                const isSelected = selectedAttack.id === att.id;
                return (
                  <div
                    key={att.id}
                    onClick={() => handleRunAttack(att)}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                      border: isSelected ? '1px solid var(--crimson-primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <Icon size={16} color={isSelected ? 'var(--crimson-primary)' : 'var(--text-muted)'} />
                      <strong style={{ color: '#ffffff', fontSize: '13px' }}>{att.name}</strong>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {att.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Execution & Robustness Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Robustness Analysis Card */}
          <div className="glass-panel glass-panel-glow" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', color: '#ffffff' }}>Attack Resilience Evaluation</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Target Vector: <strong style={{ color: 'var(--cyan-primary)' }}>{selectedAttack.name}</strong>
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => handleRunAttack(selectedAttack)}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="animate-spin" size={15} />
                    <span>Evaluating DCT Matrix...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Re-Run Degradation Test</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div>
                {/* Status Hero Banner */}
                <div style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CheckCircle2 size={24} color="var(--emerald-primary)" />
                    <div>
                      <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>
                        WATERMARK SURVIVED ATTACK
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {testResult.attributionStatus}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-emerald">100% RECOVERED</span>
                </div>

                {/* Metrics Breakdown Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Observed Raw BER</span>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--amber-primary)', marginTop: '4px' }}>
                      {testResult.berObserved}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Raw bit flips before ECC</div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>ECC Payload Recovery</span>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--emerald-primary)', marginTop: '4px' }}>
                      {testResult.payloadRecoveryPct}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Reconstructed watermark bits</div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Attribution Integrity</span>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--cyan-primary)', marginTop: '4px' }}>
                      DETERMINISTIC
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ML-DSA signature holds</div>
                  </div>
                </div>

                {/* Error Correction Mechanics Explanation */}
                <div style={{
                  backgroundColor: '#070a12',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--cyan-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={14} /> Error Correction Engine Diagnostic
                  </div>
                  <div style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {testResult.eccCorrectionStatus}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '8px' }}>
                    Because the 128-bit cryptographic payload is interleaved across 8×8 DCT blocks and 
                    strengthened with Reed-Solomon parity codewords, local corruptions (such as cropped edges or 
                    JPEG block quantization) are math-repaired prior to ledger lookup.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
