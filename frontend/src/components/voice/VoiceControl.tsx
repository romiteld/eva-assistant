'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, Power, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceControlProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isConnected: boolean;
  onToggleListening: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  hasPermission: boolean;
  onRequestPermission: () => void;
  audioLevel?: number;
}

export function VoiceControl({
  isListening,
  isSpeaking,
  isProcessing,
  isConnected,
  onToggleListening,
  onConnect,
  onDisconnect,
  onStartListening,
  onStopListening,
  hasPermission,
  onRequestPermission,
  audioLevel = 0,
}: VoiceControlProps) {
  const getMicButtonState = () => {
    if (isProcessing) {
      return {
        icon: <Loader2 className="h-8 w-8 animate-spin" />,
        className: 'bg-orange-500 hover:bg-orange-600',
        disabled: true,
      };
    }
    
    if (isSpeaking) {
      return {
        icon: <Mic className="h-8 w-8" />,
        className: 'bg-blue-500 hover:bg-blue-600 animate-pulse',
        disabled: true,
      };
    }
    
    if (isListening) {
      return {
        icon: <Mic className="h-8 w-8" />,
        className: 'bg-red-500 hover:bg-red-600',
        disabled: false,
      };
    }
    
    return {
      icon: <MicOff className="h-8 w-8" />,
      className: 'bg-gray-500 hover:bg-gray-600',
      disabled: !isConnected,
    };
  };

  const micButtonState = getMicButtonState();

  const handleMicrophoneClick = async () => {
    console.log('Microphone button clicked', { isConnected, hasPermission });
    
    // If not connected, connect first
    if (!isConnected) {
      console.log('Not connected, attempting to connect...');
      await onConnect();
      return;
    }
    
    // If no permission, request it first
    if (!hasPermission) {
      console.log('No permission, requesting...');
      await onRequestPermission();
      return;
    }
    
    // Toggle listening state
    console.log('Toggling listening state');
    onToggleListening();
  };

  return (
    <div className="flex items-center gap-4">
      {/* Connection Toggle */}
      <Button
        size="icon"
        variant="outline"
        onClick={isConnected ? onDisconnect : onConnect}
        className="h-12 w-12"
      >
        {isConnected ? (
          <Power className="h-5 w-5 text-green-500" />
        ) : (
          <PowerOff className="h-5 w-5 text-gray-500" />
        )}
      </Button>

      {/* Microphone Button with Audio Level Indicator */}
      <div className="relative">
        {/* Audio Level Ring */}
        {isListening && (
          <div
            className="absolute inset-0 rounded-full border-4 border-red-500 animate-pulse"
            style={{
              transform: `scale(${1 + audioLevel * 0.5})`,
              opacity: 0.5 + audioLevel * 0.5,
              transition: 'all 0.1s ease-out',
            }}
          />
        )}
        
        {/* Microphone Button */}
        <Button
          size="icon"
          onClick={handleMicrophoneClick}
          disabled={micButtonState.disabled && isConnected}
          className={cn(
            'h-20 w-20 rounded-full transition-all duration-200',
            micButtonState.className,
            isListening && 'shadow-lg shadow-red-500/50'
          )}
        >
          {micButtonState.icon}
        </Button>
      </div>

      {/* Status Text */}
      <div className="text-sm text-muted-foreground">
        {isProcessing && <span>Processing...</span>}
        {isSpeaking && <span>Speaking...</span>}
        {isListening && <span>Listening...</span>}
        {!isConnected && <span>Disconnected</span>}
        {isConnected && !isListening && !isSpeaking && !isProcessing && <span>Ready</span>}
      </div>
    </div>
  );
}