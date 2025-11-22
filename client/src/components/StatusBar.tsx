import React from 'react';
import { Device } from '@portal/shared';

interface StatusBarProps {
  connected: boolean;
  isMotionActive: boolean;
  isInConference: boolean;
  presentDevices: Device[];
}

export function StatusBar({
  connected,
  isMotionActive,
  isInConference,
  presentDevices
}: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-item">
        <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="status-item">
        <div className={`status-indicator ${isMotionActive ? 'active' : 'inactive'}`} />
        <span>Motion: {isMotionActive ? 'Active' : 'Idle'}</span>
      </div>

      <div className="status-item">
        <span>Present: {presentDevices.length}</span>
      </div>

      {isInConference && (
        <div className="status-item conference">
          <span>In Conference</span>
        </div>
      )}
    </div>
  );
}
