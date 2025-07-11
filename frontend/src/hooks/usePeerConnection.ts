import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  PeerConnectionState, 
  NetworkQuality,
  WebRTCStats,
  IceServerConfig,
  getIceServers,
} from '@/types/webrtc';

interface UsePeerConnectionProps {
  iceServers?: IceServerConfig[];
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onTrack?: (event: RTCTrackEvent) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
  onNegotiationNeeded?: () => void;
  statsInterval?: number;
}

interface UsePeerConnectionReturn {
  peerConnection: RTCPeerConnection | null;
  connectionState: PeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  stats: WebRTCStats | null;
  networkQuality: NetworkQuality;
  dataChannel: RTCDataChannel | null;
  createOffer: (options?: RTCOfferOptions) => Promise<RTCSessionDescriptionInit>;
  createAnswer: (options?: RTCAnswerOptions) => Promise<RTCSessionDescriptionInit>;
  setLocalDescription: (description?: RTCSessionDescriptionInit) => Promise<void>;
  setRemoteDescription: (description: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  addTrack: (track: MediaStreamTrack, stream: MediaStream) => RTCRtpSender;
  removeTrack: (sender: RTCRtpSender) => void;
  replaceTrack: (oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack) => Promise<void>;
  createDataChannel: (label: string, options?: RTCDataChannelInit) => RTCDataChannel;
  getStats: () => Promise<WebRTCStats | null>;
  close: () => void;
}

export const usePeerConnection = ({
  iceServers = getIceServers(),
  onIceCandidate,
  onTrack,
  onConnectionStateChange,
  onDataChannel,
  onNegotiationNeeded,
  statsInterval = 2000,
}: UsePeerConnectionProps = {}): UsePeerConnectionReturn => {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<PeerConnectionState>(PeerConnectionState.NEW);
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState>('new');
  const [signalingState, setSignalingState] = useState<RTCSignalingState>('stable');
  const [stats, setStats] = useState<WebRTCStats | null>(null);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>(NetworkQuality.GOOD);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Map RTCPeerConnectionState to PeerConnectionState
  const mapConnectionState = (state: RTCPeerConnectionState): PeerConnectionState => {
    switch (state) {
      case 'new': return PeerConnectionState.NEW;
      case 'connecting': return PeerConnectionState.CONNECTING;
      case 'connected': return PeerConnectionState.CONNECTED;
      case 'disconnected': return PeerConnectionState.DISCONNECTED;
      case 'failed': return PeerConnectionState.FAILED;
      case 'closed': return PeerConnectionState.CLOSED;
      default: return PeerConnectionState.NEW;
    }
  };

  // Initialize peer connection
  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
    });

    // Set up event handlers
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate?.(event.candidate);
      }
    };

    pc.ontrack = (event) => {
      onTrack?.(event);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setConnectionState(mapConnectionState(state));
      onConnectionStateChange?.(state);
    };

    pc.oniceconnectionstatechange = () => {
      setIceConnectionState(pc.iceConnectionState);
      
      // Restart ICE if connection fails
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    pc.onsignalingstatechange = () => {
      setSignalingState(pc.signalingState);
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      setDataChannel(channel);
      onDataChannel?.(channel);
    };

    pc.onnegotiationneeded = () => {
      onNegotiationNeeded?.();
    };

    pcRef.current = pc;

    // Start stats monitoring
    if (statsInterval > 0) {
      statsIntervalRef.current = setInterval(async () => {
        const stats = await getStatsInternal();
        if (stats) {
          setStats(stats);
          updateNetworkQuality(stats);
        }
      }, statsInterval);
    }

    return () => {
      // Clean up
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      pc.close();
    };
  }, [iceServers, onIceCandidate, onTrack, onConnectionStateChange, onDataChannel, onNegotiationNeeded, statsInterval]);

  // Get statistics
  const getStatsInternal = async (): Promise<WebRTCStats | null> => {
    if (!pcRef.current) return null;

    const stats = await pcRef.current.getStats();
    const report: WebRTCStats = {
      timestamp: Date.now(),
      connectionState: pcRef.current.connectionState,
      iceConnectionState: pcRef.current.iceConnectionState,
      signalingState: pcRef.current.signalingState,
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

        if (stat.kind === 'video') {
          report.videoStats = {
            frameWidth: stat.frameWidth || 0,
            frameHeight: stat.frameHeight || 0,
            framesPerSecond: stat.framesPerSecond || 0,
            framesReceived: stat.framesReceived,
            framesDropped: stat.framesDropped,
            keyFramesReceived: stat.keyFramesDecoded,
            bitrate: stat.bytesReceived || 0,
          };
        } else if (stat.kind === 'audio') {
          report.audioStats = {
            audioLevel: stat.audioLevel || 0,
            totalAudioEnergy: stat.totalAudioEnergy || 0,
            bitrate: stat.bytesReceived || 0,
          };
        }
      } else if (stat.type === 'outbound-rtp') {
        report.bytesSent += stat.bytesSent || 0;
        report.packetsSent += stat.packetsSent || 0;

        if (stat.kind === 'video') {
          if (!report.videoStats) {
            report.videoStats = {} as any;
          }
          if (report.videoStats) {
            report.videoStats.framesSent = stat.framesSent || 0;
            report.videoStats.keyFramesSent = stat.keyFramesEncoded || 0;
          }
        }
      } else if (stat.type === 'remote-inbound-rtp') {
        report.roundTripTime = stat.roundTripTime;
      } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        report.availableOutgoingBitrate = stat.availableOutgoingBitrate;
        report.availableIncomingBitrate = stat.availableIncomingBitrate;
      }
    });

    return report;
  };

  // Update network quality based on stats
  const updateNetworkQuality = (stats: WebRTCStats) => {
    const packetLossRate = stats.packetsReceived > 0 
      ? stats.packetsLost / (stats.packetsReceived + stats.packetsLost) 
      : 0;
    
    const rtt = stats.roundTripTime || 0;

    if (packetLossRate < 0.01 && rtt < 150) {
      setNetworkQuality(NetworkQuality.EXCELLENT);
    } else if (packetLossRate < 0.03 && rtt < 300) {
      setNetworkQuality(NetworkQuality.GOOD);
    } else if (packetLossRate < 0.05 && rtt < 500) {
      setNetworkQuality(NetworkQuality.FAIR);
    } else if (packetLossRate < 0.1 && rtt < 1000) {
      setNetworkQuality(NetworkQuality.POOR);
    } else {
      setNetworkQuality(NetworkQuality.CRITICAL);
    }
  };

  // Public methods
  const createOffer = async (options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> => {
    if (!pcRef.current) throw new Error('Peer connection not initialized');
    return await pcRef.current.createOffer(options);
  };

  const createAnswer = async (options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> => {
    if (!pcRef.current) throw new Error('Peer connection not initialized');
    return await pcRef.current.createAnswer(options);
  };

  const setLocalDescription = async (description?: RTCSessionDescriptionInit): Promise<void> => {
    if (!pcRef.current) throw new Error('Peer connection not initialized');
    await pcRef.current.setLocalDescription(description);
  };

  const setRemoteDescription = async (description: RTCSessionDescriptionInit): Promise<void> => {
    if (!pcRef.current) throw new Error('Peer connection not initialized');
    await pcRef.current.setRemoteDescription(description);
  };

  const addIceCandidate = async (candidate: RTCIceCandidateInit): Promise<void> => {
    if (!pcRef.current) throw new Error('Peer connection not initialized');
    await pcRef.current.addIceCandidate(candidate);
  };

  const addTrack = (track: MediaStreamTrack, stream: MediaStream): RTCRtpSender => {
    if (!pcRef.current) throw new Error('Peer connection not initialized');
    return pcRef.current.addTrack(track, stream);
  };

  const removeTrack = (sender: RTCRtpSender): void => {
    if (!pcRef.current) throw new Error('Peer connection not initialized');
    pcRef.current.removeTrack(sender);
  };

  const replaceTrack = async (oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack): Promise<void> => {
    if (!pcRef.current) throw new Error('Peer connection not initialized');
    
    const sender = pcRef.current.getSenders().find(s => s.track === oldTrack);
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  };

  const createDataChannel = (label: string, options?: RTCDataChannelInit): RTCDataChannel => {
    if (!pcRef.current) throw new Error('Peer connection not initialized');
    
    const channel = pcRef.current.createDataChannel(label, options);
    setDataChannel(channel);
    return channel;
  };

  const getStats = async (): Promise<WebRTCStats | null> => {
    return await getStatsInternal();
  };

  const close = (): void => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

  return {
    peerConnection: pcRef.current,
    connectionState,
    iceConnectionState,
    signalingState,
    stats,
    networkQuality,
    dataChannel,
    createOffer,
    createAnswer,
    setLocalDescription,
    setRemoteDescription,
    addIceCandidate,
    addTrack,
    removeTrack,
    replaceTrack,
    createDataChannel,
    getStats,
    close,
  };
};