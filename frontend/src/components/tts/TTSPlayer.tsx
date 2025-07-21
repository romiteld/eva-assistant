'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play, Pause, Download, Volume2 } from 'lucide-react';
import { ElevenLabsTTSService, ELEVENLABS_VOICES, ELEVENLABS_MODELS, type TTSOptions } from '@/lib/services/elevenlabs-tts';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize TTS service
const ttsService = new ElevenLabsTTSService(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function TTSPlayer() {
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState(ELEVENLABS_VOICES.ADAM);
  const [modelId, setModelId] = useState(ELEVENLABS_MODELS.ELEVEN_TURBO_V2_5);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleTextToSpeech = async () => {
    if (!text.trim()) {
      setError('Please enter some text');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Clean up previous audio
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Generate new audio
      const url = await ttsService.textToSpeechUrl({ text, voiceId, modelId });
      setAudioUrl(url);

      // Create and play audio
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        setError('Failed to play audio');
        setIsPlaying(false);
      });

      await audio.play();
    } catch (err) {
      console.error('TTS Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate speech');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;

    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts-audio-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>ElevenLabs Text-to-Speech</CardTitle>
        <CardDescription>
          Convert text to natural-sounding speech with streaming and caching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="text" className="text-sm font-medium">
            Text to convert
          </label>
          <Textarea
            id="text"
            placeholder="Enter the text you want to convert to speech..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="voice" className="text-sm font-medium">
              Voice
            </label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger id="voice">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ELEVENLABS_VOICES).map(([name, id]) => (
                  <SelectItem key={id} value={id}>
                    {name.charAt(0) + name.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="model" className="text-sm font-medium">
              Model
            </label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ELEVENLABS_MODELS.ELEVEN_TURBO_V2_5}>
                  Eleven Turbo v2.5 (Fastest)
                </SelectItem>
                <SelectItem value={ELEVENLABS_MODELS.ELEVEN_TURBO_V2}>
                  Eleven Turbo v2
                </SelectItem>
                <SelectItem value={ELEVENLABS_MODELS.ELEVEN_MULTILINGUAL_V2}>
                  Eleven Multilingual v2
                </SelectItem>
                <SelectItem value={ELEVENLABS_MODELS.ELEVEN_MONOLINGUAL_V1}>
                  Eleven Monolingual v1
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={handleTextToSpeech}
            disabled={isLoading || !text.trim()}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Volume2 className="mr-2 h-4 w-4" />
                Generate Speech
              </>
            )}
          </Button>

          {audioUrl && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={togglePlayPause}
                disabled={!audioRef.current}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          <p>• Streaming audio with automatic caching for faster subsequent requests</p>
          <p>• Powered by ElevenLabs API through Supabase Edge Functions</p>
        </div>
      </CardContent>
    </Card>
  );
}