'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WebRTCService } from '@/lib/services/webrtc';
import {
  WebRTCEvent,
  CallConfig,
  Participant,
  MediaType,
  CallState,
  NetworkQuality,
  PeerConnectionState,
} from '@/types/webrtc';
import { ParticipantGrid } from './ParticipantGrid';
import { MediaControls } from './MediaControls';
import { ScreenShare } from './ScreenShare';
import { ConnectionStatus } from './ConnectionStatus';
import { useWebRTC } from '@/hooks/useWebRTC';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Users, Settings, Maximize2, Minimize2 } from 'lucide-react';

interface VideoCallProps {
  roomId: string;
  userId: string;
  displayName: string;
  onCallEnd?: () => void;
  initialVideo?: boolean;
  initialAudio?: boolean;
  maxParticipants?: number;
  enableRecording?: boolean;
}

export const VideoCall: React.FC<VideoCallProps> = ({
  roomId,
  userId,
  displayName,
  onCallEnd,
  initialVideo = true,
  initialAudio = true,
  maxParticipants = 10,
  enableRecording = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const controlsTimeout = useRef<NodeJS.Timeout>();

  const {
    service,
    localStream,
    participants,
    callState,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    isRecording,
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
  } = useWebRTC({
    roomId,
    userId,
    displayName,
    video: initialVideo,
    audio: initialAudio,
    maxParticipants,
    enableRecording,
  });

  // Initialize call on mount
  useEffect(() => {
    initialize();
    return () => {
      cleanup();
    };
  }, [initialize, cleanup]);

  // Handle mouse movement for controls visibility
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        if (controlsTimeout.current) {
          clearTimeout(controlsTimeout.current);
        }
      };
    }
  }, []);

  // Handle fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle call end
  const handleCallEnd = async () => {
    await cleanup();
    onCallEnd?.();
  };

  // Get all participants including local
  const allParticipants = [
    {
      id: userId,
      userId,
      name: displayName,
      streams: localStream ? new Map([['local', localStream]]) : new Map(),
      audioEnabled: isAudioEnabled,
      videoEnabled: isVideoEnabled,
      screenSharing: isScreenSharing,
      connectionState: PeerConnectionState.CONNECTED,
      networkQuality,
      isLocal: true,
    },
    ...participants,
  ];

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Call Error</h2>
          <p className="text-red-500 mb-4">{error.message}</p>
          <button
            onClick={handleCallEnd}
            className="px-6 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Leave Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full bg-gray-900 overflow-hidden"
      onMouseEnter={() => setShowControls(true)}
    >
      {/* Connection Status */}
      <div className="absolute top-4 left-4 z-20">
        <ConnectionStatus
          quality={networkQuality}
          state={callState}
          participantCount={allParticipants.length}
        />
      </div>

      {/* Participant Grid */}
      <ParticipantGrid
        participants={allParticipants}
        selectedParticipantId={selectedParticipant}
        onSelectParticipant={setSelectedParticipant}
        maxParticipants={maxParticipants}
      />

      {/* Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4"
          >
            <div className="flex items-center justify-center space-x-4">
              <MediaControls
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                onToggleAudio={toggleAudio}
                onToggleVideo={toggleVideo}
              />

              <ScreenShare
                isScreenSharing={isScreenSharing}
                onStartScreenShare={startScreenShare}
                onStopScreenShare={stopScreenShare}
              />

              {enableRecording && (
                <div className="flex space-x-2">
                  {!isRecording ? (
                    <button
                      onClick={() => startRecording()}
                      className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                      title="Start Recording"
                    >
                      <div className="w-6 h-6 bg-red-600 rounded-full" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={stopRecording}
                        className="p-3 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                        title="Stop Recording"
                      >
                        <div className="w-6 h-6 bg-white rounded-sm" />
                      </button>
                      <button
                        onClick={pauseRecording}
                        className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                        title="Pause Recording"
                      >
                        <div className="flex space-x-1">
                          <div className="w-2 h-6 bg-white" />
                          <div className="w-2 h-6 bg-white" />
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                title="Settings"
              >
                <Settings className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-6 h-6 text-white" />
                ) : (
                  <Maximize2 className="w-6 h-6 text-white" />
                )}
              </button>

              <button
                onClick={handleCallEnd}
                className="p-3 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Call Info */}
            <div className="flex items-center justify-center mt-4 text-white/80 text-sm">
              <Users className="w-4 h-4 mr-2" />
              <span>{allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}</span>
              <span className="mx-2">•</span>
              <span>Room: {roomId}</span>
              {isRecording && (
                <>
                  <span className="mx-2">•</span>
                  <span className="text-red-500 flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse" />
                    Recording
                  </span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="absolute top-0 right-0 w-80 h-full bg-gray-800 shadow-xl p-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Settings content would go here */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Audio Settings</h4>
                {/* Audio device selection */}
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Video Settings</h4>
                {/* Video device selection */}
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Network</h4>
                <div className="text-white">
                  <p>Quality: {networkQuality}</p>
                  <p>State: {callState}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};