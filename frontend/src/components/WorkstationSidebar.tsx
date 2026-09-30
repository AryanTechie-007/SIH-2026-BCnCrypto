import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutGrid,
  FolderLock,
  KeyRound,
  FileSearch,
  LogOut,
  Users,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { UserAccount } from '../types';

export type WorkstationModule = 'overview' | 'documents' | 'decryption' | 'evidence' | 'accounts';

interface WorkstationSidebarProps {
  activeModule: WorkstationModule;
  setActiveModule: (module: WorkstationModule) => void;
  currentUser: UserAccount | null;
  isOnline: boolean;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

const STORAGE_COLLAPSED_KEY = 'ciphertrace_sidebar_collapsed';
const STORAGE_WIDTH_KEY = 'ciphertrace_sidebar_width';
const DEFAULT_EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 68;
const MIN_DRAG_WIDTH = 180;
const MAX_DRAG_WIDTH = 420;

export const WorkstationSidebar: React.FC<WorkstationSidebarProps> = ({
  activeModule,
  setActiveModule,
  currentUser,
  isOnline,
  onOpenAuth: _onOpenAuth,
  onLogout
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [expandedWidth, setExpandedWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_WIDTH_KEY));
      return saved >= MIN_DRAG_WIDTH && saved <= MAX_DRAG_WIDTH ? saved : DEFAULT_EXPANDED_WIDTH;
    } catch {
      return DEFAULT_EXPANDED_WIDTH;
    }
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartX = useRef<number>(0);
  const dragStartWidth = useRef<number>(expandedWidth);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_COLLAPSED_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : expandedWidth;

  // Handle dragging on the right resize border
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = isCollapsed ? COLLAPSED_WIDTH : expandedWidth;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX.current;
      const newWidth = dragStartWidth.current + deltaX;

      if (newWidth < 125) {
        setIsCollapsed(true);
        try {
          localStorage.setItem(STORAGE_COLLAPSED_KEY, 'true');
        } catch {}
      } else {
        setIsCollapsed(false);
        const clamped = Math.max(MIN_DRAG_WIDTH, Math.min(MAX_DRAG_WIDTH, newWidth));
        setExpandedWidth(clamped);
        try {
          localStorage.setItem(STORAGE_COLLAPSED_KEY, 'false');
          localStorage.setItem(STORAGE_WIDTH_KEY, String(clamped));
        } catch {}
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const handleDoubleClickResizer = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setExpandedWidth(DEFAULT_EXPANDED_WIDTH);
    } else {
      if (expandedWidth !== DEFAULT_EXPANDED_WIDTH) {
        setExpandedWidth(DEFAULT_EXPANDED_WIDTH);
      } else {
        setIsCollapsed(true);
      }
    }
  };

  const navItems = [
    { id: 'overview' as WorkstationModule, label: 'Dashboard', icon: LayoutGrid },
    { id: 'documents' as WorkstationModule, label: 'Encryption Lab', icon: FolderLock },
    { id: 'decryption' as WorkstationModule, label: 'Decryption Lab', icon: KeyRound },
    { id: 'evidence' as WorkstationModule, label: 'Forensic Leak Lab', icon: FileSearch },
    { id: 'accounts' as WorkstationModule, label: 'Account Management', icon: Users }
  ];

  return (
    <aside
      style={{
        width: `${currentWidth}px`,
        minWidth: `${currentWidth}px`,
        maxWidth: `${currentWidth}px`,
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-hard)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        userSelect: 'none',
        position: 'relative',
        transition: isDragging
          ? 'none'
          : 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.22s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* Draggable Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClickResizer}
        title={isCollapsed ? 'Drag right to extend sidebar' : 'Drag to resize sidebar (double-click to toggle/reset)'}
        style={{
          position: 'absolute',
          top: 0,
          right: -3,
          width: '6px',
          height: '100%',
          cursor: 'col-resize',
          zIndex: 50,
          backgroundColor: isDragging ? 'rgba(56, 189, 248, 0.5)' : 'transparent',
          transition: 'background-color 0.15s ease'
        }}
        onMouseEnter={e => {
          if (!isDragging) e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.35)';
        }}
        onMouseLeave={e => {
          if (!isDragging) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      />

      {/* Top Brand Section */}
      <div>
        {!isCollapsed ? (
          <div
            style={{
              padding: '16px 14px',
              borderBottom: '1px solid var(--border-hard)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <img
                  src="./logo.png"
                  alt="CipherTrace Logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 5px rgba(56, 189, 248, 0.45))'
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                CIPHERTRACE
              </div>
            </div>

            <button
              onClick={toggleCollapse}
              title="Retract sidebar (Collapse)"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border-hard)',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '5px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#38bdf8';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-dim)';
                e.currentTarget.style.borderColor = 'var(--border-hard)';
              }}
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '16px 8px',
              borderBottom: '1px solid var(--border-hard)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <img
                src="./logo.png"
                alt="CipherTrace Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.5))'
                }}
              />
            </div>

            <button
              onClick={toggleCollapse}
              title="Extend sidebar (Expand)"
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)';
              }}
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        )}

        {/* Navigation Modules */}
        <div style={{ padding: isCollapsed ? '12px 6px 8px' : '14px 12px 8px' }}>
          {!isCollapsed && (
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-dim)',
                padding: '0 8px 8px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              Navigation
            </div>
          )}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  title={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: isCollapsed ? '0' : '10px',
                    width: '100%',
                    padding: isCollapsed ? '11px 0' : '10px 12px',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#3b82f6' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'rgba(37, 99, 235, 0.14)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                    cursor: 'pointer',
                    borderRadius: '0 4px 4px 0',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Icon size={isCollapsed ? 18 : 16} color={isActive ? '#3b82f6' : 'var(--text-dim)'} style={{ flexShrink: 0 }} />
                  {!isCollapsed && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Status Panel */}
      <div
        style={{
          padding: isCollapsed ? '12px 6px' : '14px 16px',
          borderTop: '1px solid var(--border-hard)',
          backgroundColor: 'var(--bg-topbar)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCollapsed ? 'center' : 'stretch',
          gap: isCollapsed ? '12px' : '10px'
        }}
      >
        {/* User Card */}
        {currentUser && (
          !isCollapsed ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {currentUser.name}
                </div>
                <div
                  style={{
                    color: 'var(--text-dim)',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  @{currentUser.username}
                </div>
              </div>

              <button
                onClick={onLogout}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-hard)',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = '#ef4444';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-dim)';
                  e.currentTarget.style.borderColor = 'var(--border-hard)';
                }}
                title="Log Out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                title={`${currentUser.name} (@${currentUser.username})`}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'default'
                }}
              >
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>

              <button
                onClick={onLogout}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-hard)',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = '#ef4444';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-dim)';
                  e.currentTarget.style.borderColor = 'var(--border-hard)';
                }}
                title="Log Out"
              >
                <LogOut size={13} />
              </button>
            </div>
          )
        )}

        {/* System Node Telemetry */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            fontSize: '10px',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)'
          }}
          title={isOnline ? 'System Online (Fabric Node Active)' : 'System Offline'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isOnline ? '#10b981' : '#f43f5e',
                boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.5)' : 'none',
                flexShrink: 0
              }}
            />
            {!isCollapsed && <span>{isOnline ? 'System Online' : 'Offline'}</span>}
          </div>
        </div>
      </div>
    </aside>
  );
};
