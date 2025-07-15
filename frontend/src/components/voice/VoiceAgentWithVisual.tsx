'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceControl } from './VoiceControl';
import { AudioVisualizer } from './AudioVisualizer';
import { TranscriptionDisplay } from './TranscriptionDisplay';
import { VoiceSettings } from './VoiceSettings';
import { ConversationHistory } from './ConversationHistory';
import { FunctionCallHandler } from './FunctionCallHandler';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { useAuth } from '@/hooks/useAuth';
import { ScreenShare } from '../webrtc/ScreenShare';
import { useScreenShare } from '@/hooks/useScreenShare';
import { VoiceType, Tool, FunctionCall } from '@/types/voice';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, MicOff, Volume2, AlertCircle, LogIn, Mail, Monitor, Camera, CameraOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ScreenShareOptions } from '@/types/webrtc';
import { cn } from '@/lib/utils';

interface VoiceAgentWithVisualProps {
  systemInstructions?: string;
  tools?: Tool[];
  voice?: VoiceType;
  onFunctionCall?: (functionCall: FunctionCall) => Promise<any>;
  enableHistory?: boolean;
  sessionId?: string;
}

export function VoiceAgentWithVisual({
  systemInstructions = "You are EVA, a helpful AI assistant. You can see what I'm sharing on my screen and help me with it. Respond naturally and conversationally.",
  tools = [],
  voice = VoiceType.PUCK,
  onFunctionCall,
  enableHistory = false,
  sessionId,
}: VoiceAgentWithVisualProps) {
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>(voice);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingFunctionCalls, setPendingFunctionCalls] = useState<FunctionCall[]>([]);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
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

  // Use voice agent with visual enabled
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
    startListening,
    stopListening,
    sendText,
    sendFunctionResult,
    toggleListening,
    setVisualStream,
    metrics,
    analytics,
    frequencyData,
    waveformData,
    hasPermission,
    requestPermission,
  } = useVoiceAgent({
    systemInstructions: enhancedInstructions,
    tools,
    voice: selectedVoice,
    onFunctionCall: async (functionCall) => {
      setPendingFunctionCalls(prev => [...prev, functionCall]);
      if (onFunctionCall) {
        const result = await onFunctionCall(functionCall);
        handleFunctionResult(functionCall.id, result);
        return result;
      }
    },
    enableHistory,
    sessionId,
    enableVisual: true, // Enable visual support
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
      
      // Send stream to voice agent
      setVisualStream(stream);
    } catch (error) {
      console.error('Failed to start camera:', error);
    }
  }, [setVisualStream]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraOn(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      // Clear visual stream if no screen share
      if (!isSharing) {
        setVisualStream(null);
      }
    }
  }, [cameraStream, isSharing, setVisualStream]);

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
    const stream = await startScreenShare(options);
    if (stream) {
      setVisualStream(stream);
    }
  }, [startScreenShare, setVisualStream]);

  const handleStopScreenShare = useCallback(async () => {
    await stopScreenShare();
    
    // If camera is on, switch back to camera stream
    if (cameraStream) {
      setVisualStream(cameraStream);
    } else {
      setVisualStream(null);
    }
  }, [stopScreenShare, cameraStream, setVisualStream]);

  // Update video element when streams change
  useEffect(() => {
    if (videoRef.current) {
      if (screenStream) {
        videoRef.current.srcObject = screenStream;
      } else if (cameraStream) {
        videoRef.current.srcObject = cameraStream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [screenStream, cameraStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (isSharing) {
        stopScreenShare();
      }
    };
  }, [isSharing, stopCamera, stopScreenShare]);

  const handleFunctionResult = (functionCallId: string, result: any) => {
    sendFunctionResult(functionCallId, result);
    setPendingFunctionCalls(prev => prev.filter(fc => fc.id !== functionCallId));
  };

  const handleSendText = (text: string) => {
    sendText(text);
  };

  const handleLogin = () => {
    router.push('/login');
  };

  if (authLoading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          <span className="ml-2 text-gray-400">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-12">
          <div className="text-center">
            <LogIn className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Authentication Required</h3>
            <p className="text-gray-400 mb-6">
              Please sign in to use the voice assistant
            </p>
            <Button 
              onClick={handleLogin}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Sign In to Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Voice Agent Card */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-white">
              EVA Voice Assistant
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              {isConnected ? 'Connected' : 'Disconnected'} • {user?.email || 'Guest'}
            </p>
          </div>
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
            <VoiceSettings
              currentVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              isOpen={showSettings}
              onOpenChange={setShowSettings}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
            onConnect={connect}
            onDisconnect={disconnect}
            onStartListening={startListening}
            onStopListening={stopListening}
            onToggleListening={toggleListening}
            hasPermission={hasPermission}
            onRequestPermission={requestPermission}
          />

          {/* Transcription Display */}
          {currentTranscription && (
            <TranscriptionDisplay
              transcription={currentTranscription}
              isInterim={!currentTranscription.isFinal}
            />
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {/* Function Call Handler */}
          {pendingFunctionCalls.length > 0 && (
            <FunctionCallHandler
              functionCalls={pendingFunctionCalls}
              onResult={handleFunctionResult}
            />
          )}
        </CardContent>
      </Card>

      {/* Visual Input Card */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Monitor className="w-5 h-5" />
              Visual Input
            </CardTitle>
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
                "transition-colors",
                isCameraOn ? "bg-green-600 hover:bg-green-700" : ""
              )}
            >
              {isCameraOn ? (
                <Camera className="w-4 h-4" />
              ) : (
                <CameraOff className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Error Display */}
          {screenShareError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{screenShareError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Conversation History */}
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="bg-white/5">
          <TabsTrigger value="history">Conversation History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-4">
          <ConversationHistory
            turns={turns}
            onSendMessage={handleSendText}
          />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          {analytics && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Session Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-gray-400 text-sm">Duration</p>
                    <p className="text-white font-semibold">
                      {Math.floor(analytics.duration / 60000)}m {Math.floor((analytics.duration % 60000) / 1000)}s
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-gray-400 text-sm">Turns</p>
                    <p className="text-white font-semibold">{analytics.turnCount}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-gray-400 text-sm">Words</p>
                    <p className="text-white font-semibold">{analytics.wordCount}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-gray-400 text-sm">Avg Response Time</p>
                    <p className="text-white font-semibold">
                      {(analytics.averageResponseTime / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}