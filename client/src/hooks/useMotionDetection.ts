import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../config';

export function useMotionDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  onMotionDetected: () => void,
  onMotionStopped: () => void,
  timeoutDuration: number = config.motionTimeout
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameRef = useRef<ImageData | null>(null);
  const motionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMotionActive, setIsMotionActive] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  const lastCheckTimeRef = useRef<number>(0);

  const detectMotion = useCallback(() => {
    const now = Date.now();
    if (now - lastCheckTimeRef.current < 100) {
      return false;
    }
    lastCheckTimeRef.current = now;

    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
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

    // Consider motion detected if > 0.2% of pixels changed significantly
    // (Lowered slightly, but checking less frequently means we capture more change per check)
    const totalPixels = canvas.width * canvas.height;
    const motionPercentage = (diffCount / totalPixels) * 100;

    if (motionPercentage > 0) {
      console.debug(`Motion percentage: ${motionPercentage.toFixed(2)}%`);
    }

    return motionPercentage > 0.2;
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

      // Reset timeout - ALWAYS do this when motion is detected, 
      // so we respect the current timeoutDuration
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }

      motionTimeoutRef.current = setTimeout(() => {
        console.log('Motion stopped (timeout)');
        setIsMotionActive(false);
        onMotionStopped();
      }, timeoutDuration);
    } else if (isMotionActive && !motionTimeoutRef.current) {
      // Safety net: If we are active but have no timeout running (e.g. cleared by mistake or race condition),
      // start one now to ensure we eventually stop.
      motionTimeoutRef.current = setTimeout(() => {
        console.log('Motion stopped (safety timeout)');
        setIsMotionActive(false);
        onMotionStopped();
      }, timeoutDuration);
    }

    // Continue checking
    animationFrameRef.current = requestAnimationFrame(checkMotion);
  }, [detectMotion, isMotionActive, onMotionDetected, onMotionStopped, isMotionEnabled, timeoutDuration]);

  // Periodically refresh motion status if active
  useEffect(() => {
    if (!isMotionActive || !isMotionEnabled) return;

    const interval = setInterval(() => {
      // If we are still active (which we are, because isMotionActive is true),
      // we should re-trigger the motion detected event to refresh the server timeout
      console.log('Refreshing motion status (heartbeat)');
      onMotionDetected();

      // DO NOT reset the local timeout here. 
      // The local timeout should only be reset by checkMotion when ACTUAL motion is detected.
      // If we reset it here, we create an infinite loop where the heartbeat keeps the motion active forever.

    }, 10000); // Fixed heartbeat every 10s, independent of motion timeout

    return () => clearInterval(interval);
  }, [isMotionActive, onMotionDetected, onMotionStopped, isMotionEnabled, timeoutDuration]);

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
