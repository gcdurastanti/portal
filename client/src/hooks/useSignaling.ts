import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Message,
  MessageType,
  RegisterPayload,
  MotionDetectedPayload,
  PresenceUpdatePayload,
  Device
} from '@portal/shared';
import { config } from '../config';

export function useSignaling() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presentDevices, setPresentDevices] = useState<Device[]>([]);
  const [isInConference, setIsInConference] = useState(false);
  const [conferenceParticipants, setConferenceParticipants] = useState<string[]>([]);

  const messageHandlers = useRef<Map<MessageType, (payload: any) => void>>(new Map());

  const sendMessage = useCallback((message: Message) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', message);
    }
  }, []);

  const registerMessageHandler = useCallback((type: MessageType, handler: (payload: any) => void) => {
    messageHandlers.current.set(type, handler);
  }, []);

  useEffect(() => {
    const socket = io(config.signalingServerUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
      setConnected(true);

      // Register device
      const registerPayload: RegisterPayload = {
        deviceId: config.deviceId,
        groupId: config.groupId,
        deviceName: config.deviceName
      };

      sendMessage({
        type: MessageType.REGISTER,
        payload: registerPayload,
        timestamp: Date.now()
      });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setConnected(false);
    });

    socket.on('message', (msg: Message) => {
      console.log('Message received:', msg.type);

      // Handle presence updates
      if (msg.type === MessageType.PRESENCE_UPDATE) {
        const payload = msg.payload as PresenceUpdatePayload;
        setPresentDevices(payload.presentDevices);
      }

      // Handle conference start
      if (msg.type === MessageType.CONFERENCE_START) {
        setIsInConference(true);
        setConferenceParticipants(msg.payload.participants);
      }

      // Handle conference end
      if (msg.type === MessageType.CONFERENCE_END) {
        setIsInConference(false);
        setConferenceParticipants([]);
      }

      // Call registered handler
      const handler = messageHandlers.current.get(msg.type);
      if (handler) {
        handler(msg.payload);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [sendMessage]);

  const reportMotionDetected = useCallback(() => {
    const payload: MotionDetectedPayload = {
      deviceId: config.deviceId,
      timestamp: Date.now()
    };

    sendMessage({
      type: MessageType.MOTION_DETECTED,
      payload,
      timestamp: Date.now()
    });
  }, [sendMessage]);

  const reportMotionStopped = useCallback(() => {
    sendMessage({
      type: MessageType.MOTION_STOPPED,
      payload: {
        deviceId: config.deviceId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });
  }, [sendMessage]);

  return {
    connected,
    presentDevices,
    isInConference,
    conferenceParticipants,
    sendMessage,
    registerMessageHandler,
    reportMotionDetected,
    reportMotionStopped
  };
}
