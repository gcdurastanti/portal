
import { Device } from '@portal/shared';

interface StatusBarProps {
  connected: boolean;
  isMotionActive: boolean;
  isInConference: boolean;
  presentDevices: Device[];
  isMuted: boolean;
  onToggleMute: () => void;
  isMotionEnabled: boolean;
  onToggleMotion: () => void;
}

export function StatusBar({
  connected,
  isMotionActive,
  isInConference,
  presentDevices,
  isMuted,
  onToggleMute,
  isMotionEnabled,
  onToggleMotion
}: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-item">
        <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="status-item clickable" onClick={onToggleMotion}>
        <div className={`status-indicator ${isMotionEnabled ? (isMotionActive ? 'active' : 'inactive') : 'disabled'}`} />
        <span>Motion: {!isMotionEnabled ? 'Off' : (isMotionActive ? 'Active' : 'Idle')}</span>
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
    </div>
  );
}
