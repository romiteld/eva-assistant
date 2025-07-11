import { EventEmitter } from 'events';
import {
  WebRTCEvent,
  PeerConnectionState,
  NetworkQuality,
  CallConfig,
  Participant,
  WebRTCStats,
  WebRTCError,
  WebRTCErrorCode,
  SignalingMessage,
  IceServerConfig,
  getIceServers,
  MediaType,
  ScreenShareOptions,
  RecordingOptions,
  RecordingState,
} from '@/types/webrtc';
import { supabase } from '@/lib/supabase/browser';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PeerConnection {
  pc: RTCPeerConnection;
  participant: Participant;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
}

export class WebRTCService extends EventEmitter {
  private connections: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private config: CallConfig;
  private channel: RealtimeChannel | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private recordingStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingState: RecordingState = RecordingState.INACTIVE;

  constructor(config: CallConfig) {
    super();
    this.config = {
      ...config,
      iceServers: config.iceServers || getIceServers(),
      mediaConstraints: config.mediaConstraints || this.getDefaultMediaConstraints(config),
    };
    this.setupSignaling();
  }

  // Initialize WebRTC
  async initialize(): Promise<void> {
    try {
      // Get user media
      if (this.config.video || this.config.audio) {
        this.localStream = await this.getUserMedia(this.config.mediaConstraints!);
        this.emit(WebRTCEvent.MEDIA_STREAM_ADD, {
          stream: this.localStream,
          type: MediaType.CAMERA,
          local: true,
        });
      }

      // Start monitoring stats
      this.startStatsMonitoring();

      // Create Supabase broadcast channel for the room
      this.channel = supabase.channel(`webrtc:${this.config.roomId}`, {
        config: {
          broadcast: {
            self: false, // Don't receive own messages
            ack: true,   // Acknowledge message receipt
          },
        },
      });
      
      // Subscribe to the channel
      await new Promise<void>((resolve, reject) => {
        this.channel!
          .on('broadcast', { event: '*' }, (payload) => {
            this.handleBroadcastMessage(payload);
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              resolve();
            } else if (status === 'CHANNEL_ERROR') {
              reject(new Error('Failed to subscribe to channel'));
            }
          });
      });

      // Notify others that we're ready
      this.broadcastMessage(WebRTCEvent.CALL_START, {
        participant: this.getLocalParticipant(),
      });

    } catch (error) {
      this.handleError(error as Error, WebRTCErrorCode.MEDIA_ERROR);
      throw error;
    }
  }

  // Create peer connection
  private createPeerConnection(participantId: string, polite: boolean): PeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 10,
    });

    const participant: Participant = {
      id: participantId,
      userId: participantId,
      name: 'Unknown',
      streams: new Map(),
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
      connectionState: PeerConnectionState.NEW,
      networkQuality: NetworkQuality.GOOD,
    };

    const connection: PeerConnection = {
      pc,
      participant,
      polite,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
    };

    // Setup event handlers
    this.setupPeerConnectionHandlers(connection);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    this.connections.set(participantId, connection);
    return connection;
  }

  // Setup peer connection event handlers
  private setupPeerConnectionHandlers(connection: PeerConnection): void {
    const { pc, participant } = connection;

    // Handle negotiation needed
    pc.onnegotiationneeded = async () => {
      try {
        connection.makingOffer = true;
        await pc.setLocalDescription();
        
        this.sendSignalingMessage({
          type: 'offer',
          from: this.config.userId,
          to: participant.id,
          roomId: this.config.roomId,
          data: pc.localDescription!,
        });
      } catch (error) {
        this.handleError(error as Error, WebRTCErrorCode.PEER_CONNECTION_FAILED);
      } finally {
        connection.makingOffer = false;
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          from: this.config.userId,
          to: participant.id,
          roomId: this.config.roomId,
          data: candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      participant.connectionState = this.mapConnectionState(state);
      
      this.emit(WebRTCEvent.CONNECTION_STATE_CHANGE, {
        participantId: participant.id,
        state: participant.connectionState,
      });

      if (state === 'connected') {
        this.emit(WebRTCEvent.PEER_CONNECTED, participant);
      } else if (state === 'failed' || state === 'closed') {
        this.emit(WebRTCEvent.PEER_DISCONNECTED, participant);
        this.removePeerConnection(participant.id);
      }
    };

    // Handle remote tracks
    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0];
      if (stream) {
        participant.streams.set(stream.id, stream);
        
        // Determine track type
        const type = track.kind === 'video' && stream.id.includes('screen') 
          ? MediaType.SCREEN 
          : MediaType.CAMERA;

        this.emit(WebRTCEvent.MEDIA_STREAM_ADD, {
          stream,
          type,
          participant,
          local: false,
        });

        // Handle track ended
        track.onended = () => {
          participant.streams.delete(stream.id);
          this.emit(WebRTCEvent.MEDIA_STREAM_REMOVE, {
            streamId: stream.id,
            participant,
          });
        };
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };
  }

  // Setup signaling
  private setupSignaling(): void {
    // This is now handled in handleBroadcastMessage
  }

  // Handle broadcast messages from Supabase
  private handleBroadcastMessage(payload: any): void {
    const { event, payload: data } = payload;

    switch (event) {
      case WebRTCEvent.OFFER:
        if (data.to === this.config.userId) {
          this.handleOffer(data);
        }
        break;

      case WebRTCEvent.ANSWER:
        if (data.to === this.config.userId) {
          this.handleAnswer(data);
        }
        break;

      case WebRTCEvent.ICE_CANDIDATE:
        if (data.to === this.config.userId) {
          this.handleIceCandidate(data);
        }
        break;

      case WebRTCEvent.CALL_START:
        if (data.participant.id !== this.config.userId) {
          // Create connection as polite peer
          const connection = this.createPeerConnection(data.participant.id, true);
          connection.participant = { ...connection.participant, ...data.participant };
        }
        break;

      case WebRTCEvent.CALL_END:
        if (data.participantId && data.participantId !== this.config.userId) {
          this.removePeerConnection(data.participantId);
        }
        break;

      case WebRTCEvent.SCREEN_SHARE_START:
        if (data.participantId !== this.config.userId) {
          this.emit(WebRTCEvent.SCREEN_SHARE_START, data);
        }
        break;

      case WebRTCEvent.SCREEN_SHARE_END:
        if (data.participantId !== this.config.userId) {
          this.emit(WebRTCEvent.SCREEN_SHARE_END, data);
        }
        break;
    }
  }

  // Broadcast message to channel
  private async broadcastMessage(event: string, data: any): Promise<void> {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event,
      payload: data,
    });
  }

  // Handle offer
  private async handleOffer(message: SignalingMessage): Promise<void> {
    let connection = this.connections.get(message.from);
    
    if (!connection) {
      // Create new connection as impolite peer
      connection = this.createPeerConnection(message.from, false);
    }

    const { pc, polite } = connection;
    const offerCollision = message.type === 'offer' && 
      (connection.makingOffer || pc.signalingState !== 'stable');

    connection.ignoreOffer = !polite && offerCollision;
    
    if (connection.ignoreOffer) {
      return;
    }

    try {
      await pc.setRemoteDescription(message.data as RTCSessionDescriptionInit);
      
      if (message.type === 'offer') {
        await pc.setLocalDescription();
        
        this.sendSignalingMessage({
          type: 'answer',
          from: this.config.userId,
          to: message.from,
          roomId: this.config.roomId,
          data: pc.localDescription!,
        });
      }
    } catch (error) {
      this.handleError(error as Error, WebRTCErrorCode.SIGNALING_ERROR);
    }
  }

  // Handle answer
  private async handleAnswer(message: SignalingMessage): Promise<void> {
    const connection = this.connections.get(message.from);
    if (!connection) return;

    try {
      await connection.pc.setRemoteDescription(message.data as RTCSessionDescriptionInit);
    } catch (error) {
      this.handleError(error as Error, WebRTCErrorCode.SIGNALING_ERROR);
    }
  }

  // Handle ICE candidate
  private async handleIceCandidate(message: SignalingMessage): Promise<void> {
    const connection = this.connections.get(message.from);
    if (!connection) return;

    try {
      await connection.pc.addIceCandidate(message.data as RTCIceCandidateInit);
    } catch (error) {
      if (!connection.ignoreOffer) {
        this.handleError(error as Error, WebRTCErrorCode.PEER_CONNECTION_FAILED);
      }
    }
  }

  // Send signaling message
  private sendSignalingMessage(message: SignalingMessage): void {
    const event = message.type === 'offer' ? WebRTCEvent.OFFER :
                  message.type === 'answer' ? WebRTCEvent.ANSWER :
                  WebRTCEvent.ICE_CANDIDATE;
    
    this.broadcastMessage(event, message);
  }

  // Get user media
  private async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      const e = error as Error;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        throw this.createError('Permission denied to access media devices', WebRTCErrorCode.PERMISSION_DENIED);
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        throw this.createError('No media devices found', WebRTCErrorCode.DEVICE_NOT_FOUND);
      }
      throw this.createError(e.message, WebRTCErrorCode.MEDIA_ERROR);
    }
  }

  // Toggle media track
  toggleAudio(enabled?: boolean): void {
    if (!this.localStream) return;

    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = enabled !== undefined ? enabled : !track.enabled;
    });

    const isEnabled = audioTracks[0]?.enabled || false;
    const event = isEnabled ? WebRTCEvent.MEDIA_TRACK_ENABLED : WebRTCEvent.MEDIA_TRACK_DISABLED;
    this.emit(event, { type: 'audio', enabled: isEnabled });
  }

  toggleVideo(enabled?: boolean): void {
    if (!this.localStream) return;

    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = enabled !== undefined ? enabled : !track.enabled;
    });

    const isEnabled = videoTracks[0]?.enabled || false;
    const event = isEnabled ? WebRTCEvent.MEDIA_TRACK_ENABLED : WebRTCEvent.MEDIA_TRACK_DISABLED;
    this.emit(event, { type: 'video', enabled: isEnabled });
  }

  // Screen sharing
  async startScreenShare(options?: ScreenShareOptions): Promise<void> {
    try {
      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: options?.video || true,
        audio: options?.audio || false,
      };

      this.screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      
      // Replace video track in all connections
      const screenTrack = this.screenStream.getVideoTracks()[0];
      
      this.connections.forEach(connection => {
        const sender = connection.pc.getSenders().find(
          s => s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // Handle screen share ended
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      this.emit(WebRTCEvent.SCREEN_SHARE_START, { stream: this.screenStream });
      
      // Notify other participants
      this.broadcastMessage(WebRTCEvent.SCREEN_SHARE_START, {
        participantId: this.config.userId,
      });

    } catch (error) {
      this.handleError(error as Error, WebRTCErrorCode.MEDIA_ERROR);
      throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (!this.screenStream) return;

    // Stop screen tracks
    this.screenStream.getTracks().forEach(track => track.stop());

    // Restore camera video track
    if (this.localStream) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      
      this.connections.forEach(connection => {
        const sender = connection.pc.getSenders().find(
          s => s.track && s.track.kind === 'video'
        );
        
        if (sender && cameraTrack) {
          sender.replaceTrack(cameraTrack);
        }
      });
    }

    this.screenStream = null;
    this.emit(WebRTCEvent.SCREEN_SHARE_END);

    // Notify other participants
    this.broadcastMessage(WebRTCEvent.SCREEN_SHARE_END, {
      participantId: this.config.userId,
    });
  }

  // Recording
  async startRecording(options?: RecordingOptions): Promise<void> {
    if (this.recordingState !== RecordingState.INACTIVE) {
      throw this.createError('Recording already in progress', WebRTCErrorCode.RECORDING_ERROR);
    }

    try {
      // Create composite stream
      this.recordingStream = new MediaStream();

      // Add local tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if ((options?.recordCamera && track.kind === 'video') ||
              (options?.recordAudio && track.kind === 'audio')) {
            this.recordingStream!.addTrack(track);
          }
        });
      }

      // Add screen tracks if available
      if (this.screenStream && options?.recordScreen) {
        this.screenStream.getTracks().forEach(track => {
          this.recordingStream!.addTrack(track);
        });
      }

      // Create media recorder
      const mimeType = options?.mimeType || this.getPreferredMimeType();
      this.mediaRecorder = new MediaRecorder(this.recordingStream, {
        mimeType,
        videoBitsPerSecond: options?.videoBitsPerSecond,
        audioBitsPerSecond: options?.audioBitsPerSecond,
      });

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.recordingState = RecordingState.RECORDING;
        this.emit(WebRTCEvent.RECORDING_START);
      };

      this.mediaRecorder.onstop = () => {
        this.recordingState = RecordingState.INACTIVE;
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.emit(WebRTCEvent.RECORDING_STOP, { blob, mimeType });
      };

      this.mediaRecorder.start(1000); // Collect data every second

    } catch (error) {
      this.handleError(error as Error, WebRTCErrorCode.RECORDING_ERROR);
      throw error;
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.recordingState === RecordingState.RECORDING) {
      this.mediaRecorder.stop();
      this.recordingStream = null;
      this.mediaRecorder = null;
    }
  }

  pauseRecording(): void {
    if (this.mediaRecorder && this.recordingState === RecordingState.RECORDING) {
      this.mediaRecorder.pause();
      this.recordingState = RecordingState.PAUSED;
      this.emit(WebRTCEvent.RECORDING_PAUSE);
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder && this.recordingState === RecordingState.PAUSED) {
      this.mediaRecorder.resume();
      this.recordingState = RecordingState.RECORDING;
      this.emit(WebRTCEvent.RECORDING_RESUME);
    }
  }

  // Stats monitoring
  private startStatsMonitoring(): void {
    this.statsInterval = setInterval(() => {
      this.connections.forEach(async (connection, participantId) => {
        const stats = await this.getConnectionStats(connection.pc);
        this.updateNetworkQuality(connection.participant, stats);
        this.emit('stats', { participantId, stats });
      });
    }, 2000);
  }

  private async getConnectionStats(pc: RTCPeerConnection): Promise<WebRTCStats> {
    const stats = await pc.getStats();
    const report: WebRTCStats = {
      timestamp: Date.now(),
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState,
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      packetsLost: 0,
    };

    stats.forEach(stat => {
      if (stat.type === 'inbound-rtp') {
        report.bytesReceived += stat.bytesReceived || 0;
        report.packetsReceived += stat.packetsReceived || 0;
        report.packetsLost += stat.packetsLost || 0;
        report.jitter = stat.jitter;
      } else if (stat.type === 'outbound-rtp') {
        report.bytesSent += stat.bytesSent || 0;
        report.packetsSent += stat.packetsSent || 0;
      } else if (stat.type === 'remote-inbound-rtp') {
        report.roundTripTime = stat.roundTripTime;
      } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        report.availableOutgoingBitrate = stat.availableOutgoingBitrate;
      }
    });

    return report;
  }

  private updateNetworkQuality(participant: Participant, stats: WebRTCStats): void {
    const packetLossRate = stats.packetsReceived > 0 
      ? stats.packetsLost / (stats.packetsReceived + stats.packetsLost) 
      : 0;
    
    const rtt = stats.roundTripTime || 0;

    if (packetLossRate < 0.01 && rtt < 150) {
      participant.networkQuality = NetworkQuality.EXCELLENT;
    } else if (packetLossRate < 0.03 && rtt < 300) {
      participant.networkQuality = NetworkQuality.GOOD;
    } else if (packetLossRate < 0.05 && rtt < 500) {
      participant.networkQuality = NetworkQuality.FAIR;
    } else if (packetLossRate < 0.1 && rtt < 1000) {
      participant.networkQuality = NetworkQuality.POOR;
    } else {
      participant.networkQuality = NetworkQuality.CRITICAL;
    }
  }

  // Utility methods
  private getDefaultMediaConstraints(config: CallConfig): MediaStreamConstraints {
    return {
      video: config.video ? {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: 'user',
      } : false,
      audio: config.audio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } : false,
    };
  }

  private getPreferredMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm';
  }

  private mapConnectionState(state: RTCPeerConnectionState): PeerConnectionState {
    switch (state) {
      case 'new': return PeerConnectionState.NEW;
      case 'connecting': return PeerConnectionState.CONNECTING;
      case 'connected': return PeerConnectionState.CONNECTED;
      case 'disconnected': return PeerConnectionState.DISCONNECTED;
      case 'failed': return PeerConnectionState.FAILED;
      case 'closed': return PeerConnectionState.CLOSED;
      default: return PeerConnectionState.NEW;
    }
  }

  private getLocalParticipant(): Participant {
    return {
      id: this.config.userId,
      userId: this.config.userId,
      name: this.config.displayName,
      streams: new Map(),
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
      connectionState: PeerConnectionState.CONNECTED,
      networkQuality: NetworkQuality.EXCELLENT,
    };
  }

  private removePeerConnection(participantId: string): void {
    const connection = this.connections.get(participantId);
    if (connection) {
      connection.pc.close();
      this.connections.delete(participantId);
    }
  }

  private createError(message: string, code: WebRTCErrorCode): WebRTCError {
    const error = new Error(message) as WebRTCError;
    error.code = code;
    return error;
  }

  private handleError(error: Error, code: WebRTCErrorCode): void {
    const webrtcError = this.createError(error.message, code);
    webrtcError.details = error;
    this.emit(WebRTCEvent.ERROR, webrtcError);
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Stop recording if active
    this.stopRecording();

    // Stop local streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Close all peer connections
    this.connections.forEach(connection => {
      connection.pc.close();
    });
    this.connections.clear();

    // Stop stats monitoring
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Notify others
    await this.broadcastMessage(WebRTCEvent.CALL_END, {
      participantId: this.config.userId,
    });

    // Unsubscribe from channel
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    // Remove all listeners
    this.removeAllListeners();
  }

  // Public getters
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  getParticipants(): Participant[] {
    return Array.from(this.connections.values()).map(c => c.participant);
  }

  getRecordingState(): RecordingState {
    return this.recordingState;
  }

  isScreenSharing(): boolean {
    return this.screenStream !== null;
  }
}