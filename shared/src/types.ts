// WebSocket message types
export enum MessageType {
  // Connection & Authentication
  REGISTER = 'register',
  REGISTER_ACK = 'register_ack',

  // Presence
  MOTION_DETECTED = 'motion_detected',
  MOTION_STOPPED = 'motion_stopped',
  PRESENCE_UPDATE = 'presence_update',

  // WebRTC Signaling
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice_candidate',

  // Conference Management
  CONFERENCE_START = 'conference_start',
  CONFERENCE_END = 'conference_end',
  PEER_JOINED = 'peer_joined',
  PEER_LEFT = 'peer_left',

  // Errors
  ERROR = 'error'
}

// Device representation
export interface Device {
  id: string;
  groupId: string;
  name: string;
  isPresent: boolean;
  lastMotionAt?: Date;
}

// Group/Family representation
export interface Group {
  id: string;
  name: string;
  deviceIds: string[];
}

// WebSocket message structure
export interface Message {
  type: MessageType;
  payload: any;
  from?: string;
  to?: string;
  timestamp: number;
}

// Specific message payloads
export interface RegisterPayload {
  deviceId: string;
  groupId: string;
  deviceName: string;
}

export interface RegisterAckPayload {
  success: boolean;
  deviceId: string;
  groupId: string;
  message?: string;
}

export interface MotionDetectedPayload {
  deviceId: string;
  timestamp: number;
}

export interface MotionStoppedPayload {
  deviceId: string;
  timestamp: number;
}

export interface PresenceUpdatePayload {
  groupId: string;
  presentDevices: Device[];
}

export interface OfferPayload {
  sdp: RTCSessionDescriptionInit;
  from: string;
  to: string;
}

export interface AnswerPayload {
  sdp: RTCSessionDescriptionInit;
  from: string;
  to: string;
}

export interface IceCandidatePayload {
  candidate: RTCIceCandidateInit;
  from: string;
  to: string;
}

export interface ConferenceStartPayload {
  conferenceId: string;
  participants: string[]; // device IDs
}

export interface ConferenceEndPayload {
  conferenceId: string;
  reason?: string;
}

export interface PeerJoinedPayload {
  deviceId: string;
  deviceName: string;
}

export interface PeerLeftPayload {
  deviceId: string;
  deviceName: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// Configuration
export interface ClientConfig {
  signalingServerUrl: string;
  motionThreshold: number; // Pixel difference threshold
  motionTimeout: number; // Time before presence expires (ms)
  stunServers: RTCIceServer[];
  turnServers?: RTCIceServer[];
}

export interface ServerConfig {
  port: number;
  databasePath: string;
  presenceTimeout: number; // Time before device marked as not present
}
