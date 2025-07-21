'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SimpleVoiceTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const testDirectAPI = async () => {
    setIsLoading(true);
    setStatus('Testing direct ElevenLabs API...');

    try {
      // Test 1: Check if we can reach the test endpoint
      const testResponse = await fetch('/api/elevenlabs/test');
      const testData = await testResponse.json();
      
      if (!testResponse.ok) {
        setStatus(`API Test Failed: ${JSON.stringify(testData, null, 2)}`);
        return;
      }

      setStatus(`API Test Success: ${JSON.stringify(testData, null, 2)}`);

      // Test 2: Try to generate audio directly
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const audioResponse = await fetch(
        `${supabaseUrl}/functions/v1/elevenlabs-tts?text=Hello world&voiceId=rachel`
      );

      if (!audioResponse.ok) {
        const errorText = await audioResponse.text();
        setStatus(prev => `${prev}\n\nEdge Function Error: ${errorText}`);
        return;
      }

      // Success - try to play the audio
      const audioBlob = await audioResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();

      setStatus(prev => `${prev}\n\nSuccess! Audio is playing.`);

    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Simple ElevenLabs Test</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={testDirectAPI}
            disabled={isLoading}
          >
            {isLoading ? 'Testing...' : 'Test ElevenLabs TTS'}
          </Button>
          
          {status && (
            <pre className="mt-4 p-4 bg-gray-100 rounded whitespace-pre-wrap text-sm">
              {status}
            </pre>
          )}

          <div className="mt-4 text-sm text-gray-600">
            <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
            <p>Edge Function: {process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/elevenlabs-tts</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}