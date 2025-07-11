import { useState, useEffect, useCallback, useRef } from 'react';
import { WebRTCService } from '@/lib/services/webrtc';
import {
  CallConfig,
  CallState,
  NetworkQuality,
  Participant,
  WebRTCEvent,
  WebRTCError,
  RecordingState,
  ScreenShareOptions,
  RecordingOptions,
  MediaType,
} from '@/types/webrtc';

interface UseWebRTCProps extends CallConfig {
  onCallStateChange?: (state: CallState) => void;
  onParticipantJoin?: (participant: Participant) => void;
  onParticipantLeave?: (participant: Participant) => void;
  onError?: (error: WebRTCError) => void;
  onRecordingComplete?: (blob: Blob) => void;
}

interface UseWebRTCReturn {
  service: WebRTCService | null;
  localStream: MediaStream | null;
  participants: Participant[];
  callState: CallState;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  recordingState: RecordingState;
  networkQuality: NetworkQuality;
  error: WebRTCError | null;
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
  toggleAudio: (enabled?: boolean) => void;
  toggleVideo: (enabled?: boolean) => void;
  startScreenShare: (options?: ScreenShareOptions) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  startRecording: (options?: RecordingOptions) => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

export const useWebRTC = (props: UseWebRTCProps): UseWebRTCReturn => {
  const serviceRef = useRef<WebRTCService | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [callState, setCallState] = useState<CallState>(CallState.IDLE);
  const [isAudioEnabled, setIsAudioEnabled] = useState(props.audio ?? true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(props.video ?? true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.INACTIVE);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>(NetworkQuality.GOOD);
  const [error, setError] = useState<WebRTCError | null>(null);

  // Initialize WebRTC service
  const initialize = useCallback(async () => {
    if (serviceRef.current) return;

    try {
      setCallState(CallState.CALLING);
      setError(null);

      const service = new WebRTCService(props);
      serviceRef.current = service;

      // Setup event listeners
      service.on(WebRTCEvent.MEDIA_STREAM_ADD, ({ stream, type, local }) => {
        if (local && type === MediaType.CAMERA) {
          setLocalStream(stream);
        }
      });

      service.on(WebRTCEvent.PEER_CONNECTED, (participant: Participant) => {
        setParticipants(prev => [...prev, participant]);
        props.onParticipantJoin?.(participant);
      });

      service.on(WebRTCEvent.PEER_DISCONNECTED, (participant: Participant) => {
        setParticipants(prev => prev.filter(p => p.id !== participant.id));
        props.onParticipantLeave?.(participant);
      });

      service.on(WebRTCEvent.CONNECTION_STATE_CHANGE, ({ state }) => {
        if (state === 'connected' && callState !== CallState.CONNECTED) {
          setCallState(CallState.CONNECTED);
          props.onCallStateChange?.(CallState.CONNECTED);
        } else if (state === 'failed') {
          setCallState(CallState.FAILED);
          props.onCallStateChange?.(CallState.FAILED);
        }
      });

      service.on(WebRTCEvent.MEDIA_TRACK_ENABLED, ({ type, enabled }) => {
        if (type === 'audio') setIsAudioEnabled(enabled);
        if (type === 'video') setIsVideoEnabled(enabled);
      });

      service.on(WebRTCEvent.MEDIA_TRACK_DISABLED, ({ type, enabled }) => {
        if (type === 'audio') setIsAudioEnabled(enabled);
        if (type === 'video') setIsVideoEnabled(enabled);
      });

      service.on(WebRTCEvent.SCREEN_SHARE_START, () => {
        setIsScreenSharing(true);
      });

      service.on(WebRTCEvent.SCREEN_SHARE_END, () => {
        setIsScreenSharing(false);
      });

      service.on(WebRTCEvent.RECORDING_START, () => {
        setIsRecording(true);
        setRecordingState(RecordingState.RECORDING);
      });

      service.on(WebRTCEvent.RECORDING_STOP, ({ blob }) => {
        setIsRecording(false);
        setRecordingState(RecordingState.INACTIVE);
        props.onRecordingComplete?.(blob);
      });

      service.on(WebRTCEvent.RECORDING_PAUSE, () => {
        setRecordingState(RecordingState.PAUSED);
      });

      service.on(WebRTCEvent.RECORDING_RESUME, () => {
        setRecordingState(RecordingState.RECORDING);
      });

      service.on(WebRTCEvent.ERROR, (error: WebRTCError) => {
        setError(error);
        props.onError?.(error);
      });

      service.on('stats', ({ participantId, stats }) => {
        // Update network quality based on stats
        if (participantId === props.userId) {
          // Simple quality calculation based on packet loss
          const packetLossRate = stats.packetsReceived > 0 
            ? stats.packetsLost / (stats.packetsReceived + stats.packetsLost) 
            : 0;
          
          if (packetLossRate < 0.01) {
            setNetworkQuality(NetworkQuality.EXCELLENT);
          } else if (packetLossRate < 0.03) {
            setNetworkQuality(NetworkQuality.GOOD);
          } else if (packetLossRate < 0.05) {
            setNetworkQuality(NetworkQuality.FAIR);
          } else if (packetLossRate < 0.1) {
            setNetworkQuality(NetworkQuality.POOR);
          } else {
            setNetworkQuality(NetworkQuality.CRITICAL);
          }
        }
      });

      // Initialize the service
      await service.initialize();

      setCallState(CallState.CONNECTED);
      props.onCallStateChange?.(CallState.CONNECTED);

    } catch (error) {
      setError(error as WebRTCError);
      setCallState(CallState.FAILED);
      props.onError?.(error as WebRTCError);
      props.onCallStateChange?.(CallState.FAILED);
    }
  }, [props, callState]);

  // Cleanup
  const cleanup = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.cleanup();
      serviceRef.current = null;
      setLocalStream(null);
      setParticipants([]);
      setCallState(CallState.ENDED);
      setIsScreenSharing(false);
      setIsRecording(false);
      setRecordingState(RecordingState.INACTIVE);
      props.onCallStateChange?.(CallState.ENDED);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, [props]);

  // Media controls
  const toggleAudio = useCallback((enabled?: boolean) => {
    serviceRef.current?.toggleAudio(enabled);
  }, []);

  const toggleVideo = useCallback((enabled?: boolean) => {
    serviceRef.current?.toggleVideo(enabled);
  }, []);

  // Screen sharing
  const startScreenShare = useCallback(async (options?: ScreenShareOptions) => {
    if (!serviceRef.current) return;
    await serviceRef.current.startScreenShare(options);
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!serviceRef.current) return;
    await serviceRef.current.stopScreenShare();
  }, []);

  // Recording
  const startRecording = useCallback(async (options?: RecordingOptions) => {
    if (!serviceRef.current) return;
    await serviceRef.current.startRecording(options);
  }, []);

  const stopRecording = useCallback(() => {
    serviceRef.current?.stopRecording();
  }, []);

  const pauseRecording = useCallback(() => {
    serviceRef.current?.pauseRecording();
  }, []);

  const resumeRecording = useCallback(() => {
    serviceRef.current?.resumeRecording();
  }, []);

  // Update participants when service changes
  useEffect(() => {
    if (serviceRef.current) {
      setParticipants(serviceRef.current.getParticipants());
    }
  }, []);

  return {
    service: serviceRef.current,
    localStream,
    participants,
    callState,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    isRecording,
    recordingState,
    networkQuality,
    error,
    initialize,
    cleanup,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
};