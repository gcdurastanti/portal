import { useState, useEffect, useRef } from 'react';
import { Device, Group } from '@portal/shared';
import { useAuth } from '../contexts/AuthContext';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { api } from '../api/client';

interface StatusBarProps {
  connected: boolean;
  isMotionActive: boolean;
  isInConference: boolean;
  presentDevices: Device[];
  isMuted: boolean;
  onToggleMute: () => void;
  isMotionEnabled: boolean;
  onToggleMotion: () => void;
  motionTimeout: number;
  onSetMotionTimeout: (timeout: number) => void;
}

export function StatusBar({
  connected,
  isMotionActive,
  isInConference,
  presentDevices,
  isMuted,
  onToggleMute,
  isMotionEnabled,
  onToggleMotion,
  motionTimeout,
  onSetMotionTimeout
}: StatusBarProps) {
  const { user, logout } = useAuth();
  const { activeGroupId, setActiveGroupId } = useActiveGroup();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      api.get<{ groups: Group[] }>('/auth/me').then(response => {
        setGroups(response.groups);
        // If activeGroupId is not in the list (and list is not empty), default to the first one
        if (response.groups.length > 0 && !response.groups.find(g => g.id === activeGroupId)) {
          setActiveGroupId(response.groups[0].id);
        }
      }).catch(console.error);
    }
  }, [user, activeGroupId, setActiveGroupId]);

  // Close selector when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setShowGroupSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const cycleTimeout = () => {
    // Cycle through 5s, 15s, 30s, 60s
    const timeouts = [5000, 15000, 30000, 60000];
    // Find closest current timeout (in case it's custom)
    const currentIndex = timeouts.findIndex(t => t >= motionTimeout);
    const nextIndex = (currentIndex + 1) % timeouts.length;
    onSetMotionTimeout(timeouts[nextIndex]);
  };

  const activeGroup = groups.find(g => g.id === activeGroupId);

  return (
    <div className="status-bar">
      <div className="status-item">
        <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {/* Group Selector */}
      <div className="status-item clickable" onClick={() => setShowGroupSelector(!showGroupSelector)} style={{ position: 'relative' }}>
        <span>🏠 {activeGroup ? activeGroup.name : 'Select Group'}</span>
        {showGroupSelector && (
          <div ref={selectorRef} className="group-selector-dropdown" style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: 'rgba(20, 20, 20, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '5px',
            minWidth: '200px',
            zIndex: 1000,
            marginTop: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            {groups.map(group => (
              <div
                key={group.id}
                className="group-selector-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveGroupId(group.id);
                  setShowGroupSelector(false);
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  background: group.id === activeGroupId ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{group.name}</span>
                {group.id === activeGroupId && <span>✓</span>}
              </div>
            ))}
            {groups.length === 0 && (
              <div style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.5)' }}>No groups found</div>
            )}
          </div>
        )}
      </div>

      <div className="status-item clickable" onClick={onToggleMotion}>
        <div className={`status-indicator ${isMotionEnabled ? (isMotionActive ? 'active' : 'inactive') : 'disabled'}`} />
        <span>Motion: {!isMotionEnabled ? 'Off' : (isMotionActive ? 'Active' : 'Idle')}</span>
      </div>

      <div className="status-item clickable" onClick={cycleTimeout} title="Click to change motion timeout">
        <span>⏱️ {motionTimeout / 1000}s</span>
      </div>

      <div className="status-item clickable" onClick={onToggleMute}>
        <span>{isMuted ? '🔇 Muted' : '🔊 Unmuted'}</span>
      </div>

      <div className="status-item">
        <span>Present: {presentDevices.length}</span>
      </div>

      {isInConference && (
        <div className="status-item conference">
          <span>In Conference</span>
        </div>
      )}

      <div className="status-spacer" style={{ flex: 1 }} />

      {user && (
        <div className="status-item user-info">
          <span>👤 {user.displayName}</span>
          <button
            className="logout-button"
            onClick={() => window.location.href = '/groups'}
            style={{ marginRight: '8px' }}
          >
            Groups
          </button>
          <button className="logout-button" onClick={logout}>Sign Out</button>
        </div>
      )}
    </div>
  );
}
