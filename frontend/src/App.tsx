import React, { useState, useEffect } from 'react';
import { TopHeader } from './components/TopHeader';
import { TelemetryBar } from './components/TelemetryBar';
import { AuthModal } from './components/AuthModal';
import { SenderConsole } from './views/SenderConsole';
import { RecipientConsole } from './views/RecipientConsole';
import { ForensicConsole } from './views/ForensicConsole';
import { ApiClient } from './api/client';
import { SystemHealth, UserAccount } from './types';

const STORAGE_KEY_USER = 'ciphertrace_operator_user';
const STORAGE_KEY_TOKEN = 'ciphertrace_operator_token';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('sender');
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Load saved session
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  const handleLoginSuccess = (user: UserAccount, token: string) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } catch {
      // Ignore storage error
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    } catch {
      // Ignore storage error
    }
    setIsAuthOpen(true);
  };

  const checkHealth = async () => {
    try {
      const h = await ApiClient.getHealth();
      setSystemHealth(h);
      setHealthError(null);
    } catch (err: any) {
      setSystemHealth(null);
      setHealthError(err.message || 'Backend unreachable');
    }
  };

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-core)' }}>
      {/* Top Header Navigation */}
      <TopHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemHealth={systemHealth}
        healthError={healthError}
        onRefreshHealth={checkHealth}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Tactical Workspace */}
      <main style={{ flex: 1 }}>
        {activeTab === 'sender' && (
          <SenderConsole
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}
        {activeTab === 'recipient' && (
          <RecipientConsole
            currentOperator={currentUser ? {
              id: currentUser.id,
              username: currentUser.username,
              navy_id: currentUser.navy_id,
              name: currentUser.name,
              rank: currentUser.rank,
              command_unit: currentUser.command_unit,
              clearance_level: currentUser.clearance_level,
              device_id: currentUser.device_id,
              status: currentUser.status,
              ml_kem_pub_preview: currentUser.ml_kem_pub_preview,
              ml_dsa_pub_preview: currentUser.ml_dsa_pub_preview
            } : null}
          />
        )}
        {activeTab === 'forensics' && <ForensicConsole />}
      </main>

      {/* Global Defense Telemetry Footer */}
      <TelemetryBar systemHealth={systemHealth} />

      {/* Authentication & Operator Enrollment Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default App;
