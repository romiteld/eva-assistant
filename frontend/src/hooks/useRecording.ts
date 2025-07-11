import { useState, useCallback, useRef } from 'react';
import { RecordingOptions, RecordingState } from '@/types/webrtc';

interface UseRecordingProps {
  stream?: MediaStream | null;
  options?: RecordingOptions;
  onRecordingComplete?: (blob: Blob, mimeType: string) => void;
  onError?: (error: Error) => void;
}

interface UseRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingState: RecordingState;
  duration: number;
  error: Error | null;
  startRecording: (stream?: MediaStream, options?: RecordingOptions) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  downloadRecording: (blob: Blob, filename?: string) => void;
  getSupportedMimeTypes: () => string[];
}

export const useRecording = ({
  stream: defaultStream,
  options: defaultOptions,
  onRecordingComplete,
  onError,
}: UseRecordingProps = {}): UseRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.INACTIVE);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get supported MIME types
  const getSupportedMimeTypes = useCallback((): string[] => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
    ];

    return types.filter(type => MediaRecorder.isTypeSupported(type));
  }, []);

  // Get preferred MIME type
  const getPreferredMimeType = useCallback((options?: RecordingOptions): string => {
    if (options?.mimeType && MediaRecorder.isTypeSupported(options.mimeType)) {
      return options.mimeType;
    }

    const supportedTypes = getSupportedMimeTypes();
    
    // Prefer video formats if recording video
    if (options?.recordCamera || options?.recordScreen) {
      const videoTypes = supportedTypes.filter(type => type.startsWith('video/'));
      if (videoTypes.length > 0) return videoTypes[0];
    }

    // Otherwise use the first supported type
    return supportedTypes[0] || 'video/webm';
  }, [getSupportedMimeTypes]);

  // Start recording
  const startRecording = useCallback(async (
    stream?: MediaStream,
    options?: RecordingOptions
  ): Promise<void> => {
    const recordingStream = stream || defaultStream;
    if (!recordingStream) {
      const err = new Error('No media stream provided for recording');
      setError(err);
      onError?.(err);
      throw err;
    }

    if (isRecording) {
      console.warn('Recording is already in progress');
      return;
    }

    setError(null);

    try {
      // Merge options
      const recordingOptions = { ...defaultOptions, ...options };
      
      // Create composite stream if needed
      const compositeStream = new MediaStream();
      
      // Add tracks based on options
      recordingStream.getTracks().forEach(track => {
        if (track.kind === 'video' && (recordingOptions.recordCamera || recordingOptions.recordScreen)) {
          compositeStream.addTrack(track);
        } else if (track.kind === 'audio' && recordingOptions.recordAudio !== false) {
          compositeStream.addTrack(track);
        }
      });

      if (compositeStream.getTracks().length === 0) {
        throw new Error('No tracks available for recording');
      }

      // Create media recorder
      const mimeType = getPreferredMimeType(recordingOptions);
      const recorder = new MediaRecorder(compositeStream, {
        mimeType,
        videoBitsPerSecond: recordingOptions.videoBitsPerSecond,
        audioBitsPerSecond: recordingOptions.audioBitsPerSecond,
      });

      // Reset chunks
      chunksRef.current = [];

      // Set up event handlers
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        setRecordingState(RecordingState.RECORDING);
        startTimeRef.current = Date.now();
        
        // Start duration timer
        durationIntervalRef.current = setInterval(() => {
          setDuration(Date.now() - startTimeRef.current);
        }, 100);
      };

      recorder.onstop = () => {
        setIsRecording(false);
        setRecordingState(RecordingState.INACTIVE);
        
        // Stop duration timer
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        
        // Create blob and notify
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecordingComplete?.(blob, mimeType);
      };

      recorder.onerror = (event: any) => {
        const err = new Error(`Recording error: ${event.error}`);
        setError(err);
        onError?.(err);
      };

      recorder.onpause = () => {
        setIsPaused(true);
        setRecordingState(RecordingState.PAUSED);
      };

      recorder.onresume = () => {
        setIsPaused(false);
        setRecordingState(RecordingState.RECORDING);
      };

      mediaRecorderRef.current = recorder;
      
      // Start recording
      recorder.start(1000); // Collect data every second

    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [defaultStream, defaultOptions, isRecording, getPreferredMimeType, onRecordingComplete, onError]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || !isRecording) {
      console.warn('No active recording to stop');
      return null;
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!;
      const mimeType = recorder.mimeType;

      // Set up one-time stop handler
      recorder.onstop = () => {
        setIsRecording(false);
        setIsPaused(false);
        setRecordingState(RecordingState.INACTIVE);
        setDuration(0);
        
        // Stop duration timer
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        
        // Create blob
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecordingComplete?.(blob, mimeType);
        
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        
        resolve(blob);
      };

      recorder.stop();
    });
  }, [isRecording, onRecordingComplete]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
    }
  }, [isRecording, isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
    }
  }, [isRecording, isPaused]);

  // Download recording
  const downloadRecording = useCallback((blob: Blob, filename?: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    isRecording,
    isPaused,
    recordingState,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
    getSupportedMimeTypes,
  };
};