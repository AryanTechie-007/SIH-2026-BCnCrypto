import React, { useState, useEffect } from 'react';
import { WorkstationSidebar, WorkstationModule } from './components/WorkstationSidebar';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewConsole } from './views/OverviewConsole';
import { DocumentsConsole } from './views/DocumentsConsole';
import { DecryptionConsole } from './views/DecryptionConsole';
import { EvidenceConsole } from './views/EvidenceConsole';
import { AccountManagementConsole } from './views/AccountManagementConsole';
import { ApiClient } from './api/client';
import { DocumentRecord, Officer, LedgerBlock, UserAccount } from './types';

import { LoginPage } from './components/LoginPage';
import { LogoutAnimation } from './components/LogoutAnimation';

const STORAGE_KEY_USER = 'ciphertrace_operator_user';
const STORAGE_KEY_BOOT_ID = 'ciphertrace_server_boot_id';

export function App() {
  const [activeModule, setActiveModule] = useState<WorkstationModule>('overview');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Global operational records
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);

  // Ephemeral session loading: clean up legacy localStorage and check active session
  useEffect(() => {
    try {
      // Purge any persistent disk-stored credentials so restarts always require fresh auth
      localStorage.removeItem(STORAGE_KEY_USER);

      const savedUser = sessionStorage.getItem(STORAGE_KEY_USER);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
      }
    } catch {
      // Ignore storage error
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
        setIsOnline(true);
        const serverBootId = h.value.server_boot_id;
        const storedBootId = sessionStorage.getItem(STORAGE_KEY_BOOT_ID);

        // The worker restarted, so its session (and unlocked keystore) is gone: sign out here too
        if (serverBootId) {
          if (storedBootId && storedBootId !== serverBootId) {
            sessionStorage.removeItem(STORAGE_KEY_USER);
            sessionStorage.setItem(STORAGE_KEY_BOOT_ID, serverBootId);
            setCurrentUser(null);
            setDocuments([]);
            setBlocks([]);
            return;
          }
          sessionStorage.setItem(STORAGE_KEY_BOOT_ID, serverBootId);
        }
      } else {
        setIsOnline(false);
      }

      if (d.status === 'fulfilled') setDocuments(d.value);
      if (o.status === 'fulfilled') {
        setOfficers(o.value);
        // Evict session if user does not exist in database
        try {
          const savedUser = sessionStorage.getItem(STORAGE_KEY_USER);
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            if (!o.value.some(u => u.username === parsed.username || u.id === parsed.id)) {
              sessionStorage.removeItem(STORAGE_KEY_USER);
              setCurrentUser(null);
            }
          }
        } catch {
          // Ignore error
        }
      }
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

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setDocuments([]);
    try {
      sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch {
      // Ignore storage error
    }
    setActiveModule('overview');
    refreshAllData();
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
  };

  const finishLogout = async () => {
    // The worker forgets this session's keystore passphrase.
    try {
      await ApiClient.logout();
    } catch {
      // Worker not running: its session ended with it
    }
    setCurrentUser(null);
    setDocuments([]);
    setBlocks([]);
    setIsLoggingOut(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY_USER);
    } catch {
      // Ignore storage error
    }
  };

  // If currently logging out, render the cinematic cannon fire & ship sinking animation
  if (isLoggingOut) {
    return (
      <ErrorBoundary>
        <LogoutAnimation onComplete={finishLogout} />
      </ErrorBoundary>
    );
  }

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
          isOnline={isOnline}
          onOpenAuth={() => setIsAuthOpen(true)}
          onLogout={handleLogout}
        />

        {/* Main Viewport */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden'
        }}>
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

            {activeModule === 'accounts' && (
              <AccountManagementConsole
                officers={officers}
                currentUser={currentUser}
                onAccountCreated={refreshAllData}
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
