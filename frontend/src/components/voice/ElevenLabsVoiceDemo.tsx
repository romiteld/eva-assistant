'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Pause, Square, Volume2, Mic, Settings, Download } from 'lucide-react';
import { useElevenLabs } from '@/hooks/useElevenLabs';
import { ElevenLabsPlayer } from './ElevenLabsPlayer';
import { ELEVENLABS_VOICES, ELEVENLABS_MODELS } from '@/lib/elevenlabs/client';
import { VoiceProvider } from '@/types/voice';

export function ElevenLabsVoiceDemo() {
  const [text, setText] = useState('Hello! I am EVA, your AI assistant. How can I help you today?');
  const [mode, setMode] = useState<'simple' | 'streaming' | 'player'>('simple');
  
  const {
    state,
    isLoading,
    isPlaying,
    error,
    voiceId,
    modelId,
    voiceSettings,
    speak,
    speakStreaming,
    play,
    pause,
    stop,
    setVoiceId,
    setModelId,
    updateVoiceSettings,
  } = useElevenLabs({
    defaultVoiceId: ELEVENLABS_VOICES.ADAM,
    defaultModelId: ELEVENLABS_MODELS.ELEVEN_TURBO_V2_5,
    streamingEnabled: true,
    autoPlay: true,
  });

  const handleSimplePlayback = async () => {
    await speak(text);
  };

  const handleStreamingPlayback = async () => {
    await speakStreaming(text, {
      onAudioChunk: (chunk) => {
        console.log('Received audio chunk:', chunk.byteLength);
      },
      onComplete: () => {
        console.log('Streaming complete');
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ElevenLabs Voice Integration</CardTitle>
          <CardDescription>
            High-quality text-to-speech with streaming support
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="simple">Simple TTS</TabsTrigger>
              <TabsTrigger value="streaming">Streaming TTS</TabsTrigger>
              <TabsTrigger value="player">Audio Player</TabsTrigger>
            </TabsList>

            <TabsContent value="simple" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text to speak</label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter text to convert to speech..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Voice</label>
                  <Select value={voiceId} onValueChange={setVoiceId}>
                    <SelectTrigger>
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

                <div>
                  <label className="text-sm font-medium">Model</label>
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ELEVENLABS_MODELS.ELEVEN_TURBO_V2_5}>
                        Turbo v2.5 (Fastest)
                      </SelectItem>
                      <SelectItem value={ELEVENLABS_MODELS.ELEVEN_TURBO_V2}>
                        Turbo v2
                      </SelectItem>
                      <SelectItem value={ELEVENLABS_MODELS.ELEVEN_MULTILINGUAL_V2}>
                        Multilingual v2
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSimplePlayback}
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
                      <Play className="mr-2 h-4 w-4" />
                      Play Audio
                    </>
                  )}
                </Button>

                {isPlaying && (
                  <>
                    <Button variant="outline" size="icon" onClick={pause}>
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={stop}>
                      <Square className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="streaming" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text to stream</label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter text for streaming..."
                  rows={4}
                />
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Streaming Status</span>
                  <Badge variant={isPlaying ? 'default' : 'secondary'}>
                    {isPlaying ? 'Streaming' : 'Ready'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Streaming mode plays audio as it's generated for lower latency
                </p>
              </div>

              <Button
                onClick={handleStreamingPlayback}
                disabled={isLoading || !text.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Streaming...
                  </>
                ) : (
                  <>
                    <Volume2 className="mr-2 h-4 w-4" />
                    Start Streaming
                  </>
                )}
              </Button>

              {isPlaying && (
                <Button variant="destructive" onClick={stop} className="w-full">
                  <Square className="mr-2 h-4 w-4" />
                  Stop Streaming
                </Button>
              )}
            </TabsContent>

            <TabsContent value="player" className="space-y-4">
              <ElevenLabsPlayer
                text={text}
                voiceId={voiceId}
                modelId={modelId}
                showVisualizer={true}
                showSettings={true}
                streamingEnabled={true}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Voice Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">Stability</label>
              <span className="text-xs text-muted-foreground">
                {voiceSettings.stability.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voiceSettings.stability}
              onChange={(e) => updateVoiceSettings({ stability: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">Clarity + Similarity</label>
              <span className="text-xs text-muted-foreground">
                {voiceSettings.similarityBoost.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voiceSettings.similarityBoost}
              onChange={(e) => updateVoiceSettings({ similarityBoost: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Speaker Boost</label>
            <input
              type="checkbox"
              checked={voiceSettings.useSpeakerBoost}
              onChange={(e) => updateVoiceSettings({ useSpeakerBoost: e.target.checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}