import React, { Component } from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)',
          backgroundColor: '#0c121e',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          border: '2px solid var(--border-danger)'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>SYSTEM CRITICAL FAILURE</h2>
          <p>A component has crashed. The system is attempting to isolate the fault.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
              cursor: 'pointer'
            }}
          >
            RESTART WORKSTATION
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
