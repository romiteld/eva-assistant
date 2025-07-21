import React, { useEffect, useState, useCallback } from 'react';
import { supabaseVoiceStreaming } from '@/lib/services/supabase-voice-streaming';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleVoiceAgentProps {
  userId?: string;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onFunctionCall?: (call: { name: string; status: string; result: any }) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export default function SimpleVoiceAgent({
  userId = 'default-user',
  onTranscript,
  onResponse,
  onFunctionCall,
  onError,
  className,
}: SimpleVoiceAgentProps) {
  const [connected, setConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Subscribe to SupabaseVoiceStreamingService events
  useEffect(() => {
    const onConnected = (sessionId: string) => {
      setConnected(true);
    };

    const onDisconnected = () => {
      setConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
      setIsProcessing(false);
    };

    const onTranscriptReceived = (text: string) => {
      setTranscript(text);
      onTranscript?.(text);
    };

    const onResponseReceived = (text: string) => {
      setResponse(text);
      onResponse?.(text);
    };

    const onListeningChange = (listening: boolean) => {
      setIsListening(listening);
    };

    const onProcessingStart = () => {
      setIsProcessing(true);
    };

    const onProcessingEnd = () => {
      setIsProcessing(false);
    };

    const onSpeakingStart = () => {
      setIsSpeaking(true);
    };

    const onSpeakingEnd = () => {
      setIsSpeaking(false);
    };

    const onFunctionCallReceived = (call: { name: string; status: string; result: any }) => {
      onFunctionCall?.(call);
    };

    const onErrorReceived = (error: Error) => {
      onError?.(error);
    };

    supabaseVoiceStreaming.on('connected', onConnected);
    supabaseVoiceStreaming.on('disconnected', onDisconnected);
    supabaseVoiceStreaming.on('transcript', onTranscriptReceived);
    supabaseVoiceStreaming.on('response', onResponseReceived);
    supabaseVoiceStreaming.on('listening', onListeningChange);
    supabaseVoiceStreaming.on('processingStart', onProcessingStart);
    supabaseVoiceStreaming.on('processingEnd', onProcessingEnd);
    supabaseVoiceStreaming.on('speakingStart', onSpeakingStart);
    supabaseVoiceStreaming.on('speakingEnd', onSpeakingEnd);
    supabaseVoiceStreaming.on('functionCall', onFunctionCallReceived);
    supabaseVoiceStreaming.on('error', onErrorReceived);

    return () => {
      supabaseVoiceStreaming.off('connected', onConnected);
      supabaseVoiceStreaming.off('disconnected', onDisconnected);
      supabaseVoiceStreaming.off('transcript', onTranscriptReceived);
      supabaseVoiceStreaming.off('response', onResponseReceived);
      supabaseVoiceStreaming.off('listening', onListeningChange);
      supabaseVoiceStreaming.off('processingStart', onProcessingStart);
      supabaseVoiceStreaming.off('processingEnd', onProcessingEnd);
      supabaseVoiceStreaming.off('speakingStart', onSpeakingStart);
      supabaseVoiceStreaming.off('speakingEnd', onSpeakingEnd);
      supabaseVoiceStreaming.off('functionCall', onFunctionCallReceived);
      supabaseVoiceStreaming.off('error', onErrorReceived);
    };
  }, [onTranscript, onResponse, onFunctionCall, onError]);

  // Start/stop session
  const startVoice = useCallback(async () => {
    try {
      await supabaseVoiceStreaming.startSession(userId);
      
      // Apply optimized VAD configuration for faster response
      supabaseVoiceStreaming.setChunkDuration(2000);
      supabaseVoiceStreaming.setVADConfig({
        silenceThreshold: 0.01,
        speechThreshold: 0.015,
        silenceDuration: 4000,
      });
      
      // Calibrate microphone for optimal VAD
      await supabaseVoiceStreaming.calibrateMicrophone();
    } catch (err) {
      console.error('failed to start voice session', err);
      onError?.(err as Error);
    }
  }, [userId, onError]);

  const stopVoice = useCallback(async () => {
    try {
      await supabaseVoiceStreaming.endSession();
    } catch (err) {
      console.error('failed to stop voice session', err);
      onError?.(err as Error);
    }
  }, [onError]);

  const getStatusBadge = () => {
    if (isProcessing) {
      return <Badge variant="secondary" className="animate-pulse">Processing...</Badge>;
    }
    if (isSpeaking) {
      return <Badge variant="default">Speaking</Badge>;
    }
    if (isListening) {
      return <Badge variant="outline">Listening</Badge>;
    }
    if (connected) {
      return <Badge variant="outline">Ready</Badge>;
    }
    return <Badge variant="secondary">Disconnected</Badge>;
  };

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Talk to Eva</span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Control Button */}
        <div className="flex items-center justify-center">
          <Button
            onClick={connected ? stopVoice : startVoice}
            disabled={isProcessing}
            size="lg"
            variant={connected ? "destructive" : "default"}
            className="flex items-center gap-2 min-w-[140px]"
          >
            {connected ? (
              <>
                <PhoneOff className="h-5 w-5" />
                Stop Voice
              </>
            ) : (
              <>
                <Phone className="h-5 w-5" />
                Start Voice
              </>
            )}
          </Button>
        </div>

        {/* Status Indicators */}
        {connected && (
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {isListening ? (
                <Mic className="h-4 w-4 text-green-500 animate-pulse" />
              ) : (
                <MicOff className="h-4 w-4 text-gray-400" />
              )}
              <span className={isListening ? 'text-green-600' : 'text-gray-500'}>
                {isListening ? 'Listening' : 'Not listening'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isSpeaking ? (
                <Volume2 className="h-4 w-4 text-blue-500 animate-pulse" />
              ) : (
                <VolumeX className="h-4 w-4 text-gray-400" />
              )}
              <span className={isSpeaking ? 'text-blue-600' : 'text-gray-500'}>
                {isSpeaking ? 'Speaking' : 'Silent'}
              </span>
            </div>
          </div>
        )}

        {/* Transcript Display */}
        {transcript && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 mb-1">You said:</p>
            <p className="text-gray-800">{transcript}</p>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 mb-1">Eva replied:</p>
            <p className="text-gray-800">{response}</p>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            Eva is thinking...
          </div>
        )}

        {/* Help Text */}
        {!connected && (
          <div className="text-center text-sm text-gray-600 space-y-2">
            <p>Click &quot;Start Voice&quot; to begin talking with Eva.</p>
            <p className="text-xs">Eva can help with tasks, answer questions, and control your dashboard.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}