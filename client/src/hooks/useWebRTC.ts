import { useEffect, useRef, useCallback, useState } from 'react';
import {
  MessageType,
  OfferPayload,
  AnswerPayload,
  IceCandidatePayload
} from '@portal/shared';
import { config } from '../config';

interface UseWebRTCProps {
  localStream: MediaStream | null;
  participants: string[];
  sendMessage: (msg: any) => void;
  registerMessageHandler: (type: MessageType, handler: (payload: any) => void) => void;
}

export function useWebRTC({
  localStream,
  participants,
  sendMessage,
  registerMessageHandler
}: UseWebRTCProps) {
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: config.iceServers
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const payload: IceCandidatePayload = {
          candidate: event.candidate.toJSON(),
          from: config.deviceId,
          to: peerId
        };

        sendMessage({
          type: MessageType.ICE_CANDIDATE,
          payload,
          timestamp: Date.now()
        });
      }
    };

    // Handle incoming streams
    pc.ontrack = (event) => {
      console.log('Received remote track from', peerId);
      const [remoteStream] = event.streams;

      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(peerId, remoteStream);
        return next;
      });
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, pc.connectionState);

      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeerConnection(peerId);
      }
    };

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, [localStream, sendMessage]);

  const closePeerConnection = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }

    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const createOffer = useCallback(async (peerId: string) => {
    const pc = createPeerConnection(peerId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const payload: OfferPayload = {
        sdp: offer,
        from: config.deviceId,
        to: peerId
      };

      sendMessage({
        type: MessageType.OFFER,
        payload,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      closePeerConnection(peerId);
    }
  }, [createPeerConnection, sendMessage, closePeerConnection]);

  const handleOffer = useCallback(async (payload: OfferPayload) => {
    const { from, sdp } = payload;
    const pc = createPeerConnection(from);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const answerPayload: AnswerPayload = {
        sdp: answer,
        from: config.deviceId,
        to: from
      };

      sendMessage({
        type: MessageType.ANSWER,
        payload: answerPayload,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      closePeerConnection(from);
    }
  }, [createPeerConnection, sendMessage, closePeerConnection]);

  const handleAnswer = useCallback(async (payload: AnswerPayload) => {
    const { from, sdp } = payload;
    const pc = peerConnectionsRef.current.get(from);

    if (!pc) {
      console.error('No peer connection for answer from', from);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
      console.error('Error handling answer:', error);
      closePeerConnection(from);
    }
  }, [closePeerConnection]);

  const handleIceCandidate = useCallback(async (payload: IceCandidatePayload) => {
    const { from, candidate } = payload;
    const pc = peerConnectionsRef.current.get(from);

    if (!pc) {
      console.warn('No peer connection for ICE candidate from', from);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);

  // Register message handlers
  useEffect(() => {
    registerMessageHandler(MessageType.OFFER, handleOffer);
    registerMessageHandler(MessageType.ANSWER, handleAnswer);
    registerMessageHandler(MessageType.ICE_CANDIDATE, handleIceCandidate);
  }, [registerMessageHandler, handleOffer, handleAnswer, handleIceCandidate]);

  // Manage peer connections based on participants
  useEffect(() => {
    const myDeviceId = config.deviceId;
    const otherParticipants = participants.filter(id => id !== myDeviceId);

    // Create connections to new participants
    otherParticipants.forEach(peerId => {
      if (!peerConnectionsRef.current.has(peerId)) {
        // Only create offer if our device ID is alphabetically smaller
        // This ensures only one peer creates the offer
        if (myDeviceId < peerId) {
          createOffer(peerId);
        }
      }
    });

    // Close connections to removed participants
    const currentPeers = Array.from(peerConnectionsRef.current.keys());
    currentPeers.forEach(peerId => {
      if (!otherParticipants.includes(peerId)) {
        closePeerConnection(peerId);
      }
    });
  }, [participants, createOffer, closePeerConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach((pc) => {
        pc.close();
      });
      peerConnectionsRef.current.clear();
    };
  }, []);

  return { remoteStreams };
}
