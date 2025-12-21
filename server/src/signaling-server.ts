import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import {
  Message,
  MessageType,
  RegisterPayload,
  MotionDetectedPayload,
  MotionStoppedPayload,
  OfferPayload,
  AnswerPayload,
  IceCandidatePayload,
  Device
} from '@portal/shared';
import { PortalDatabase } from './database';
import { PresenceManager } from './presence-manager';

export class SignalingServer {
  private io: SocketIOServer;
  private db: PortalDatabase;
  private presenceManager: PresenceManager;
  private deviceSockets: Map<string, string> = new Map(); // deviceId -> socketId
  private socketDevices: Map<string, string> = new Map(); // socketId -> deviceId
  private activeConferences: Map<string, Set<string>> = new Map(); // groupId -> Set of deviceIds

  constructor(httpServer: HTTPServer, db: PortalDatabase, presenceTimeout: number) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.db = db;
    this.presenceManager = new PresenceManager(presenceTimeout);

    this.setupEventHandlers();
    this.setupPresenceHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on('message', (msg: Message) => {
        this.handleMessage(socket, msg);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private setupPresenceHandlers() {
    this.presenceManager.on('presence_changed', (groupId: string) => {
      this.handlePresenceChange(groupId);
    });
  }

  private handleMessage(socket: Socket, msg: Message) {
    console.log(`Message received: ${msg.type} from ${socket.id}`);

    switch (msg.type) {
      case MessageType.REGISTER:
        this.handleRegister(socket, msg.payload as RegisterPayload);
        break;

      case MessageType.MOTION_DETECTED:
        this.handleMotionDetected(socket, msg.payload as MotionDetectedPayload);
        break;

      case MessageType.MOTION_STOPPED:
        this.handleMotionStopped(socket, msg.payload as MotionStoppedPayload);
        break;

      case MessageType.OFFER:
        this.handleOffer(socket, msg.payload as OfferPayload);
        break;

      case MessageType.ANSWER:
        this.handleAnswer(socket, msg.payload as AnswerPayload);
        break;

      case MessageType.ICE_CANDIDATE:
        this.handleIceCandidate(socket, msg.payload as IceCandidatePayload);
        break;

      default:
        console.warn(`Unknown message type: ${msg.type}`);
    }
  }

  private handleRegister(socket: Socket, payload: RegisterPayload) {
    const { deviceId, groupId, deviceName } = payload;

    // Ensure group exists
    if (!this.db.getGroup(groupId)) {
      try {
        console.log(`Creating new group: ${groupId}`);
        this.db.createGroup(groupId, 'Family Group');
      } catch (error) {
        console.error('Failed to create group:', error);
        this.sendError(socket, 'GROUP_CREATION_FAILED', 'Failed to create group');
        return;
      }
    }

    // Check if device exists, create if not
    if (!this.db.deviceExists(deviceId)) {
      try {
        this.db.createDevice(deviceId, groupId, deviceName);
      } catch (error) {
        console.error('Failed to register device:', error);
        this.sendError(socket, 'REGISTER_FAILED', 'Failed to register device');
        return;
      }
    } else {
      // Device exists, update its group to the current one
      try {
        this.db.updateDeviceGroup(deviceId, groupId);
      } catch (error) {
        console.error('Failed to update device group:', error);
      }
    }

    // Map socket to device
    this.deviceSockets.set(deviceId, socket.id);
    this.socketDevices.set(socket.id, deviceId);

    // Send acknowledgment
    this.sendMessage(socket, {
      type: MessageType.REGISTER_ACK,
      payload: {
        success: true,
        deviceId,
        groupId
      },
      timestamp: Date.now()
    });

    console.log(`Device registered: ${deviceId} (${deviceName}) in group ${groupId}`);

    // Send current presence state
    const presentDevices = this.presenceManager.getPresentDevicesInGroup(groupId);
    this.sendMessage(socket, {
      type: MessageType.PRESENCE_UPDATE,
      payload: {
        groupId,
        presentDevices
      },
      timestamp: Date.now()
    });

    // If there's an active conference AND this device is present, notify the new client
    // DISABLED: LiveKit handles conference logic
    /*
    const conferenceParticipants = this.activeConferences.get(groupId);
    const isDevicePresent = presentDevices.some(d => d.id === deviceId);
    if (conferenceParticipants && conferenceParticipants.size >= 2 && isDevicePresent) {
      this.sendMessage(socket, {
        type: MessageType.CONFERENCE_START,
        payload: {
          conferenceId: groupId,
          participants: Array.from(conferenceParticipants)
        },
        timestamp: Date.now()
      });
    }
    */
  }

  private handleMotionDetected(socket: Socket, payload: MotionDetectedPayload) {
    const { deviceId } = payload;
    const deviceData = this.db.getDevice(deviceId);

    if (!deviceData) {
      this.sendError(socket, 'DEVICE_NOT_FOUND', 'Device not registered');
      return;
    }

    const device: Device = {
      id: deviceData.id,
      groupId: deviceData.groupId,
      name: deviceData.name,
      isPresent: true
    };

    this.presenceManager.markPresent(device);
    console.log(`Motion detected for device: ${deviceId}`);
  }

  private handleMotionStopped(socket: Socket, payload: MotionStoppedPayload) {
    const { deviceId } = payload;
    this.presenceManager.markNotPresent(deviceId);
    console.log(`Motion stopped for device: ${deviceId}`);
  }

  private handlePresenceChange(groupId: string) {
    const presentDevices = this.presenceManager.getPresentDevicesInGroup(groupId);

    console.log(`Presence changed for group ${groupId}: ${presentDevices.length} devices present`);

    // Broadcast presence update to all devices in the group
    this.broadcastToGroup(groupId, {
      type: MessageType.PRESENCE_UPDATE,
      payload: {
        groupId,
        presentDevices
      },
      timestamp: Date.now()
    });

    // Start or end conference based on presence
    // DISABLED: LiveKit handles conference logic on the client side
    /*
    if (presentDevices.length >= 2) {
      this.startConference(groupId, presentDevices);
    } else {
      this.endConference(groupId);
    }
    */
  }

  private startConference(groupId: string, participants: Device[]) {
    const existingConference = this.activeConferences.get(groupId);
    const participantIds = participants.map(p => p.id);

    // If conference already active with same participants, do nothing
    if (existingConference &&
      existingConference.size === participantIds.length &&
      participantIds.every(id => existingConference.has(id))) {
      return;
    }

    this.activeConferences.set(groupId, new Set(participantIds));

    console.log(`Starting conference for group ${groupId} with ${participantIds.length} participants`);

    // Notify ONLY present participants (not the entire group)
    const message: Message = {
      type: MessageType.CONFERENCE_START,
      payload: {
        conferenceId: groupId,
        participants: participantIds
      },
      timestamp: Date.now()
    };

    for (const deviceId of participantIds) {
      const socketId = this.deviceSockets.get(deviceId);
      if (socketId) {
        this.io.to(socketId).emit('message', message);
      }
    }
  }

  private endConference(groupId: string) {
    if (!this.activeConferences.has(groupId)) {
      return;
    }

    console.log(`Ending conference for group ${groupId}`);

    this.activeConferences.delete(groupId);

    this.broadcastToGroup(groupId, {
      type: MessageType.CONFERENCE_END,
      payload: {
        conferenceId: groupId,
        reason: 'Insufficient participants'
      },
      timestamp: Date.now()
    });
  }

  private handleOffer(socket: Socket, payload: OfferPayload) {
    const { to, from, sdp } = payload;
    const targetSocketId = this.deviceSockets.get(to);

    if (!targetSocketId) {
      this.sendError(socket, 'PEER_NOT_FOUND', `Device ${to} not connected`);
      return;
    }

    this.io.to(targetSocketId).emit('message', {
      type: MessageType.OFFER,
      payload: { from, to, sdp },
      timestamp: Date.now()
    });
  }

  private handleAnswer(socket: Socket, payload: AnswerPayload) {
    const { to, from, sdp } = payload;
    const targetSocketId = this.deviceSockets.get(to);

    if (!targetSocketId) {
      this.sendError(socket, 'PEER_NOT_FOUND', `Device ${to} not connected`);
      return;
    }

    this.io.to(targetSocketId).emit('message', {
      type: MessageType.ANSWER,
      payload: { from, to, sdp },
      timestamp: Date.now()
    });
  }

  private handleIceCandidate(socket: Socket, payload: IceCandidatePayload) {
    const { to, from, candidate } = payload;
    const targetSocketId = this.deviceSockets.get(to);

    if (!targetSocketId) {
      return; // Silently ignore, as ICE candidates can arrive after peer disconnects
    }

    this.io.to(targetSocketId).emit('message', {
      type: MessageType.ICE_CANDIDATE,
      payload: { from, to, candidate },
      timestamp: Date.now()
    });
  }

  private handleDisconnect(socket: Socket) {
    const deviceId = this.socketDevices.get(socket.id);

    if (deviceId) {
      // Only handle disconnect if this is the current socket for the device
      // This prevents race conditions where a new connection is established
      // before the old one is fully cleaned up
      const currentSocketId = this.deviceSockets.get(deviceId);

      if (currentSocketId === socket.id) {
        console.log(`Device disconnected: ${deviceId}`);
        this.presenceManager.markNotPresent(deviceId);
        this.deviceSockets.delete(deviceId);
      } else {
        console.log(`Ignoring disconnect for replaced socket: ${socket.id} (device: ${deviceId})`);
      }

      this.socketDevices.delete(socket.id);
    }

    console.log(`Client disconnected: ${socket.id}`);
  }

  private broadcastToGroup(groupId: string, message: Message) {
    const group = this.db.getGroup(groupId);
    if (!group) return;

    for (const deviceId of group.deviceIds) {
      const socketId = this.deviceSockets.get(deviceId);
      if (socketId) {
        this.io.to(socketId).emit('message', message);
      }
    }
  }

  private sendMessage(socket: Socket, message: Message) {
    socket.emit('message', message);
  }

  private sendError(socket: Socket, code: string, message: string) {
    this.sendMessage(socket, {
      type: MessageType.ERROR,
      payload: { code, message },
      timestamp: Date.now()
    });
  }

  cleanup() {
    this.presenceManager.cleanup();
  }
}
