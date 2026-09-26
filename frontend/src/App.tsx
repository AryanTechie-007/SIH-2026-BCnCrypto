import React, { useState, useEffect } from 'react';
import { WorkstationSidebar, WorkstationModule } from './components/WorkstationSidebar';
import { WorkstationHeader } from './components/WorkstationHeader';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewConsole } from './views/OverviewConsole';
import { DocumentsConsole } from './views/DocumentsConsole';
import { DecryptionConsole } from './views/DecryptionConsole';
import { EvidenceConsole } from './views/EvidenceConsole';
import { ApiClient } from './api/client';
import { DocumentRecord, Officer, LedgerBlock, SystemHealth, UserAccount } from './types';

import { LoginPage } from './components/LoginPage';

const STORAGE_KEY_USER = 'ciphertrace_operator_user';
const STORAGE_KEY_TOKEN = 'ciphertrace_operator_token';

export function App() {
  const [activeModule, setActiveModule] = useState<WorkstationModule>('overview');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Global operational records
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);

  // Load persistent user session
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch {
      // Ignore local storage error
    }
  }, []);

  const refreshAllData = async () => {
    try {
      const [h, d, o, b] = await Promise.allSettled([
        ApiClient.getHealth(),
        ApiClient.getDocuments(),
        ApiClient.getOfficers(),
        ApiClient.getLedgerBlocks()
      ]);

      if (h.status === 'fulfilled') {
        setSystemHealth(h.value);
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }

      if (d.status === 'fulfilled') setDocuments(d.value);
      if (o.status === 'fulfilled') setOfficers(o.value);
      if (b.status === 'fulfilled') setBlocks(b.value);
    } catch {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    refreshAllData();
    const interval = setInterval(refreshAllData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = (user: UserAccount, token: string) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } catch {
      // Ignore local storage error
    }
    setActiveModule('overview');
    refreshAllData();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    } catch {
      // Ignore local storage error
    }
  };

  const moduleTitles: Record<WorkstationModule, string> = {
    overview: 'Operational Dashboard / System Overview',
    documents: 'Encryption Lab / Confidential Ingest & Post-Quantum Encryption',
    decryption: 'Decryption Lab / Post-Quantum Decryption & Steganographic Watermark',
    evidence: 'Forensic Leak Lab / Blind Extraction & Leak Attribution'
  };

  // If user is not yet logged in, present the clean authentication portal first
  if (!currentUser) {
    return (
      <ErrorBoundary>
        <LoginPage onLoginSuccess={handleLoginSuccess} enrolledUsers={officers} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-core)'
      }}>
        {/* Fixed Left Workstation Sidebar */}
        <WorkstationSidebar
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          currentUser={currentUser}
          blocksCount={blocks.length}
          isOnline={isOnline}
        />

        {/* Main Viewport */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden'
        }}>
          {/* Top Workstation Header (Matching Images 1, 2, 4) */}
          <WorkstationHeader
            activeModuleTitle={moduleTitles[activeModule]}
            currentUser={currentUser}
            systemHealth={systemHealth}
            onOpenAuth={() => setIsAuthOpen(true)}
            onLogout={handleLogout}
            onRefreshHealth={refreshAllData}
          />

          {/* Content Viewport with Smooth Scroll */}
          <main style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            backgroundColor: 'var(--bg-core)'
          }}>
            {activeModule === 'overview' && (
              <OverviewConsole
                documents={documents}
                officers={officers}
                blocks={blocks}
                currentUser={currentUser}
                onNavigate={setActiveModule}
                onOpenAuth={() => setIsAuthOpen(true)}
              />
            )}

            {activeModule === 'documents' && (
              <DocumentsConsole
                documents={documents}
                officers={officers}
                onDocumentUploaded={refreshAllData}
                onOpenAuth={() => setIsAuthOpen(true)}
              />
            )}

            {activeModule === 'decryption' && (
              <DecryptionConsole
                documents={documents}
                officers={officers}
                currentUser={currentUser}
                onDecryptionSuccess={refreshAllData}
                onOpenAuth={() => setIsAuthOpen(true)}
              />
            )}

            {activeModule === 'evidence' && (
              <EvidenceConsole />
            )}
          </main>
        </div>

        {/* Operator Authentication & Registration Modal */}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          currentUser={currentUser}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    </ErrorBoundary>
  );
}
export default App;
