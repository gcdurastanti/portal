
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
  const cycleTimeout = () => {
    // Cycle through 5s, 15s, 30s, 60s
    const timeouts = [5000, 15000, 30000, 60000];
    // Find closest current timeout (in case it's custom)
    const currentIndex = timeouts.findIndex(t => t >= motionTimeout);
    const nextIndex = (currentIndex + 1) % timeouts.length;
    onSetMotionTimeout(timeouts[nextIndex]);
  };

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
    </div>
  );
}
