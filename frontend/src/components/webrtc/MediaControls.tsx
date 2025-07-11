'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ChevronUp,
  Check,
  Settings,
} from 'lucide-react';

interface MediaControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onSelectAudioDevice?: (deviceId: string) => void;
  onSelectVideoDevice?: (deviceId: string) => void;
  className?: string;
}

interface MediaDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export const MediaControls: React.FC<MediaControlsProps> = ({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onSelectAudioDevice,
  onSelectVideoDevice,
  className = '',
}) => {
  const [showAudioDevices, setShowAudioDevices] = useState(false);
  const [showVideoDevices, setShowVideoDevices] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const audioMenuRef = useRef<HTMLDivElement>(null);
  const videoMenuRef = useRef<HTMLDivElement>(null);

  // Get available media devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
            kind: device.kind,
          }));

        const videoInputs = devices
          .filter(device => device.kind === 'videoinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId.slice(0, 5)}`,
            kind: device.kind,
          }));

        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);

        // Set default devices
        if (audioInputs.length > 0 && !selectedAudioDevice) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
        if (videoInputs.length > 0 && !selectedVideoDevice) {
          setSelectedVideoDevice(videoInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error enumerating devices:', error);
      }
    };

    getDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, [selectedAudioDevice, selectedVideoDevice]);

  // Handle clicks outside of device menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(event.target as Node)) {
        setShowAudioDevices(false);
      }
      if (videoMenuRef.current && !videoMenuRef.current.contains(event.target as Node)) {
        setShowVideoDevices(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectAudioDevice = (deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    onSelectAudioDevice?.(deviceId);
    setShowAudioDevices(false);
  };

  const handleSelectVideoDevice = (deviceId: string) => {
    setSelectedVideoDevice(deviceId);
    onSelectVideoDevice?.(deviceId);
    setShowVideoDevices(false);
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Audio Control */}
      <div className="relative" ref={audioMenuRef}>
        <div className="flex items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleAudio}
            className={`p-3 rounded-full transition-colors ${
              isAudioEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? (
              <Mic className="w-6 h-6" />
            ) : (
              <MicOff className="w-6 h-6" />
            )}
          </motion.button>

          {audioDevices.length > 1 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAudioDevices(!showAudioDevices)}
              className="ml-1 p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
              title="Audio Settings"
            >
              <ChevronUp
                className={`w-4 h-4 text-white transition-transform ${
                  showAudioDevices ? 'rotate-180' : ''
                }`}
              />
            </motion.button>
          )}
        </div>

        {/* Audio Device Menu */}
        <AnimatePresence>
          {showAudioDevices && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-full mb-2 left-0 w-64 bg-gray-800 rounded-lg shadow-xl overflow-hidden"
            >
              <div className="p-2">
                <h3 className="text-sm font-medium text-gray-400 mb-2 px-2">
                  Select Microphone
                </h3>
                {audioDevices.map(device => (
                  <button
                    key={device.deviceId}
                    onClick={() => handleSelectAudioDevice(device.deviceId)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-gray-700 rounded transition-colors"
                  >
                    <span className="truncate">{device.label}</span>
                    {selectedAudioDevice === device.deviceId && (
                      <Check className="w-4 h-4 text-green-500 ml-2 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Video Control */}
      <div className="relative" ref={videoMenuRef}>
        <div className="flex items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleVideo}
            className={`p-3 rounded-full transition-colors ${
              isVideoEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? (
              <Video className="w-6 h-6" />
            ) : (
              <VideoOff className="w-6 h-6" />
            )}
          </motion.button>

          {videoDevices.length > 1 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowVideoDevices(!showVideoDevices)}
              className="ml-1 p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
              title="Video Settings"
            >
              <ChevronUp
                className={`w-4 h-4 text-white transition-transform ${
                  showVideoDevices ? 'rotate-180' : ''
                }`}
              />
            </motion.button>
          )}
        </div>

        {/* Video Device Menu */}
        <AnimatePresence>
          {showVideoDevices && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-full mb-2 left-0 w-64 bg-gray-800 rounded-lg shadow-xl overflow-hidden"
            >
              <div className="p-2">
                <h3 className="text-sm font-medium text-gray-400 mb-2 px-2">
                  Select Camera
                </h3>
                {videoDevices.map(device => (
                  <button
                    key={device.deviceId}
                    onClick={() => handleSelectVideoDevice(device.deviceId)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-gray-700 rounded transition-colors"
                  >
                    <span className="truncate">{device.label}</span>
                    {selectedVideoDevice === device.deviceId && (
                      <Check className="w-4 h-4 text-green-500 ml-2 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};