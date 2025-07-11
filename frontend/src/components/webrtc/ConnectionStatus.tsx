'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Users, Signal, AlertCircle, Info } from 'lucide-react';
import { NetworkQuality, CallState } from '@/types/webrtc';

interface ConnectionStatusProps {
  quality: NetworkQuality;
  state: CallState;
  participantCount?: number;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  quality,
  state,
  participantCount = 0,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getQualityColor = () => {
    switch (quality) {
      case NetworkQuality.EXCELLENT:
        return 'text-green-500 bg-green-500/20';
      case NetworkQuality.GOOD:
        return 'text-green-400 bg-green-400/20';
      case NetworkQuality.FAIR:
        return 'text-yellow-500 bg-yellow-500/20';
      case NetworkQuality.POOR:
        return 'text-orange-500 bg-orange-500/20';
      case NetworkQuality.CRITICAL:
        return 'text-red-500 bg-red-500/20';
      default:
        return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getQualityIcon = () => {
    if (quality === NetworkQuality.CRITICAL) {
      return <WifiOff className="w-4 h-4" />;
    }
    return <Wifi className="w-4 h-4" />;
  };

  const getStateColor = () => {
    switch (state) {
      case CallState.CONNECTED:
        return 'text-green-500';
      case CallState.CALLING:
      case CallState.RINGING:
        return 'text-blue-500';
      case CallState.FAILED:
        return 'text-red-500';
      case CallState.ENDED:
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStateText = () => {
    switch (state) {
      case CallState.IDLE:
        return 'Idle';
      case CallState.CALLING:
        return 'Calling...';
      case CallState.RINGING:
        return 'Ringing...';
      case CallState.CONNECTED:
        return 'Connected';
      case CallState.ENDED:
        return 'Call Ended';
      case CallState.FAILED:
        return 'Connection Failed';
      default:
        return 'Unknown';
    }
  };

  const getQualityBars = () => {
    const bars = 4;
    let activeBars = 0;

    switch (quality) {
      case NetworkQuality.EXCELLENT:
        activeBars = 4;
        break;
      case NetworkQuality.GOOD:
        activeBars = 3;
        break;
      case NetworkQuality.FAIR:
        activeBars = 2;
        break;
      case NetworkQuality.POOR:
        activeBars = 1;
        break;
      case NetworkQuality.CRITICAL:
        activeBars = 0;
        break;
    }

    return Array.from({ length: bars }, (_, i) => (
      <div
        key={i}
        className={`w-1 transition-all duration-300 ${
          i < activeBars
            ? `${getQualityColor().split(' ')[0]} opacity-100`
            : 'bg-gray-600 opacity-50'
        }`}
        style={{ height: `${(i + 1) * 4}px` }}
      />
    ));
  };

  return (
    <div className={`relative ${className}`}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg backdrop-blur-sm ${
          getQualityColor().split(' ')[1]
        } transition-colors`}
      >
        {/* Connection Quality */}
        <div className="flex items-center space-x-1">
          {getQualityIcon()}
          <div className="flex items-end space-x-0.5">
            {getQualityBars()}
          </div>
        </div>

        {/* Participant Count */}
        {participantCount > 0 && (
          <>
            <div className="w-px h-4 bg-gray-600" />
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{participantCount}</span>
            </div>
          </>
        )}

        {/* Connection State */}
        <div className="w-px h-4 bg-gray-600" />
        <span className={`text-sm font-medium ${getStateColor()}`}>
          {getStateText()}
        </span>

        <Info className="w-4 h-4 text-gray-400" />
      </motion.button>

      {/* Details Popup */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 left-0 w-64 bg-gray-800 rounded-lg shadow-xl p-4"
          >
            <h3 className="text-sm font-semibold text-white mb-3">
              Connection Details
            </h3>

            <div className="space-y-2">
              {/* Network Quality */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Network Quality</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${getQualityColor().split(' ')[0]}`}>
                    {quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </span>
                  <div className="flex items-end space-x-0.5">
                    {getQualityBars()}
                  </div>
                </div>
              </div>

              {/* Connection State */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Call Status</span>
                <span className={`text-sm font-medium ${getStateColor()}`}>
                  {getStateText()}
                </span>
              </div>

              {/* Participants */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Participants</span>
                <span className="text-sm font-medium text-white">
                  {participantCount}
                </span>
              </div>

              {/* Quality Indicators */}
              <div className="pt-2 mt-2 border-t border-gray-700">
                <div className="space-y-1">
                  {quality === NetworkQuality.POOR && (
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                      <p className="text-xs text-gray-400">
                        Poor connection quality. Video may be degraded.
                      </p>
                    </div>
                  )}
                  {quality === NetworkQuality.CRITICAL && (
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                      <p className="text-xs text-gray-400">
                        Critical connection issues. Call quality severely impacted.
                      </p>
                    </div>
                  )}
                  {state === CallState.FAILED && (
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                      <p className="text-xs text-gray-400">
                        Connection failed. Please check your network and try again.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tips */}
            {(quality === NetworkQuality.POOR || quality === NetworkQuality.CRITICAL) && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Tips to improve quality:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Move closer to your WiFi router</li>
                  <li>• Close other apps using bandwidth</li>
                  <li>• Turn off video to save bandwidth</li>
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};