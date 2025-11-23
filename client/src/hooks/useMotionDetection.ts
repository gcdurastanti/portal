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

  // Advanced filtering state
  const motionHistoryRef = useRef<number[]>([]); // Track recent motion percentages
  const baselineRef = useRef<number[]>([]); // For adaptive thresholding
  const motionVelocityRef = useRef<number[]>([]); // Track rate of change

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

    const totalPixels = canvas.width * canvas.height;
    const motionPercentage = (diffCount / totalPixels) * 100;

    // === ADVANCED FILTERING ===

    // 1. Temporal Filtering: Track motion history
    motionHistoryRef.current.push(motionPercentage);
    if (motionHistoryRef.current.length > 5) {
      motionHistoryRef.current.shift(); // Keep last 5 frames
    }

    // 2. Adaptive Thresholding: Build baseline
    if (motionPercentage < 0.3) { // Only use low-motion frames for baseline
      baselineRef.current.push(motionPercentage);
      if (baselineRef.current.length > 30) {
        baselineRef.current.shift(); // Keep last 30 low-motion samples
      }
    }

    // Calculate adaptive threshold
    const baseline = baselineRef.current.length > 0
      ? baselineRef.current.reduce((a, b) => a + b, 0) / baselineRef.current.length
      : 0.2;

    const adaptiveThreshold = Math.max(0.5, baseline * 3); // At least 3x baseline, min 0.5%

    // 3. Motion Velocity Filtering: Track rate of change
    if (motionHistoryRef.current.length >= 2) {
      const velocity = Math.abs(
        motionHistoryRef.current[motionHistoryRef.current.length - 1] -
        motionHistoryRef.current[motionHistoryRef.current.length - 2]
      );
      motionVelocityRef.current.push(velocity);
      if (motionVelocityRef.current.length > 5) {
        motionVelocityRef.current.shift();
      }
    }

    // Calculate average velocity (human motion has consistent velocity changes)
    const avgVelocity = motionVelocityRef.current.length > 0
      ? motionVelocityRef.current.reduce((a, b) => a + b, 0) / motionVelocityRef.current.length
      : 0;

    // Temporal check: Need motion in at least 3 of last 5 frames
    const recentMotionCount = motionHistoryRef.current.filter(m => m > adaptiveThreshold).length;
    const hasTemporalMotion = recentMotionCount >= 3;

    // Velocity check: Human motion typically has velocity > 0.1%
    // Slow environmental changes like lighting have very low velocity
    const hasSignificantVelocity = avgVelocity > 0.1 || motionPercentage > adaptiveThreshold * 2;

    const isRealMotion = hasTemporalMotion && hasSignificantVelocity && motionPercentage > adaptiveThreshold;

    if (motionPercentage > 0.1) {
      console.debug(
        `Motion: ${motionPercentage.toFixed(2)}% | ` +
        `Baseline: ${baseline.toFixed(2)}% | ` +
        `Threshold: ${adaptiveThreshold.toFixed(2)}% | ` +
        `Temporal: ${recentMotionCount}/5 | ` +
        `Velocity: ${avgVelocity.toFixed(3)}% | ` +
        `Real: ${isRealMotion}`
      );
    }

    return isRealMotion;
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
