'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceControl } from './VoiceControl';
import { AudioVisualizer } from './AudioVisualizer';
import { TranscriptionDisplay } from './TranscriptionDisplay';
import { ConversationHistory } from './ConversationHistory';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { useAuth } from '@/hooks/useAuth';
import { ScreenShare } from '../webrtc/ScreenShare';
import { useScreenShare } from '@/hooks/useScreenShare';
import { Tool, FunctionCall, VoiceType } from '@/types/voice';
import { ScreenShareOptions } from '@/types/webrtc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Monitor, Camera, CameraOff, Volume2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceAgentWithScreenShareProps {
  systemInstructions?: string;
  tools?: Tool[];
  voice?: VoiceType;
  onFunctionCall?: (functionCall: FunctionCall) => Promise<any>;
  enableHistory?: boolean;
  sessionId?: string;
}

export function VoiceAgentWithScreenShare({
  systemInstructions = "You are EVA, a helpful AI assistant. You can see what I'm sharing on my screen and help me with it. Respond naturally and conversationally.",
  tools = [],
  voice = VoiceType.PUCK,
  onFunctionCall,
  enableHistory = false,
  sessionId,
}: VoiceAgentWithScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [pendingFunctionCalls, setPendingFunctionCalls] = useState<FunctionCall[]>([]);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  const {
    isSharing,
    stream: screenStream,
    startScreenShare,
    stopScreenShare,
    error: screenShareError,
  } = useScreenShare();

  // Enhanced system instructions for screen/camera awareness
  const enhancedInstructions = `${systemInstructions}
  
When the user shares their screen or camera:
- Acknowledge what you can see
- Provide helpful context-aware suggestions
- Point out specific elements you notice
- Help with any tasks related to what's being shown`;

  // Use voice agent with visual support enabled
  const {
    state,
    session,
    isConnected,
    isListening,
    isSpeaking,
    isProcessing,
    error,
    turns,
    currentTranscription,
    connect,
    disconnect,
    toggleListening,
    sendText,
    sendFunctionResult,
    setVisualStream,
    metrics,
    analytics,
    frequencyData,
    waveformData,
    hasPermission,
    requestPermission,
  } = useVoiceAgent({
    voice: voice,
    systemInstructions: enhancedInstructions,
    tools,
    enableAnalytics: true,
    enableHistory,
    sessionId,
    enableVisual: true, // Enable visual support
    onFunctionCall: async (functionCall) => {
      setPendingFunctionCalls(prev => [...prev, functionCall]);
      
      if (onFunctionCall) {
        try {
          const result = await onFunctionCall(functionCall);
          sendFunctionResult(functionCall.id, result);
          setPendingFunctionCalls(prev => prev.filter(fc => fc.id !== functionCall.id));
        } catch (error) {
          console.error('Function call error:', error);
          sendFunctionResult(functionCall.id, { error: error instanceof Error ? error.message : 'Unknown error' });
          setPendingFunctionCalls(prev => prev.filter(fc => fc.id !== functionCall.id));
        }
      }
    },
  });

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });
      setCameraStream(stream);
      setIsCameraOn(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Failed to start camera:', error);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraOn(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [cameraStream]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [isCameraOn, startCamera, stopCamera]);

  // Handle screen share
  const handleStartScreenShare = useCallback(async (options?: ScreenShareOptions) => {
    await startScreenShare(options);
  }, [startScreenShare]);

  const handleStopScreenShare = useCallback(async () => {
    await stopScreenShare();
  }, [stopScreenShare]);

  // Update video element and voice agent visual stream when streams change
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    
    if (screenStream) {
      currentStream = screenStream;
    } else if (cameraStream) {
      currentStream = cameraStream;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = currentStream;
    }
    
    // Update voice agent's visual stream
    setVisualStream(currentStream);
    
    setActiveStream(currentStream);
  }, [screenStream, cameraStream, setVisualStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (isSharing) {
        stopScreenShare();
      }
    };
  }, [isSharing, stopCamera, stopScreenShare]);

  // Auto-connect on mount
  useEffect(() => {
    if (!isConnected && hasPermission) {
      connect();
    }
  }, [hasPermission, connect, isConnected]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Show auth UI if not authenticated
  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            EVA Voice Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4 py-8">
            <p className="text-muted-foreground">
              Please sign in to use the voice assistant with visual input
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Voice Agent Card */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Volume2 className="h-5 w-5" />
              EVA Voice Assistant with Visual Input
            </CardTitle>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {/* Audio Visualizer */}
          <AudioVisualizer
            frequencyData={frequencyData}
            waveformData={waveformData}
            isActive={isListening || isSpeaking}
            mode={isListening ? 'input' : 'output'}
          />

          {/* Voice Control */}
          <VoiceControl
            isConnected={isConnected}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
            hasPermission={hasPermission}
            onConnect={connect}
            onDisconnect={disconnect}
            onToggleListening={toggleListening}
            onRequestPermission={requestPermission}
          />

          {/* Transcription Display */}
          {currentTranscription && (
            <TranscriptionDisplay
              transcription={currentTranscription}
              isInterim={!currentTranscription.isFinal}
            />
          )}

          {/* Conversation History */}
          {enableHistory && turns.length > 0 && (
            <ConversationHistory
              turns={turns}
              maxHeight="200px"
            />
          )}
        </CardContent>
      </Card>

      {/* Screen/Camera Display */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Monitor className="w-5 h-5" />
              Visual Input
            </CardTitle>
            <div className="flex items-center gap-2">
              {isSharing && (
                <Badge variant="secondary" className="bg-blue-600/20 text-blue-400">
                  Screen Sharing
                </Badge>
              )}
              {isCameraOn && (
                <Badge variant="secondary" className="bg-green-600/20 text-green-400">
                  Camera On
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Video Display */}
          <div className="relative mb-4 bg-black rounded-lg overflow-hidden aspect-video">
            {(isSharing || isCameraOn) ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Monitor className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No screen or camera shared</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Share your screen or camera to show EVA what you&apos;re working on
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <ScreenShare
              isScreenSharing={isSharing}
              onStartScreenShare={handleStartScreenShare}
              onStopScreenShare={handleStopScreenShare}
            />
            
            <Button
              onClick={toggleCamera}
              disabled={isSharing}
              variant={isCameraOn ? "default" : "secondary"}
              size="icon"
              className={cn(
                "rounded-full w-12 h-12",
                isCameraOn ? "bg-green-600 hover:bg-green-700" : ""
              )}
            >
              {isCameraOn ? (
                <CameraOff className="w-5 h-5" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </Button>
          </div>

          {/* Error Display */}
          {screenShareError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{screenShareError?.message || String(screenShareError)}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-4 p-4 bg-white/5 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">How it works:</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Share your screen to show EVA what you&apos;re working on</li>
              <li>• Turn on your camera for face-to-face interaction</li>
              <li>• EVA can see and respond to what you share in real-time</li>
              <li>• Use voice commands to interact naturally</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}