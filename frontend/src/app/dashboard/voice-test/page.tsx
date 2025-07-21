'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, Pause, Volume2 } from 'lucide-react';

// Your custom ElevenLabs voice
const VOICE_ID = 'exsUS4vynmxd379XN4yO';
const VOICE_NAME = 'Eva';

export default function VoiceTestPage() {
  const [text, setText] = useState('Hello! This is a test of the ElevenLabs text-to-speech integration with Supabase Edge Functions.');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSpeech = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Stop any existing audio
      if (audio) {
        audio.pause();
        audio.src = '';
      }

      // Get Supabase URL from environment
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      // Call the Edge Function
      const response = await fetch(
        `${supabaseUrl}/functions/v1/elevenlabs-tts?text=${encodeURIComponent(text)}&voiceId=${VOICE_ID}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate speech');
      }

      // Create audio element
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      const newAudio = new Audio(url);
      newAudio.addEventListener('ended', () => setIsPlaying(false));
      setAudio(newAudio);

      // Auto-play
      await newAudio.play();
      setIsPlaying(true);

    } catch (err) {
      console.error('Error generating speech:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate speech');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayback = () => {
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>ElevenLabs Voice Test</CardTitle>
          <CardDescription>
            Test the ElevenLabs text-to-speech integration with Supabase Edge Functions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Text Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Text to speak
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to convert to speech..."
              className="min-h-[100px]"
            />
          </div>

          {/* Voice Info */}
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              Using voice: <span className="font-medium">{VOICE_NAME}</span>
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              onClick={generateSpeech}
              disabled={isLoading || !text.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-2" />
                  Generate Speech
                </>
              )}
            </Button>

            {audio && (
              <Button
                onClick={togglePlayback}
                variant="outline"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Audio Player (hidden) */}
          {audioUrl && (
            <audio
              src={audioUrl}
              controls
              className="w-full mt-4"
            />
          )}

          {/* Debug Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h3 className="text-sm font-medium mb-2">Debug Information</h3>
            <pre className="text-xs text-gray-600">
              {JSON.stringify({
                supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
                edgeFunctionUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
                selectedVoice: VOICE_ID,
                textLength: text.length,
              }, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}