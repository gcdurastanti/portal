import { useEffect, useState, useRef, useCallback } from 'react';
import { LiveKitRoom, VideoConference, useRoomContext } from '@livekit/components-react';
import { RoomEvent, RemoteParticipant } from 'livekit-client';
import '@livekit/components-styles';
import { useSignaling } from '../hooks/useSignaling';
import { useMotionDetection } from '../hooks/useMotionDetection';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { useNotification } from '../contexts/NotificationContext';
import { config } from '../config';
import { api } from '../api/client';
import { StatusBar } from './StatusBar';
import { Screensaver } from './Screensaver';
import { MessageType, PeerJoinedPayload, PeerLeftPayload } from '@portal/shared';

// Inner component to handle room events
function RoomEventsHandler() {
    const room = useRoomContext();
    const { showNotification } = useNotification();

    useEffect(() => {
        const handleParticipantConnected = (participant: RemoteParticipant) => {
            showNotification(`${participant.identity} joined the call`, 'info');
        };

        const handleParticipantDisconnected = (participant: RemoteParticipant) => {
            showNotification(`${participant.identity} left the call`, 'info');
        };

        room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
        room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

        return () => {
            room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
            room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        };
    }, [room, showNotification]);

    return null;
}

export function LiveKitPortal() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { activeGroupId } = useActiveGroup();
    const { showNotification } = useNotification();
    const [token, setToken] = useState<string>("");
    const [isMotionActive, setIsMotionActive] = useState(false);
    const [motionTimeout, setMotionTimeout] = useState(config.motionTimeout);
    const [isMuted, setIsMuted] = useState(false);
    const [manualConnect, setManualConnect] = useState(false);

    const {
        connected: signalingConnected,
        presentDevices,
        reportMotionDetected,
        reportMotionStopped,
        sendMessage,
        registerMessageHandler
    } = useSignaling(activeGroupId);

    // ...

    // Listen for peer join/left events (for idle users)
    useEffect(() => {
        if (!signalingConnected) return;

        registerMessageHandler(MessageType.PEER_JOINED, (payload: PeerJoinedPayload) => {
            // Only show if we are NOT in the call
            if (!token) {
                showNotification(
                    `${payload.deviceName} joined the call`,
                    'info',
                    {
                        label: 'Join Call',
                        onClick: () => setManualConnect(true)
                    },
                    10000
                );
            }
        });

        registerMessageHandler(MessageType.PEER_LEFT, (payload: PeerLeftPayload) => {
            if (!token) {
                showNotification(`${payload.deviceName} left the call`, 'info');
            }
        });
    }, [signalingConnected, registerMessageHandler, token, showNotification]);

    // Send join/leave messages when token changes
    useEffect(() => {
        if (token && signalingConnected) {
            sendMessage({
                type: MessageType.PEER_JOINED,
                payload: { deviceId: config.deviceId, deviceName: config.deviceName },
                timestamp: Date.now()
            });
        } else if (!token && signalingConnected) {
            // We can't reliably send this on disconnect if the socket is closed, 
            // but if we just left the room (token cleared) and socket is open, we send it.
            sendMessage({
                type: MessageType.PEER_LEFT,
                payload: { deviceId: config.deviceId, deviceName: config.deviceName },
                timestamp: Date.now()
            });
        }
    }, [token, signalingConnected, sendMessage]);

    // ...

    // Track previous presence to detect new arrivals
    const prevPresentDevicesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const currentDeviceIds = new Set(presentDevices.map(d => d.id));
        const prevDeviceIds = prevPresentDevicesRef.current;

        // Check for new devices
        for (const device of presentDevices) {
            if (!prevDeviceIds.has(device.id) && device.id !== config.deviceId) {
                // New device appeared!
                showNotification(
                    `${device.name} is present`,
                    'info',
                    !token ? {
                        label: 'Join Call',
                        onClick: () => setManualConnect(true)
                    } : undefined,
                    10000
                );
            }
        }

        prevPresentDevicesRef.current = currentDeviceIds;
    }, [presentDevices, token, showNotification]);

    // Clear token when active group changes to ensure we leave the previous room
    useEffect(() => {
        setToken("");
        setManualConnect(false);
    }, [activeGroupId]);

    // Re-announce presence when connected if motion is active
    useEffect(() => {
        if (signalingConnected && isMotionActive) {
            reportMotionDetected();
        }
    }, [signalingConnected, isMotionActive, reportMotionDetected]);

    // We need to keep track of motion to trigger room entry/exit
    // We can wrap the original useMotionDetection or just use it and react to its state
    const handleMotionDetected = useCallback(() => {
        setIsMotionActive(true);
        reportMotionDetected();
    }, [reportMotionDetected]);

    const handleMotionStopped = useCallback(() => {
        setIsMotionActive(false);
        setToken(""); // Always disconnect when motion stops (timeout)
        setManualConnect(false); // Reset manual flag
        reportMotionStopped();
    }, [reportMotionStopped]);

    const { isMotionEnabled, toggleMotion } = useMotionDetection(
        videoRef,
        handleMotionDetected,
        handleMotionStopped,
        motionTimeout
    );

    // Camera handling
    useEffect(() => {
        let stream: MediaStream | null = null;

        const startCamera = async () => {
            if (token) return; // Don't start if we are in a call

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 24 }
                    },
                    audio: false
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Failed to access camera:", err);
            }
        };

        const stopCamera = () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };

        if (!token) {
            startCamera();
        }

        return () => {
            stopCamera();
        };
    }, [token]);

    useEffect(() => {
        // Join if:
        // 1. Not already connected (!token)
        // 2. AND (Manual connect requested OR (Motion is active AND Multiple devices present))
        const shouldJoin = !token && (manualConnect || (isMotionActive && presentDevices.length >= 2));

        if (shouldJoin) {
            const fetchToken = async () => {
                try {
                    const data = await api.post<{ token: string }>('/livekit/token', {
                        roomName: activeGroupId,
                        participantName: config.deviceName,
                        identity: config.deviceId,
                    });
                    setToken(data.token);
                } catch (error) {
                    console.error('Failed to fetch LiveKit token:', error);
                    setManualConnect(false); // Reset on failure
                    showNotification('Failed to join call', 'error');
                }
            };
            fetchToken();
        }
    }, [isMotionActive, token, presentDevices.length, manualConnect, activeGroupId, showNotification]);

    const handleDisconnect = () => {
        setToken("");
        setManualConnect(false);
        setIsMotionActive(false); // Reset motion state
        reportMotionStopped(); // Explicitly clear presence
    };

    return (
        <div className="app">
            <StatusBar
                connected={signalingConnected}
                isMotionActive={isMotionActive}
                isInConference={!!token}
                presentDevices={presentDevices}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(!isMuted)}
                isMotionEnabled={isMotionEnabled}
                onToggleMotion={toggleMotion}
                motionTimeout={motionTimeout}
                onSetMotionTimeout={setMotionTimeout}
            />

            {token ? (
                <LiveKitRoom
                    video={true}
                    audio={!isMuted}
                    token={token}
                    serverUrl={import.meta.env.VITE_LIVEKIT_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/livekit-rtc`}
                    data-lk-theme="default"
                    style={{ height: '100vh' }}
                    onDisconnected={handleDisconnect}
                >
                    <VideoConference />
                    <RoomEventsHandler />
                </LiveKitRoom>
            ) : (
                <div className="idle-view">
                    <Screensaver active={!isMotionActive} />

                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="preview-video"
                        style={{ opacity: isMotionActive ? 1 : 0, transition: 'opacity 0.5s' }}
                    />

                    {isMotionActive && (
                        <div className="idle-message">
                            <h2>Waiting for connection...</h2>
                            <p>Walk by your portal to connect with family</p>
                            {presentDevices.length > 0 && (
                                <p className="waiting-text">
                                    {presentDevices.length} {presentDevices.length === 1 ? 'person' : 'people'} present
                                </p>
                            )}
                            <button
                                className="auth-button"
                                style={{ marginTop: '20px', width: 'auto' }}
                                onClick={() => {
                                    setManualConnect(true);
                                    handleMotionDetected(); // Also trigger motion state
                                }}
                            >
                                Connect Manually
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
