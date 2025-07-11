import { useState, useCallback, useRef } from 'react';
import { ScreenShareOptions } from '@/types/webrtc';

interface UseScreenShareProps {
  onStreamReady?: (stream: MediaStream) => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
  defaultOptions?: ScreenShareOptions;
}

interface UseScreenShareReturn {
  stream: MediaStream | null;
  isSharing: boolean;
  error: Error | null;
  startScreenShare: (options?: ScreenShareOptions) => Promise<MediaStream | null>;
  stopScreenShare: () => void;
  isSupported: boolean;
}

export const useScreenShare = ({
  onStreamReady,
  onStreamEnd,
  onError,
  defaultOptions,
}: UseScreenShareProps = {}): UseScreenShareReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if screen sharing is supported
  const isSupported = typeof navigator !== 'undefined' && 
    'mediaDevices' in navigator && 
    'getDisplayMedia' in navigator.mediaDevices;

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
      setStream(null);
      setIsSharing(false);
      onStreamEnd?.();
    }
  }, [onStreamEnd]);

  // Start screen sharing
  const startScreenShare = useCallback(async (
    options?: ScreenShareOptions
  ): Promise<MediaStream | null> => {
    if (!isSupported) {
      const err = new Error('Screen sharing is not supported in this browser');
      setError(err);
      onError?.(err);
      return null;
    }

    if (isSharing) {
      console.warn('Screen sharing is already active');
      return streamRef.current;
    }

    setError(null);

    try {
      // Merge with default options
      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: options?.video || defaultOptions?.video || true,
        audio: options?.audio || defaultOptions?.audio || false,
        // Additional options for better quality
        ...(typeof options?.video === 'object' && {
          video: {
            ...options.video,
            // Set reasonable defaults for quality
            frameRate: (options.video as any).frameRate || { ideal: 30, max: 60 },
            width: (options.video as any).width || { ideal: 1920, max: 3840 },
            height: (options.video as any).height || { ideal: 1080, max: 2160 },
          },
        }),
      };

      const newStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      
      // Handle stream ended event
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      streamRef.current = newStream;
      setStream(newStream);
      setIsSharing(true);
      onStreamReady?.(newStream);

      return newStream;
    } catch (err) {
      const error = err as Error;
      
      // Handle specific errors
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        const userError = new Error('Permission denied. User cancelled the screen share dialog.');
        setError(userError);
        onError?.(userError);
      } else if (error.name === 'NotFoundError') {
        const notFoundError = new Error('No screen sharing sources available.');
        setError(notFoundError);
        onError?.(notFoundError);
      } else if (error.name === 'NotReadableError') {
        const readError = new Error('Screen sharing source is not readable. It may be in use by another application.');
        setError(readError);
        onError?.(readError);
      } else {
        setError(error);
        onError?.(error);
      }

      return null;
    }
  }, [isSupported, isSharing, defaultOptions, onStreamReady, onError, stopScreenShare]);

  return {
    stream,
    isSharing,
    error,
    startScreenShare,
    stopScreenShare,
    isSupported,
  };
};