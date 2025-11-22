import { useEffect, useRef, useState } from 'react';
import { useSignaling } from './hooks/useSignaling';
import { useMotionDetection } from './hooks/useMotionDetection';
import { useWebRTC } from './hooks/useWebRTC';
import { VideoGrid } from './components/VideoGrid';
import { StatusBar } from './components/StatusBar';
import { playChime } from './utils/sound';
import { config } from './config';
import './App.css';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previousPresenceCount = useRef<number>(0);

  const {
    connected,
    presentDevices,
    isInConference,
    conferenceParticipants,
    sendMessage,
    registerMessageHandler,
    reportMotionDetected,
    reportMotionStopped
  } = useSignaling();

  const [isMuted, setIsMuted] = useState(false);
  const [motionTimeout, setMotionTimeout] = useState(config.motionTimeout);

  const { isMotionActive, isMotionEnabled, toggleMotion } = useMotionDetection(
    videoRef,
    reportMotionDetected,
    reportMotionStopped,
    motionTimeout
  );

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const { remoteStreams } = useWebRTC({
    localStream,
    participants: conferenceParticipants,
    sendMessage,
    registerMessageHandler
  });

  // Play chime when presence increases
  useEffect(() => {
    // Skip initial load or if count decreases/stays same
    if (presentDevices.length > previousPresenceCount.current && previousPresenceCount.current > 0) {
      playChime();
    }
    previousPresenceCount.current = presentDevices.length;
  }, [presentDevices.length]);

  // Initialize camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });

        setLocalStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Failed to access camera. Please check permissions.');
      }
    }

    setupCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (error) {
    return (
      <div className="error-screen">
        <h1>Camera Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <StatusBar
        connected={connected}
        isMotionActive={isMotionActive}
        isInConference={isInConference}
        presentDevices={presentDevices}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        isMotionEnabled={isMotionEnabled}
        onToggleMotion={toggleMotion}
        motionTimeout={motionTimeout}
        onSetMotionTimeout={setMotionTimeout}
      />

      {isInConference && (
        <VideoGrid
          localStream={localStream}
          remoteStreams={remoteStreams}
          showLocal={true}
        />
      )}

      <div className={`idle-view ${isInConference ? 'hidden' : ''}`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="preview-video"
        />
        {!isInConference && (
          <div className="idle-message">
            <h2>Waiting for connection...</h2>
            <p>Walk by your portal to connect with family</p>
            {presentDevices.length > 0 && (
              <p className="waiting-text">
                {presentDevices.length} {presentDevices.length === 1 ? 'person' : 'people'} present
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
