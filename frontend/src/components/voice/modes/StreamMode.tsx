'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  CameraOff, 
  Monitor, 
  MonitorOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Users,
  Settings,
  Maximize,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { StreamConfig } from '@/types/communication';

interface StreamModeProps {
  sessionId?: string;
  onStreamingChange: (isStreaming: boolean) => void;
  onNewSession: () => void;
}

export function StreamMode({ sessionId, onStreamingChange, onNewSession }: StreamModeProps) {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [roomCode, setRoomCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  const [streamConfig, setStreamConfig] = useState<StreamConfig>({
    video: true,
    audio: true,
    screen: false,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (sessionId && user) {
      initializeRoom();
    }

    return () => {
      stopStream();
    };
  }, [sessionId, user]);

  const initializeRoom = async () => {
    if (!sessionId || !user) return;

    // Generate room code
    const code = sessionId.slice(-8).toUpperCase();
    setRoomCode(code);

    // Join Supabase Realtime channel
    const streamChannel = supabase.channel(`stream-${sessionId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: user.id },
      },
    });

    streamChannel
      .on('presence', { event: 'sync' }, () => {
        const state = streamChannel.presenceState();
        setParticipants(Object.keys(state));
      })
      .on('broadcast', { event: 'offer' }, async (payload) => {
        await handleOffer(payload.payload);
      })
      .on('broadcast', { event: 'answer' }, async (payload) => {
        await handleAnswer(payload.payload);
      })
      .on('broadcast', { event: 'ice-candidate' }, async (payload) => {
        await handleIceCandidate(payload.payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        }
      });

    setChannel(streamChannel);

    // Track participant in database
    await supabase
      .from('stream_participants')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        peer_id: user.id,
        role: 'host',
      });
  };

  const startStream = async (config: Partial<StreamConfig>) => {
    try {
      const newConfig = { ...streamConfig, ...config };
      setStreamConfig(newConfig);

      let stream: MediaStream;

      if (newConfig.screen) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: newConfig.audio,
        });

        // Add camera stream if requested
        if (newConfig.video) {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240 },
            audio: false,
          });
          
          // Picture-in-picture setup would go here
          // For now, just use screen share
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: newConfig.video ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          } : false,
          audio: newConfig.audio,
        });
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setLocalStream(stream);
      onStreamingChange(true);

      if (!sessionId) {
        onNewSession();
      } else {
        // Initialize WebRTC
        await initializeWebRTC(stream);
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      onStreamingChange(false);
    }
  };

  const stopStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    onStreamingChange(false);
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setStreamConfig(prev => ({ ...prev, video: videoTrack.enabled }));
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setStreamConfig(prev => ({ ...prev, audio: audioTrack.enabled }));
      }
    }
  };

  const initializeWebRTC = async (stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Add TURN servers for production
      ],
    });

    peerConnectionRef.current = pc;

    // Add local stream tracks to peer connection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle incoming tracks
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteStream(event.streams[0]);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            candidate: event.candidate,
            userId: user?.id,
          },
        });
      }
    };

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'offer',
        payload: {
          offer,
          userId: user?.id,
        },
      });
    }
  };

  const handleOffer = async (payload: any) => {
    if (!peerConnectionRef.current || payload.userId === user?.id) return;

    await peerConnectionRef.current.setRemoteDescription(payload.offer);
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);

    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'answer',
        payload: {
          answer,
          userId: user?.id,
        },
      });
    }
  };

  const handleAnswer = async (payload: any) => {
    if (!peerConnectionRef.current || payload.userId === user?.id) return;
    await peerConnectionRef.current.setRemoteDescription(payload.answer);
  };

  const handleIceCandidate = async (payload: any) => {
    if (!peerConnectionRef.current || payload.userId === user?.id) return;
    await peerConnectionRef.current.addIceCandidate(payload.candidate);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Video Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Local Video */}
        <Card className="relative bg-black overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!localStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-400">Camera not started</p>
              </div>
            </div>
          )}
          <div className="absolute top-4 left-4">
            <Badge variant="secondary" className="bg-black/50">
              You
            </Badge>
          </div>
        </Card>

        {/* Remote Video */}
        <Card className="relative bg-black overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-400">Waiting for participants...</p>
              </div>
            </div>
          )}
          {remoteStream && (
            <div className="absolute top-4 left-4">
              <Badge variant="secondary" className="bg-black/50">
                Participant
              </Badge>
            </div>
          )}
        </Card>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Room Info */}
        {roomCode && (
          <div className="flex items-center justify-center gap-4 p-3 bg-white/5 rounded-lg">
            <span className="text-sm text-gray-400">Room Code:</span>
            <code className="text-lg font-mono text-white">{roomCode}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyRoomCode}
              className="text-gray-400 hover:text-white"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Badge variant="secondary" className="text-xs">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        )}

        {/* Media Controls */}
        <div className="flex items-center justify-center gap-3">
          {!localStream ? (
            <>
              <Button
                onClick={() => startStream({ video: true, audio: true, screen: false })}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </Button>
              <Button
                onClick={() => startStream({ video: false, audio: true, screen: true })}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Monitor className="w-4 h-4 mr-2" />
                Share Screen
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon"
                variant={streamConfig.video ? "secondary" : "destructive"}
                onClick={toggleVideo}
                disabled={streamConfig.screen}
              >
                {streamConfig.video ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant={streamConfig.audio ? "secondary" : "destructive"}
                onClick={toggleAudio}
              >
                {streamConfig.audio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant="destructive"
                onClick={stopStream}
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}