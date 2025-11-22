import React, { useEffect, useRef } from 'react';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  showLocal?: boolean;
}

export function VideoGrid({ localStream, remoteStreams, showLocal = true }: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const totalVideos = (showLocal ? 1 : 0) + remoteStreams.size;
  const gridClass = getGridClass(totalVideos);

  return (
    <div className={`video-grid ${gridClass}`}>
      {showLocal && localStream && (
        <div className="video-container local">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="video"
          />
          <div className="video-label">You</div>
        </div>
      )}

      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
        <RemoteVideo key={peerId} peerId={peerId} stream={stream} />
      ))}
    </div>
  );
}

function RemoteVideo({ peerId, stream }: { peerId: string; stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-container remote">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="video"
      />
      <div className="video-label">{peerId}</div>
    </div>
  );
}

function getGridClass(count: number): string {
  if (count === 1) return 'grid-1';
  if (count === 2) return 'grid-2';
  if (count <= 4) return 'grid-4';
  return 'grid-6';
}
