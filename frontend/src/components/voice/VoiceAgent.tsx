'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceControl } from './VoiceControl';
import { AudioVisualizer } from './AudioVisualizer';
import { TranscriptionDisplay } from './TranscriptionDisplay';
import { VoiceSettings } from './VoiceSettings';
import { ConversationHistory } from './ConversationHistory';
import { FunctionCallHandler } from './FunctionCallHandler';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { useAuth } from '@/hooks/useAuth';
import { VoiceType, Tool, FunctionCall } from '@/types/voice';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, MicOff, Volume2, AlertCircle, LogIn, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface VoiceAgentProps {
  systemInstructions?: string;
  tools?: Tool[];
  voice?: VoiceType;
  onFunctionCall?: (functionCall: FunctionCall) => Promise<any>;
  enableHistory?: boolean;
  sessionId?: string;
}

export function VoiceAgent({
  systemInstructions = "You are EVA, a helpful AI assistant. Respond naturally and conversationally.",
  tools = [],
  voice = VoiceType.PUCK,
  onFunctionCall,
  enableHistory = false,
  sessionId,
}: VoiceAgentProps) {
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>(voice);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingFunctionCalls, setPendingFunctionCalls] = useState<FunctionCall[]>([]);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

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
    toggleListening,
    sendText,
    sendFunctionResult,
    metrics,
    analytics,
    frequencyData,
    waveformData,
    hasPermission,
    requestPermission,
  } = useVoiceAgent({
    voice: selectedVoice,
    systemInstructions,
    tools,
    enableAnalytics: true,
    enableHistory,
    sessionId,
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

  // Auto-connect on mount
  useEffect(() => {
    if (!isConnected && hasPermission) {
      connect();
    }
  }, [hasPermission, connect, isConnected]);

  // Request permission on first interaction
  const handleFirstInteraction = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (granted) {
        await connect();
      }
    }
  };

  const getStatusBadge = () => {
    const statusMap = {
      idle: { label: 'Ready', variant: 'secondary' as const },
      initializing: { label: 'Initializing', variant: 'outline' as const },
      listening: { label: 'Listening', variant: 'default' as const },
      processing: { label: 'Processing', variant: 'outline' as const },
      speaking: { label: 'Speaking', variant: 'default' as const },
      error: { label: 'Error', variant: 'destructive' as const },
    };

    const status = statusMap[state] || statusMap.idle;
    return <Badge variant={status.variant}>{status.label}</Badge>;
  };

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
            <div className="flex justify-center">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <LogIn className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold">Authentication Required</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Sign in to use EVA&apos;s voice assistant and access all features
            </p>
            <Button 
              onClick={() => router.push('/login')}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Sign in with Email
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                EVA Voice Assistant
              </CardTitle>
              {user && (
                <p className="text-sm text-muted-foreground mt-1">
                  Signed in as {user.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {isConnected && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  {selectedVoice}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {/* Permission Request */}
          {!hasPermission && (
            <Alert className="mb-4">
              <AlertDescription>
                Click the microphone button to enable voice interaction
              </AlertDescription>
            </Alert>
          )}

          {/* Audio Visualizer */}
          <div className="mb-6">
            <AudioVisualizer
              frequencyData={frequencyData}
              waveformData={waveformData}
              isActive={isListening || isSpeaking}
              mode={isListening ? 'input' : 'output'}
            />
          </div>

          {/* Voice Control */}
          <div className="flex justify-center mb-6">
            <VoiceControl
              isListening={isListening}
              isSpeaking={isSpeaking}
              isProcessing={isProcessing}
              isConnected={isConnected}
              onToggleListening={hasPermission ? toggleListening : handleFirstInteraction}
              onConnect={connect}
              onDisconnect={disconnect}
              onStartListening={startListening}
              onStopListening={stopListening}
              hasPermission={hasPermission}
              onRequestPermission={requestPermission}
              audioLevel={metrics.audioLevel}
            />
          </div>

          {/* Current Transcription */}
          {currentTranscription && (
            <div className="mb-4">
              <TranscriptionDisplay
                transcription={currentTranscription}
                isInterim={!currentTranscription.isFinal}
              />
            </div>
          )}

          {/* Pending Function Calls */}
          {pendingFunctionCalls.length > 0 && (
            <div className="mb-4">
              <FunctionCallHandler functionCalls={pendingFunctionCalls} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for additional features */}
      <Tabs defaultValue="conversation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="conversation">
          <ConversationHistory turns={turns} />
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Session Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Audio Level</p>
                  <p className="text-lg font-semibold">{Math.round(metrics.audioLevel * 100)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Speech Probability</p>
                  <p className="text-lg font-semibold">{Math.round(metrics.speechProbability * 100)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Latency</p>
                  <p className="text-lg font-semibold">{metrics.latency}ms</p>
                </div>
                {analytics && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Turn Count</p>
                      <p className="text-lg font-semibold">{analytics.turnCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Response Time</p>
                      <p className="text-lg font-semibold">{Math.round(analytics.averageResponseTime)}ms</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Word Count</p>
                      <p className="text-lg font-semibold">{analytics.wordCount}</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <VoiceSettings
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
            isConnected={isConnected}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}