'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX,
  Loader2,
  Download,
  Settings,
  Mic,
  MicOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioVisualizer } from '@/components/audio/AudioVisualizer';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ElevenLabsPlayerProps {
  text?: string;
  voiceId?: string;
  modelId?: string;
  autoPlay?: boolean;
  showVisualizer?: boolean;
  showSettings?: boolean;
  className?: string;
  onStateChange?: (state: PlayerState) => void;
  onError?: (error: Error) => void;
  streamingEnabled?: boolean;
}

export enum PlayerState {
  IDLE = 'idle',
  LOADING = 'loading',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error',
}

export function ElevenLabsPlayer({
  text = '',
  voiceId,
  modelId,
  autoPlay = false,
  showVisualizer = true,
  showSettings = true,
  className,
  onStateChange,
  onError,
  streamingEnabled = true,
}: ElevenLabsPlayerProps) {
  const [state, setState] = useState<PlayerState>(PlayerState.IDLE);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isStreaming, setIsStreaming] = useState(streamingEnabled);
  const [voiceSettings, setVoiceSettings] = useState({
    stability: 0.5,
    similarityBoost: 0.5,
    style: 0.0,
    useSpeakerBoost: true,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const animationFrameRef = useRef<number>();

  // Update state and notify parent
  const updateState = useCallback((newState: PlayerState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Initialize Web Audio API for visualizer
  useEffect(() => {
    if (!showVisualizer || !audioRef.current) return;

    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      gainNodeRef.current = audioContextRef.current.createGain();
      
      sourceRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audioContextRef.current?.close();
    };
  }, [showVisualizer]);

  // Update frequency data for visualizer
  const updateFrequencyData = useCallback(() => {
    if (!analyserRef.current || state !== PlayerState.PLAYING) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    setFrequencyData(dataArray);

    animationFrameRef.current = requestAnimationFrame(updateFrequencyData);
  }, [state]);

  useEffect(() => {
    if (state === PlayerState.PLAYING && showVisualizer) {
      updateFrequencyData();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [state, showVisualizer, updateFrequencyData]);

  // Handle audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handlePlay = () => updateState(PlayerState.PLAYING);
    const handlePause = () => updateState(PlayerState.PAUSED);
    const handleEnded = () => {
      updateState(PlayerState.STOPPED);
      setProgress(0);
    };

    const handleError = (e: Event) => {
      const error = new Error('Audio playback error');
      updateState(PlayerState.ERROR);
      onError?.(error);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [updateState, onError]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (state === PlayerState.PLAYING) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleStop = () => {
    if (!audioRef.current) return;
    
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    updateState(PlayerState.STOPPED);
    setProgress(0);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current || !duration) return;
    
    const time = (value[0] / 100) * duration;
    audioRef.current.currentTime = time;
    setProgress(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={cn('p-4 space-y-4', className)}>
      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" />

      {/* Visualizer */}
      {showVisualizer && (
        <div className="h-32 bg-gradient-to-b from-background to-muted/20 rounded-lg overflow-hidden">
          <AudioVisualizer
            frequencyData={frequencyData}
            waveformData={null}
            isActive={state === PlayerState.PLAYING}
            type="frequency"
            className="w-full h-full"
          />
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-2">
        <Slider
          value={[progress]}
          onValueChange={handleSeek}
          max={100}
          step={0.1}
          className="cursor-pointer"
          disabled={state === PlayerState.IDLE || state === PlayerState.LOADING}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime((progress / 100) * duration || 0)}</span>
          <span>{formatTime(duration || 0)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Play/Pause button */}
          <Button
            size="icon"
            variant={state === PlayerState.PLAYING ? 'default' : 'outline'}
            onClick={handlePlayPause}
            disabled={state === PlayerState.IDLE || state === PlayerState.LOADING}
          >
            {state === PlayerState.LOADING ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state === PlayerState.PLAYING ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          {/* Stop button */}
          <Button
            size="icon"
            variant="outline"
            onClick={handleStop}
            disabled={state === PlayerState.IDLE || state === PlayerState.STOPPED}
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={handleVolumeChange}
            max={1}
            step={0.01}
            className="w-24"
          />
        </div>

        {/* Settings */}
        {showSettings && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Voice Settings</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="stability">Stability</Label>
                        <span className="text-xs text-muted-foreground">
                          {voiceSettings.stability.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        id="stability"
                        value={[voiceSettings.stability]}
                        onValueChange={(value) => 
                          setVoiceSettings({ ...voiceSettings, stability: value[0] })
                        }
                        max={1}
                        step={0.01}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="similarity">Clarity + Similarity</Label>
                        <span className="text-xs text-muted-foreground">
                          {voiceSettings.similarityBoost.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        id="similarity"
                        value={[voiceSettings.similarityBoost]}
                        onValueChange={(value) => 
                          setVoiceSettings({ ...voiceSettings, similarityBoost: value[0] })
                        }
                        max={1}
                        step={0.01}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="style">Style Exaggeration</Label>
                        <span className="text-xs text-muted-foreground">
                          {voiceSettings.style.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        id="style"
                        value={[voiceSettings.style]}
                        onValueChange={(value) => 
                          setVoiceSettings({ ...voiceSettings, style: value[0] })
                        }
                        max={1}
                        step={0.01}
                        className="mt-1"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="speaker-boost">Speaker Boost</Label>
                      <Switch
                        id="speaker-boost"
                        checked={voiceSettings.useSpeakerBoost}
                        onCheckedChange={(checked) => 
                          setVoiceSettings({ ...voiceSettings, useSpeakerBoost: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="streaming">Enable Streaming</Label>
                      <Switch
                        id="streaming"
                        checked={isStreaming}
                        onCheckedChange={setIsStreaming}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Error state */}
      {state === PlayerState.ERROR && (
        <div className="text-sm text-destructive">
          An error occurred while playing audio.
        </div>
      )}
    </Card>
  );
}