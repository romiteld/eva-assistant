'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Participant, NetworkQuality } from '@/types/webrtc';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Monitor,
  User,
  Pin,
} from 'lucide-react';

interface ParticipantGridProps {
  participants: (Participant & { isLocal?: boolean })[];
  selectedParticipantId?: string | null;
  onSelectParticipant?: (participantId: string | null) => void;
  maxParticipants?: number;
}

interface ParticipantTileProps {
  participant: Participant & { isLocal?: boolean };
  isSelected: boolean;
  isPinned: boolean;
  onSelect: () => void;
  onPin: () => void;
  size: 'small' | 'medium' | 'large';
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  isSelected,
  isPinned,
  onSelect,
  onPin,
  size,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const stream = Array.from(participant.streams.values())[0];

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Detect speaking (simplified - in production, use Web Audio API)
  useEffect(() => {
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    // Simple speaking detection based on track activity
    const checkSpeaking = () => {
      setIsSpeaking(Math.random() > 0.8); // Placeholder - replace with actual audio analysis
    };

    const interval = setInterval(checkSpeaking, 1000);
    return () => clearInterval(interval);
  }, [stream]);

  const sizeClasses = {
    small: 'h-32',
    medium: 'h-48',
    large: 'h-full',
  };

  const getNetworkQualityIcon = () => {
    const colors = {
      excellent: 'text-green-500',
      good: 'text-green-400',
      fair: 'text-yellow-500',
      poor: 'text-orange-500',
      critical: 'text-red-500',
    };

    if (participant.networkQuality === NetworkQuality.CRITICAL) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }

    return <Wifi className={`w-4 h-4 ${colors[participant.networkQuality]}`} />;
  };

  return (
    <motion.div
      className={`relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer ${
        sizeClasses[size]
      } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${
        isSpeaking ? 'ring-2 ring-green-500' : ''
      }`}
      onClick={onSelect}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Video */}
      {stream && participant.videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-700">
          <div className="text-center">
            <User className="w-16 h-16 text-gray-500 mx-auto mb-2" />
            <p className="text-white font-medium">{participant.name}</p>
          </div>
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Top Bar */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {participant.isLocal && (
            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
              You
            </span>
          )}
          {isPinned && (
            <Pin className="w-4 h-4 text-yellow-500 fill-current" />
          )}
          {participant.screenSharing && (
            <Monitor className="w-4 h-4 text-blue-500" />
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          className="p-1 bg-black/50 rounded hover:bg-black/70 transition-colors"
        >
          <Pin className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="text-white text-sm font-medium truncate">
          {participant.name}
        </span>
        <div className="flex items-center space-x-2">
          {getNetworkQualityIcon()}
          {participant.audioEnabled ? (
            <Mic className="w-4 h-4 text-white" />
          ) : (
            <MicOff className="w-4 h-4 text-red-500" />
          )}
          {participant.videoEnabled ? (
            <Video className="w-4 h-4 text-white" />
          ) : (
            <VideoOff className="w-4 h-4 text-red-500" />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
  selectedParticipantId,
  onSelectParticipant,
  maxParticipants = 25,
}) => {
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const displayedParticipants = participants.slice(0, maxParticipants);

  // Determine layout based on participant count
  const getGridLayout = () => {
    const count = displayedParticipants.length;
    
    if (pinnedParticipantId || selectedParticipantId) {
      return 'spotlight';
    }

    if (count === 1) return 'single';
    if (count === 2) return 'side-by-side';
    if (count <= 4) return 'grid-2x2';
    if (count <= 9) return 'grid-3x3';
    if (count <= 16) return 'grid-4x4';
    return 'grid-5x5';
  };

  const layout = getGridLayout();
  const pinnedParticipant = participants.find(p => p.id === pinnedParticipantId);
  const mainParticipant = pinnedParticipant || 
    participants.find(p => p.id === selectedParticipantId) ||
    participants.find(p => p.screenSharing) ||
    participants[0];

  const otherParticipants = displayedParticipants.filter(p => p.id !== mainParticipant?.id);

  if (layout === 'spotlight' && mainParticipant) {
    return (
      <div className="h-full p-4 flex">
        {/* Main participant */}
        <div className="flex-1 pr-2">
          <ParticipantTile
            participant={mainParticipant}
            isSelected={mainParticipant.id === selectedParticipantId}
            isPinned={mainParticipant.id === pinnedParticipantId}
            onSelect={() => onSelectParticipant?.(mainParticipant.id)}
            onPin={() => setPinnedParticipantId(
              pinnedParticipantId === mainParticipant.id ? null : mainParticipant.id
            )}
            size="large"
          />
        </div>

        {/* Other participants */}
        {otherParticipants.length > 0 && (
          <div className="w-64 overflow-y-auto">
            <div className="space-y-2">
              {otherParticipants.map(participant => (
                <ParticipantTile
                  key={participant.id}
                  participant={participant}
                  isSelected={participant.id === selectedParticipantId}
                  isPinned={false}
                  onSelect={() => onSelectParticipant?.(participant.id)}
                  onPin={() => setPinnedParticipantId(participant.id)}
                  size="small"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const gridClasses: Record<typeof layout, string> = {
    'single': 'grid-cols-1',
    'side-by-side': 'grid-cols-2',
    'grid-2x2': 'grid-cols-2',
    'grid-3x3': 'grid-cols-3',
    'grid-4x4': 'grid-cols-4',
    'grid-5x5': 'grid-cols-5',
    'spotlight': 'grid-cols-1', // Add spotlight layout
  };

  return (
    <div className="h-full p-4">
      <div className={`grid ${gridClasses[layout]} gap-4 h-full`}>
        {displayedParticipants.map(participant => (
          <ParticipantTile
            key={participant.id}
            participant={participant}
            isSelected={participant.id === selectedParticipantId}
            isPinned={participant.id === pinnedParticipantId}
            onSelect={() => onSelectParticipant?.(participant.id)}
            onPin={() => setPinnedParticipantId(
              pinnedParticipantId === participant.id ? null : participant.id
            )}
            size={layout === 'single' ? 'large' : 'medium'}
          />
        ))}
      </div>

      {participants.length > maxParticipants && (
        <div className="absolute bottom-4 right-4 bg-black/80 text-white px-3 py-2 rounded">
          +{participants.length - maxParticipants} more
        </div>
      )}
    </div>
  );
};