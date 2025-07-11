// WebRTC Event Types
export enum WebRTCEvent {
  // Signaling events
  OFFER = 'webrtc:offer',
  ANSWER = 'webrtc:answer',
  ICE_CANDIDATE = 'webrtc:ice-candidate',
  
  // Call events
  CALL_START = 'webrtc:call-start',
  CALL_END = 'webrtc:call-end',
  CALL_REJECT = 'webrtc:call-reject',
  CALL_ACCEPT = 'webrtc:call-accept',
  
  // Media events
  MEDIA_STREAM_ADD = 'webrtc:media-stream-add',
  MEDIA_STREAM_REMOVE = 'webrtc:media-stream-remove',
  MEDIA_TRACK_ENABLED = 'webrtc:media-track-enabled',
  MEDIA_TRACK_DISABLED = 'webrtc:media-track-disabled',
  
  // Screen share events
  SCREEN_SHARE_START = 'webrtc:screen-share-start',
  SCREEN_SHARE_END = 'webrtc:screen-share-end',
  
  // Recording events
  RECORDING_START = 'webrtc:recording-start',
  RECORDING_STOP = 'webrtc:recording-stop',
  RECORDING_PAUSE = 'webrtc:recording-pause',
  RECORDING_RESUME = 'webrtc:recording-resume',
  
  // Connection events
  PEER_CONNECTED = 'webrtc:peer-connected',
  PEER_DISCONNECTED = 'webrtc:peer-disconnected',
  CONNECTION_STATE_CHANGE = 'webrtc:connection-state-change',
  
  // Error events
  ERROR = 'webrtc:error',
  NEGOTIATION_NEEDED = 'webrtc:negotiation-needed',
}

// Connection States
export enum PeerConnectionState {
  NEW = 'new',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  CLOSED = 'closed',
}

// Media Types
export enum MediaType {
  CAMERA = 'camera',
  SCREEN = 'screen',
  AUDIO = 'audio',
}

// Call States
export enum CallState {
  IDLE = 'idle',
  CALLING = 'calling',
  RINGING = 'ringing',
  CONNECTED = 'connected',
  ENDED = 'ended',
  FAILED = 'failed',
}

// Recording States
export enum RecordingState {
  INACTIVE = 'inactive',
  RECORDING = 'recording',
  PAUSED = 'paused',
}

// Network Quality
export enum NetworkQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

// Participant Interface
export interface Participant {
  id: string;
  userId: string;
  name: string;
  email?: string;
  avatar?: string;
  streams: Map<string, MediaStream>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  connectionState: PeerConnectionState;
  networkQuality: NetworkQuality;
  speaking?: boolean;
  metadata?: Record<string, any>;
}

// Call Configuration
export interface CallConfig {
  roomId: string;
  userId: string;
  displayName: string;
  video?: boolean;
  audio?: boolean;
  maxParticipants?: number;
  enableRecording?: boolean;
  recordingOptions?: RecordingOptions;
  iceServers?: RTCIceServer[];
  mediaConstraints?: MediaStreamConstraints;
  codecPreferences?: CodecPreference[];
  simulcast?: boolean;
  adaptiveBitrate?: boolean;
}

// Recording Options
export interface RecordingOptions {
  mimeType?: string;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  recordScreen?: boolean;
  recordCamera?: boolean;
  recordAudio?: boolean;
}

// Codec Preferences
export interface CodecPreference {
  mimeType: string;
  sdpFmtpLine?: string;
  priority?: number;
}

// WebRTC Statistics
export interface WebRTCStats {
  timestamp: number;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  packetsLost: number;
  jitter?: number;
  roundTripTime?: number;
  availableOutgoingBitrate?: number;
  availableIncomingBitrate?: number;
  videoStats?: VideoStats;
  audioStats?: AudioStats;
}

// Video Statistics
export interface VideoStats {
  frameWidth: number;
  frameHeight: number;
  framesPerSecond: number;
  framesSent?: number;
  framesReceived?: number;
  framesDropped?: number;
  keyFramesSent?: number;
  keyFramesReceived?: number;
  bitrate: number;
}

// Audio Statistics
export interface AudioStats {
  audioLevel: number;
  totalAudioEnergy: number;
  voiceActivityFlag?: boolean;
  echoReturnLoss?: number;
  echoReturnLossEnhancement?: number;
  bitrate: number;
}

// Signaling Messages
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'bye';
  from: string;
  to: string;
  roomId: string;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
}

// Call Invitation
export interface CallInvitation {
  id: string;
  from: Participant;
  roomId: string;
  type: 'video' | 'audio';
  timestamp: Date;
  expiresAt: Date;
}

// Media Constraints
export interface EnhancedMediaConstraints extends MediaStreamConstraints {
  video?: boolean | VideoConstraints;
  audio?: boolean | AudioConstraints;
}

export interface VideoConstraints extends MediaTrackConstraints {
  width?: { min?: number; ideal?: number; max?: number };
  height?: { min?: number; ideal?: number; max?: number };
  frameRate?: { min?: number; ideal?: number; max?: number };
  facingMode?: 'user' | 'environment';
}

export interface AudioConstraints extends MediaTrackConstraints {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
  channelCount?: number;
}

// Screen Share Options
export interface ScreenShareOptions {
  video?: {
    displaySurface?: 'monitor' | 'window' | 'browser';
    logicalSurface?: boolean;
    cursor?: 'always' | 'motion' | 'never';
  };
  audio?: boolean | {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
  };
  selfBrowserSurface?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
  systemAudio?: 'include' | 'exclude';
}

// WebRTC Error Types
export interface WebRTCError extends Error {
  code: WebRTCErrorCode;
  details?: any;
}

export enum WebRTCErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  PEER_CONNECTION_FAILED = 'PEER_CONNECTION_FAILED',
  SIGNALING_ERROR = 'SIGNALING_ERROR',
  MEDIA_ERROR = 'MEDIA_ERROR',
  RECORDING_ERROR = 'RECORDING_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

// STUN/TURN Configuration
export interface IceServerConfig extends RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: 'password' | 'oauth';
}

// Default ICE Servers
export const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// Get ICE servers including TURN if configured
export const getIceServers = (): IceServerConfig[] => {
  const servers = [...DEFAULT_ICE_SERVERS];
  
  // Add TURN server if configured
  if (process.env.NEXT_PUBLIC_TURN_SERVER_URL) {
    servers.push({
      urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      credentialType: 'password',
    });
  }
  
  return servers;
};

// Media Device Info
export interface MediaDeviceInfo {
  deviceId: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
  label: string;
  groupId: string;
}

// Call Analytics
export interface CallAnalytics {
  callId: string;
  roomId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  participants: string[];
  maxParticipants: number;
  quality: {
    average: NetworkQuality;
    samples: Array<{
      timestamp: Date;
      quality: NetworkQuality;
      stats: WebRTCStats;
    }>;
  };
  errors: Array<{
    timestamp: Date;
    error: WebRTCError;
  }>;
  events: Array<{
    timestamp: Date;
    event: WebRTCEvent;
    data?: any;
  }>;
}