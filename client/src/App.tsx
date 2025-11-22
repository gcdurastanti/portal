import { useEffect, useRef, useState } from 'react';
import { useSignaling } from './hooks/useSignaling';
import { useMotionDetection } from './hooks/useMotionDetection';
import { useWebRTC } from './hooks/useWebRTC';
import { VideoGrid } from './components/VideoGrid';
import { StatusBar } from './components/StatusBar';
import './App.css';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const { isMotionActive } = useMotionDetection(
    videoRef,
    reportMotionDetected,
    reportMotionStopped
  );

  const { remoteStreams } = useWebRTC({
    localStream,
    participants: conferenceParticipants,
    sendMessage,
    registerMessageHandler
  });

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
