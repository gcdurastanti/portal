export const config = {
  signalingServerUrl: import.meta.env.VITE_SIGNALING_SERVER || '/',
  motionThreshold: parseInt(import.meta.env.VITE_MOTION_THRESHOLD || '60', 10),
  motionTimeout: parseInt(import.meta.env.VITE_MOTION_TIMEOUT || '60000', 10),
  deviceId: import.meta.env.VITE_DEVICE_ID || generateDeviceId(),
  groupId: import.meta.env.VITE_GROUP_ID || 'default-group',
  deviceName: import.meta.env.VITE_DEVICE_NAME || 'Portal Device',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function generateDeviceId(): string {
  const stored = localStorage.getItem('portal_device_id');
  if (stored) return stored;

  const id = `device_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('portal_device_id', id);
  return id;
}
