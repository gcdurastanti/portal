import { useEffect, useState, useRef } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { useSignaling } from '../hooks/useSignaling';
import { useMotionDetection } from '../hooks/useMotionDetection';
import { config } from '../config';
import { StatusBar } from './StatusBar';

export function LiveKitPortal() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [token, setToken] = useState<string>("");
    const [isMotionActive, setIsMotionActive] = useState(false);

    const {
        connected: signalingConnected,
        presentDevices,
        reportMotionDetected,
        reportMotionStopped
    } = useSignaling();

    // We need to keep track of motion to trigger room entry/exit
    // We can wrap the original useMotionDetection or just use it and react to its state
    const handleMotionDetected = () => {
        setIsMotionActive(true);
        reportMotionDetected();
    };

    const handleMotionStopped = () => {
        setIsMotionActive(false);
        setToken(""); // Disconnect
        reportMotionStopped();
    };

    const { isMotionEnabled, toggleMotion } = useMotionDetection(
        videoRef,
        handleMotionDetected,
        handleMotionStopped,
        config.motionTimeout
    );

    useEffect(() => {
        if (isMotionActive && !token) {
            const fetchToken = async () => {
                try {
                    const response = await fetch('/api/livekit/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomName: config.groupId,
                            participantName: config.deviceName,
                            identity: config.deviceId,
                        }),
                    });
                    const data = await response.json();
                    setToken(data.token);
                } catch (error) {
                    console.error('Failed to fetch LiveKit token:', error);
                }
            };
            fetchToken();
        }
    }, [isMotionActive, token]);

    return (
        <div className="app">
            <StatusBar
                connected={signalingConnected}
                isMotionActive={isMotionActive}
                isInConference={!!token}
                presentDevices={presentDevices}
                isMuted={false} // TODO: Implement mute
                onToggleMute={() => { }}
                isMotionEnabled={isMotionEnabled}
                onToggleMotion={toggleMotion}
                motionTimeout={config.motionTimeout}
                onSetMotionTimeout={() => { }}
            />

            {token ? (
                <LiveKitRoom
                    video={true}
                    audio={true}
                    token={token}
                    serverUrl={import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880"}
                    data-lk-theme="default"
                    style={{ height: '100vh' }}
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
                    </div>
                </div>
            )}
        </div>
    );
}
