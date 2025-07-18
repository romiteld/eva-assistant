// Enhanced WebRTC Audio Hook for Voice Agent
// Provides comprehensive audio management with real-time processing

import { useState, useEffect, useCallback, useRef } from 'react';
import { WebRTCAudioManager, AudioEvent, AudioMetrics, WebRTCAudioConfig } from '@/lib/audio/webrtc-audio-manager';
import { useToast } from '@/hooks/use-toast';

export interface UseWebRTCAudioOptions extends WebRTCAudioConfig {
  autoCalibrate?: boolean;
  calibrationDuration?: number;
  onPermissionGranted?: () => void;
  onPermissionDenied?: (error: Error) => void;
  onAudioData?: (data: Int16Array) => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface UseWebRTCAudioReturn {
  // State
  isInitialized: boolean;
  isCapturing: boolean;
  isPlaying: boolean;
  hasPermission: boolean;
  isCalibrating: boolean;
  error: Error | null;
  
  // Metrics
  metrics: AudioMetrics;
  frequencyData: Uint8Array | null;
  waveformData: Uint8Array | null;
  
  // Actions
  initialize: () => Promise<void>;
  startCapture: (callback?: (data: Int16Array) => void) => void;
  stopCapture: () => void;
  playBase64Audio: (base64Audio: string) => Promise<void>;
  setInputGain: (gain: number) => void;
  setOutputGain: (gain: number) => void;
  calibrateNoise: (duration?: number) => Promise<void>;
  updateConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
  
  // Utils
  dispose: () => void;
  checkPermission: () => Promise<boolean>;
  getSupportedConstraints: () => MediaTrackSupportedConstraints;
}

export function useWebRTCAudio(options: UseWebRTCAudioOptions = {}): UseWebRTCAudioReturn {
  const { toast } = useToast();
  const managerRef = useRef<WebRTCAudioManager | null>(null);
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Metrics and visualization
  const [metrics, setMetrics] = useState<AudioMetrics>({
    inputLevel: 0,
    outputLevel: 0,
    noiseLevel: 0,
    voiceActivity: false,
    latency: 0,
    packetsLost: 0,
    jitter: 0,
  });
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const [waveformData, setWaveformData] = useState<Uint8Array | null>(null);
  
  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef({
    onPermissionGranted: options.onPermissionGranted,
    onPermissionDenied: options.onPermissionDenied,
    onAudioData: options.onAudioData,
    onVoiceStart: options.onVoiceStart,
    onVoiceEnd: options.onVoiceEnd,
    onError: options.onError,
  });
  
  useEffect(() => {
    callbacksRef.current = {
      onPermissionGranted: options.onPermissionGranted,
      onPermissionDenied: options.onPermissionDenied,
      onAudioData: options.onAudioData,
      onVoiceStart: options.onVoiceStart,
      onVoiceEnd: options.onVoiceEnd,
      onError: options.onError,
    };
  }, [options]);
  
  // Initialize audio manager
  const initialize = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      
      // Create manager if not exists
      if (!managerRef.current) {
        managerRef.current = new WebRTCAudioManager(options);
        
        // Setup event listeners
        managerRef.current.on(AudioEvent.PERMISSION_GRANTED, () => {
          setHasPermission(true);
          callbacksRef.current.onPermissionGranted?.();
        });
        
        managerRef.current.on(AudioEvent.PERMISSION_DENIED, (error: Error) => {
          setHasPermission(false);
          setError(error);
          callbacksRef.current.onPermissionDenied?.(error);
          
          toast({
            title: 'Microphone Access Denied',
            description: 'Please allow microphone access to use voice features.',
            variant: 'destructive',
          });
        });
        
        managerRef.current.on(AudioEvent.STREAM_READY, () => {
          setIsInitialized(true);
          
          toast({
            title: 'Audio Ready',
            description: 'Microphone is connected and ready.',
          });
        });
        
        managerRef.current.on(AudioEvent.STREAM_ERROR, (error: Error) => {
          setError(error);
          callbacksRef.current.onError?.(error);
          
          toast({
            title: 'Audio Error',
            description: error.message,
            variant: 'destructive',
          });
        });
        
        managerRef.current.on(AudioEvent.AUDIO_DATA, (data: Int16Array) => {
          callbacksRef.current.onAudioData?.(data);
        });
        
        managerRef.current.on(AudioEvent.VOICE_START, () => {
          callbacksRef.current.onVoiceStart?.();
        });
        
        managerRef.current.on(AudioEvent.VOICE_END, () => {
          callbacksRef.current.onVoiceEnd?.();
        });
        
        managerRef.current.on(AudioEvent.PLAYBACK_START, () => {
          setIsPlaying(true);
        });
        
        managerRef.current.on(AudioEvent.PLAYBACK_END, () => {
          setIsPlaying(false);
        });
        
        managerRef.current.on(AudioEvent.METRICS_UPDATE, (newMetrics: AudioMetrics) => {
          setMetrics(newMetrics);
        });
      }
      
      // Initialize the manager
      await managerRef.current.initialize();
      
      // Auto-calibrate if enabled
      if (options.autoCalibrate) {
        await calibrateNoise(options.calibrationDuration);
      }
      
    } catch (error) {
      const errorObj = error as Error;
      setError(errorObj);
      callbacksRef.current.onError?.(errorObj);
      throw error;
    }
  }, [options, toast]);
  
  // Start audio capture
  const startCapture = useCallback((callback?: (data: Int16Array) => void) => {
    if (!managerRef.current || !isInitialized) {
      throw new Error('Audio not initialized');
    }
    
    try {
      const captureCallback = callback || callbacksRef.current.onAudioData;
      if (captureCallback) {
        managerRef.current.startCapture(captureCallback);
        setIsCapturing(true);
      }
    } catch (error) {
      const errorObj = error as Error;
      setError(errorObj);
      callbacksRef.current.onError?.(errorObj);
    }
  }, [isInitialized]);
  
  // Stop audio capture
  const stopCapture = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.stopCapture();
      setIsCapturing(false);
    }
  }, []);
  
  // Play audio from base64
  const playBase64Audio = useCallback(async (base64Audio: string): Promise<void> => {
    if (!managerRef.current || !isInitialized) {
      throw new Error('Audio not initialized');
    }
    
    try {
      await managerRef.current.playBase64Audio(base64Audio);
    } catch (error) {
      const errorObj = error as Error;
      setError(errorObj);
      callbacksRef.current.onError?.(errorObj);
      throw error;
    }
  }, [isInitialized]);
  
  // Set input gain
  const setInputGain = useCallback((gain: number) => {
    if (managerRef.current) {
      managerRef.current.setInputGain(gain);
    }
  }, []);
  
  // Set output gain
  const setOutputGain = useCallback((gain: number) => {
    if (managerRef.current) {
      managerRef.current.setOutputGain(gain);
    }
  }, []);
  
  // Calibrate noise level
  const calibrateNoise = useCallback(async (duration = 2000): Promise<void> => {
    if (!managerRef.current || !isInitialized) {
      throw new Error('Audio not initialized');
    }
    
    try {
      setIsCalibrating(true);
      
      toast({
        title: 'Calibrating Audio',
        description: 'Please remain quiet for a moment...',
      });
      
      await managerRef.current.calibrateNoiseLevel(duration);
      
      toast({
        title: 'Calibration Complete',
        description: 'Audio noise level has been calibrated.',
      });
    } catch (error) {
      const errorObj = error as Error;
      setError(errorObj);
      callbacksRef.current.onError?.(errorObj);
      
      toast({
        title: 'Calibration Failed',
        description: errorObj.message,
        variant: 'destructive',
      });
    } finally {
      setIsCalibrating(false);
    }
  }, [isInitialized, toast]);
  
  // Update audio constraints
  const updateConstraints = useCallback(async (constraints: MediaTrackConstraints): Promise<void> => {
    if (!managerRef.current || !isInitialized) {
      throw new Error('Audio not initialized');
    }
    
    try {
      await managerRef.current.updateConstraints(constraints);
      
      toast({
        title: 'Audio Settings Updated',
        description: 'Audio constraints have been applied.',
      });
    } catch (error) {
      const errorObj = error as Error;
      setError(errorObj);
      callbacksRef.current.onError?.(errorObj);
      
      toast({
        title: 'Failed to Update Settings',
        description: errorObj.message,
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [isInitialized, toast]);
  
  // Check permission
  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (managerRef.current) {
      return await managerRef.current.checkPermission();
    }
    return false;
  }, []);
  
  // Get supported constraints
  const getSupportedConstraints = useCallback((): MediaTrackSupportedConstraints => {
    if (managerRef.current) {
      return managerRef.current.getSupportedConstraints();
    }
    return {};
  }, []);
  
  // Dispose resources
  const dispose = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.dispose();
      managerRef.current = null;
    }
    
    setIsInitialized(false);
    setIsCapturing(false);
    setIsPlaying(false);
    setHasPermission(false);
    setIsCalibrating(false);
    setError(null);
    setFrequencyData(null);
    setWaveformData(null);
  }, []);
  
  // Update visualization data
  useEffect(() => {
    if (!managerRef.current || !isInitialized) {
      return;
    }
    
    const updateVisualization = () => {
      if (managerRef.current) {
        setFrequencyData(managerRef.current.getFrequencyData());
        setWaveformData(managerRef.current.getWaveformData());
      }
      
      if (isCapturing || isPlaying) {
        requestAnimationFrame(updateVisualization);
      }
    };
    
    if (isCapturing || isPlaying) {
      updateVisualization();
    }
  }, [isInitialized, isCapturing, isPlaying]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);
  
  return {
    // State
    isInitialized,
    isCapturing,
    isPlaying,
    hasPermission,
    isCalibrating,
    error,
    
    // Metrics
    metrics,
    frequencyData,
    waveformData,
    
    // Actions
    initialize,
    startCapture,
    stopCapture,
    playBase64Audio,
    setInputGain,
    setOutputGain,
    calibrateNoise,
    updateConstraints,
    
    // Utils
    dispose,
    checkPermission,
    getSupportedConstraints,
  };
}