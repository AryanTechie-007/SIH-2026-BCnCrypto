import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { Officer, UserAccount } from '../types';
import {
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  Cpu,
  HardDrive,
  Lock,
  Terminal,
  ShieldAlert
} from 'lucide-react';

interface AccountManagementConsoleProps {
  officers?: Officer[];
  currentUser: UserAccount | null;
  onAccountCreated?: () => void;
  onOpenAuth?: () => void;
}

export const AccountManagementConsole: React.FC<AccountManagementConsoleProps> = ({
  currentUser,
  onAccountCreated,
  onOpenAuth
}) => {
  const [profile, setProfile] = useState<UserAccount | null>(currentUser);
  const [showKeystorePasscode, setShowKeystorePasscode] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);



  // Synchronize and refresh currentUser profile from backend
  const fetchLatestProfile = async () => {
    setIsLoading(true);
    setRefreshMessage(null);
    try {
      const data = await ApiClient.getCurrentUser();
      if (data) {
        setProfile(data);
        setRefreshMessage('Profile synced with secure enclave.');
        setTimeout(() => setRefreshMessage(null), 3000);
      }
    } catch {
      // Fallback to prop profile if network check is idle
      if (currentUser) setProfile(currentUser);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setProfile(currentUser);
    }
    fetchLatestProfile();
  }, [currentUser?.id, currentUser?.username]);

  const handleCopyKeystoreSecret = (secret?: string) => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

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
            No Active Operator Session Detected
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
            Sign into your identity account to view your authenticated credentials, post-quantum keypairs, and 16-bit keystore passcode.
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
              <span>AUTHENTICATE OPERATOR SESSION</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const keystorePass = profile.keystore_password || '0x0000';
  const keystoreFile = `user_${profile.id}_${profile.username.replace(/[^a-zA-Z0-9_-]/g, '')}.keystore`;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Main Console Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              My Account &amp; Keystore Security
            </h1>
            <span style={{
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              border: '1px solid #3b82f6',
              color: '#60a5fa',
              padding: '2px 8px',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)'
            }}>
              POST-QUANTUM PROTECTED
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Authenticated operator identity, post-quantum keypairs, and local 16-bit keystore credentials.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {refreshMessage && (
            <span style={{ fontSize: '11px', color: '#10b981', fontFamily: 'var(--font-mono)' }}>
              {refreshMessage}
            </span>
          )}
          <button
            onClick={fetchLatestProfile}
            disabled={isLoading}
            className="tactical-btn tactical-btn-secondary"
            style={{ padding: '6px 14px', fontSize: '11px' }}
            title="Sync credentials with server"
          >
            <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
            <span>{isLoading ? 'Syncing...' : 'Sync Enclave'}</span>
          </button>
        </div>
      </div>

      {/* Primary Account Grid: Profile Card (Left) and Keystore Credentials Card (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '20px', alignItems: 'start' }}>

        {/* Left Column: Operator Identity Profile */}
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
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: 700, fontSize: '12px', letterSpacing: '0.04em' }}>
              <UserCheck size={16} color="#3b82f6" />
              <span>OPERATOR PROFILE</span>
            </div>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#10b981'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
              ACTIVE
            </span>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Identity Avatar / Headline */}
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
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profile.name}
                </div>
                <div style={{ fontSize: '12px', color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  @{profile.username}
                </div>
              </div>
            </div>

            {/* Profile Fields Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>OPERATOR ID</span>
                <span className="font-mono" style={{ color: '#ffffff', fontWeight: 600 }}>{profile.navy_id}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>DEVICE BOUND</span>
                <span className="font-mono" style={{ color: '#38bdf8' }}>{profile.device_id || 'DEV-STATION-01'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>CLEARANCE LEVEL</span>
                <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '11px' }}>{profile.clearance_level || 'Confidential'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>ROLE</span>
                <span style={{ color: '#e2e8f0', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{profile.role || 'USER'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>LEDGER IDENTITY</span>
                <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{profile.fabric_msp_id || 'UNKNOWN'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>CRYPTO REGISTRY</span>
                <span style={{ color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>ACTIVE (v1)</span>
              </div>

            </div>

          </div>
        </div>

        {/* Right Column: Keystore Security, 16-Bit Passcode, and Cryptographic Keys */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* 16-Bit Keystore Security Card */}
          <div style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-hard)',
            borderTop: '3px solid #2563eb',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-panel-alt)',
              borderBottom: '1px solid var(--border-hard)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: 700, fontSize: '12px', letterSpacing: '0.04em' }}>
                <Key size={16} color="#3b82f6" />
                <span>LOCAL KEYSTORE CREDENTIALS</span>
              </div>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                padding: '2px 8px',
                borderRadius: '3px'
              }}>
                ARGON2ID + AES-256-GCM
              </span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Security Context Banner */}
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
                  Your post-quantum private keys are secured inside your local encrypted keystore.
                  The <strong>16-bit keystore passcode</strong> below is separate from your ledger identity bundle.
                  Use this passcode in the <strong>Decryption Lab</strong> to unlock incoming encrypted documents.
                </div>
              </div>

              {/* 16-Bit Passcode Display Box */}
              <div style={{
                backgroundColor: 'var(--bg-core)',
                border: '1px solid var(--border-hard)',
                borderRadius: '4px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>
                    16-BIT KEYSTORE PASSCODE
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="font-mono" style={{
                      fontSize: '22px',
                      fontWeight: 800,
                      color: showKeystorePasscode ? '#38bdf8' : 'var(--text-muted)',
                      letterSpacing: showKeystorePasscode ? '0.05em' : '0.2em'
                    }}>
                      {showKeystorePasscode ? keystorePass : '••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowKeystorePasscode(!showKeystorePasscode)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={showKeystorePasscode ? 'Mask passcode' : 'Reveal passcode'}
                    >
                      {showKeystorePasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyKeystoreSecret(keystorePass)}
                    className="tactical-btn"
                    style={{
                      padding: '8px 16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: isCopied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(37, 99, 235, 0.15)',
                      borderColor: isCopied ? '#10b981' : '#2563eb',
                      color: isCopied ? '#34d399' : '#60a5fa'
                    }}
                  >
                    {isCopied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{isCopied ? 'COPIED TO CLIPBOARD' : 'COPY PASSCODE'}</span>
                  </button>
                </div>
              </div>

              {/* Keystore File Metadata */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                fontSize: '11px',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                padding: '12px 14px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)'
              }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <HardDrive size={11} />
                    <span>KEYSTORE CONTAINER FILE</span>
                  </div>
                  <div className="font-mono" style={{ color: '#ffffff', fontSize: '11px', wordBreak: 'break-all' }}>
                    {keystoreFile}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Cpu size={11} />
                    <span>ENTROPY DERIVATION</span>
                  </div>
                  <div style={{ color: '#93c5fd', fontSize: '11px' }}>
                    16-Bit Key Passcode (0x0000 - 0xFFFF)
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Cryptographic Keypairs Preview Card */}
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
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: 700, fontSize: '12px', letterSpacing: '0.04em' }}>
                <Terminal size={16} color="#38bdf8" />
                <span>POST-QUANTUM PUBLIC KEY REGISTRY</span>
              </div>
              <span style={{ fontSize: '10px', color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                NIST FIPS 203 &amp; 204
              </span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* ML-KEM-768 */}
              <div style={{
                backgroundColor: 'var(--bg-core)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '3px',
                padding: '12px 14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
                    ML-KEM-768 Decapsulation Public Key
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    FIPS 203 (1184 Bytes)
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all' }}>
                  {profile.ml_kem_pub_preview || '0x0000... (1184 B)'}
                </div>
              </div>

              {/* ML-DSA-65 */}
              <div style={{
                backgroundColor: 'var(--bg-core)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '3px',
                padding: '12px 14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa' }}>
                    ML-DSA-65 Digital Signature Public Key
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    FIPS 204 (1952 Bytes)
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all' }}>
                  {profile.ml_dsa_pub_preview || '0x0000... (1952 B)'}
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
