'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, MonitorOff, ChevronUp, Laptop, AppWindow, Chrome } from 'lucide-react';
import { ScreenShareOptions } from '@/types/webrtc';

interface ScreenShareProps {
  isScreenSharing: boolean;
  onStartScreenShare: (options?: ScreenShareOptions) => Promise<void>;
  onStopScreenShare: () => Promise<void>;
  className?: string;
}

interface ShareOption {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  options: ScreenShareOptions;
}

export const ScreenShare: React.FC<ScreenShareProps> = ({
  isScreenSharing,
  onStartScreenShare,
  onStopScreenShare,
  className = '',
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const shareOptions: ShareOption[] = [
    {
      id: 'entire-screen',
      label: 'Entire Screen',
      icon: Monitor,
      options: {
        video: {
          displaySurface: 'monitor',
          cursor: 'always',
        },
        audio: false,
      },
    },
    {
      id: 'window',
      label: 'Application Window',
      icon: AppWindow,
      options: {
        video: {
          displaySurface: 'window',
          cursor: 'always',
        },
        audio: false,
      },
    },
    {
      id: 'browser-tab',
      label: 'Browser Tab',
      icon: Chrome,
      options: {
        video: {
          displaySurface: 'browser',
          cursor: 'always',
        },
        audio: true,
      },
    },
  ];

  const handleStartShare = async (options?: ScreenShareOptions) => {
    setIsStarting(true);
    setShowOptions(false);

    try {
      await onStartScreenShare(options);
    } catch (error) {
      console.error('Failed to start screen share:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopShare = async () => {
    await onStopScreenShare();
  };

  if (isScreenSharing) {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleStopShare}
        className={`p-3 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors ${className}`}
        title="Stop sharing"
      >
        <div className="relative">
          <MonitorOff className="w-6 h-6 text-white" />
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </div>
      </motion.button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleStartShare()}
          disabled={isStarting}
          className={`p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors disabled:opacity-50 ${className}`}
          title="Share screen"
        >
          <Monitor className="w-6 h-6 text-white" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowOptions(!showOptions)}
          className="ml-1 p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          title="Screen share options"
        >
          <ChevronUp
            className={`w-4 h-4 text-white transition-transform ${
              showOptions ? 'rotate-180' : ''
            }`}
          />
        </motion.button>
      </div>

      {/* Share Options Menu */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full mb-2 left-0 w-72 bg-gray-800 rounded-lg shadow-xl overflow-hidden"
          >
            <div className="p-2">
              <h3 className="text-sm font-medium text-gray-400 mb-3 px-2">
                Choose what to share
              </h3>
              
              {shareOptions.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleStartShare(option.options)}
                    disabled={isStarting}
                    className="w-full flex items-center px-3 py-3 text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                  >
                    <Icon className="w-5 h-5 mr-3 text-gray-400" />
                    <div className="text-left">
                      <div className="text-sm font-medium">{option.label}</div>
                      {option.id === 'browser-tab' && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          With tab audio
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              <div className="mt-3 px-3 py-2 border-t border-gray-700">
                <label className="flex items-center text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-2 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                    defaultChecked
                  />
                  <span>Share system audio</span>
                </label>
              </div>

              <div className="mt-2 px-3 pb-2">
                <p className="text-xs text-gray-500">
                  Your entire screen or application window will be visible to other participants
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};