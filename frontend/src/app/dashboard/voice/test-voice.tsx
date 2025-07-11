'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff } from 'lucide-react';

export default function TestVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      setError('');
      return true;
    } catch (err) {
      setError('Microphone permission denied');
      setHasPermission(false);
      return false;
    }
  };

  const testBasicAudio = async () => {
    if (!hasPermission) {
      const granted = await requestMicPermission();
      if (!granted) return;
    }

    setIsRecording(true);
    setTranscript('Recording...');

    // Test Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript;
        setTranscript(transcript);
      };

      recognition.onerror = (event: any) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();

      // Stop after 5 seconds
      setTimeout(() => {
        recognition.stop();
        setIsRecording(false);
      }, 5000);
    } else {
      setError('Speech recognition not supported in this browser');
      setIsRecording(false);
    }
  };

  const testGeminiConnection = async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setError('Gemini API key not configured');
      return;
    }

    try {
      // Test with REST API first
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await response.json();
      
      if (response.ok) {
        setTranscript(`API Connected! Available models: ${data.models?.length || 0}`);
        console.log('Available Gemini models:', data.models);
      } else {
        setError(`API Error: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Voice Feature Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button
            onClick={requestMicPermission}
            variant={hasPermission ? 'default' : 'outline'}
            className="w-full"
          >
            {hasPermission ? '✓ Microphone Permission Granted' : 'Request Microphone Permission'}
          </Button>

          <Button
            onClick={testBasicAudio}
            disabled={isRecording}
            className="w-full"
          >
            {isRecording ? (
              <>
                <Mic className="w-4 h-4 mr-2 animate-pulse" />
                Recording... (5 seconds)
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4 mr-2" />
                Test Basic Voice Recognition
              </>
            )}
          </Button>

          <Button
            onClick={testGeminiConnection}
            variant="secondary"
            className="w-full"
          >
            Test Gemini API Connection
          </Button>
        </div>

        {transcript && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">Transcript:</p>
            <p className="text-sm text-green-700 dark:text-green-300">{transcript}</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Error:</p>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>API Key configured: {process.env.NEXT_PUBLIC_GEMINI_API_KEY ? 'Yes' : 'No'}</p>
          <p>Browser: {typeof window !== 'undefined' ? navigator.userAgent.split(' ').slice(-2).join(' ') : 'N/A'}</p>
          <p>Speech Recognition: {typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) ? 'Supported' : 'Not Supported'}</p>
        </div>
      </CardContent>
    </Card>
  );
}