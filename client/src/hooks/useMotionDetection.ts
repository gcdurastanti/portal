import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../config';

export function useMotionDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  onMotionDetected: () => void,
  onMotionStopped: () => void
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameRef = useRef<ImageData | null>(null);
  const motionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMotionActive, setIsMotionActive] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  const detectMotion = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      if (video && video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.debug(`Video not ready: ${video.readyState}`);
      }
      return false;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 320;
      canvasRef.current.height = 240;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (!previousFrameRef.current) {
      previousFrameRef.current = currentFrame;
      return false;
    }

    // Calculate difference
    let diffCount = 0;
    const threshold = config.motionThreshold;

    for (let i = 0; i < currentFrame.data.length; i += 4) {
      const rDiff = Math.abs(currentFrame.data[i] - previousFrameRef.current.data[i]);
      const gDiff = Math.abs(currentFrame.data[i + 1] - previousFrameRef.current.data[i + 1]);
      const bDiff = Math.abs(currentFrame.data[i + 2] - previousFrameRef.current.data[i + 2]);

      const avgDiff = (rDiff + gDiff + bDiff) / 3;

      if (avgDiff > threshold) {
        diffCount++;
      }
    }

    previousFrameRef.current = currentFrame;

    // Consider motion detected if > 0.1% of pixels changed significantly
    const totalPixels = canvas.width * canvas.height;
    const motionPercentage = (diffCount / totalPixels) * 100;

    if (motionPercentage > 0) {
      console.debug(`Motion percentage: ${motionPercentage.toFixed(2)}%`);
    }

    return motionPercentage > 0.1;
  }, [videoRef]);

  const [isMotionEnabled, setIsMotionEnabled] = useState(true);

  const toggleMotion = useCallback(() => {
    setIsMotionEnabled(prev => !prev);
    if (isMotionEnabled) {
      // If disabling, ensure we stop any active motion
      setIsMotionActive(false);
      onMotionStopped();
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }
    }
  }, [isMotionEnabled, onMotionStopped]);

  const checkMotion = useCallback(() => {
    if (!isMotionEnabled) {
      animationFrameRef.current = requestAnimationFrame(checkMotion);
      return;
    }

    const motionDetected = detectMotion();

    if (motionDetected) {
      if (!isMotionActive) {
        console.log('Motion detected');
        setIsMotionActive(true);
        onMotionDetected();
      }

      // Reset timeout
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }

      motionTimeoutRef.current = setTimeout(() => {
        console.log('Motion stopped (timeout)');
        setIsMotionActive(false);
        onMotionStopped();
      }, config.motionTimeout);
    }

    // Continue checking
    animationFrameRef.current = requestAnimationFrame(checkMotion);
  }, [detectMotion, isMotionActive, onMotionDetected, onMotionStopped, isMotionEnabled]);

  // Periodically refresh motion status if active
  useEffect(() => {
    if (!isMotionActive || !isMotionEnabled) return;

    const interval = setInterval(() => {
      // If we are still active (which we are, because isMotionActive is true),
      // we should re-trigger the motion detected event to refresh the server timeout
      console.log('Refreshing motion status');
      onMotionDetected();

      // Also reset the local timeout
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }
      motionTimeoutRef.current = setTimeout(() => {
        console.log('Motion stopped (timeout)');
        setIsMotionActive(false);
        onMotionStopped();
      }, config.motionTimeout);

    }, config.motionTimeout / 2); // Refresh halfway through timeout

    return () => clearInterval(interval);
  }, [isMotionActive, onMotionDetected, onMotionStopped, isMotionEnabled]);

  useEffect(() => {
    // Start motion detection
    animationFrameRef.current = requestAnimationFrame(checkMotion);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }
    };
  }, [checkMotion]);

  return { isMotionActive, isMotionEnabled, toggleMotion };
}
