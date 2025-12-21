import { useEffect, useState, useRef, useCallback } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { useSignaling } from '../hooks/useSignaling';
import { useMotionDetection } from '../hooks/useMotionDetection';
import { useActiveGroup } from '../contexts/ActiveGroupContext';
import { config } from '../config';
import { api } from '../api/client';
import { StatusBar } from './StatusBar';

export function LiveKitPortal() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { activeGroupId } = useActiveGroup();
    const [token, setToken] = useState<string>("");
    const [isMotionActive, setIsMotionActive] = useState(false);
    const [motionTimeout, setMotionTimeout] = useState(config.motionTimeout);
    const [isMuted, setIsMuted] = useState(false);
    const [manualConnect, setManualConnect] = useState(false);

    const {
        connected: signalingConnected,
        presentDevices,
        reportMotionDetected,
        reportMotionStopped
    } = useSignaling(activeGroupId);

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
                }
            };
            fetchToken();
        }
    }, [isMotionActive, token, presentDevices.length, manualConnect]);

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
                </LiveKitRoom>
            ) : (
                <div className="idle-view">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="preview-video"
                    />
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
                </div>
            )}
        </div>
    );
}
