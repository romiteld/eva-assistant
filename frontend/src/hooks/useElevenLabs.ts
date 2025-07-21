'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ElevenLabsClient, TTSRequest, StreamingTTSOptions } from '@/lib/elevenlabs/client';
import { PlayerState } from '@/components/voice/ElevenLabsPlayer';

export interface UseElevenLabsOptions {
  apiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  defaultVoiceId?: string;
  defaultModelId?: string;
  streamingEnabled?: boolean;
  autoPlay?: boolean;
}

export interface UseElevenLabsReturn {
  // State
  state: PlayerState;
  isLoading: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  error: Error | null;
  
  // Audio state
  audioUrl: string | null;
  audioElement: HTMLAudioElement | null;
  duration: number;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  
  // Voice settings
  voiceId: string;
  modelId: string;
  voiceSettings: VoiceSettings;
  
  // Methods
  speak: (text: string, options?: Partial<TTSRequest>) => Promise<void>;
  speakStreaming: (text: string, options?: Partial<StreamingTTSOptions>) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setVoiceId: (voiceId: string) => void;
  setModelId: (modelId: string) => void;
  updateVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  cleanup: () => void;
  
  // Voice list
  getVoices: () => Promise<Voice[]>;
}

export interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export interface Voice {
  voice_id: string;
  name: string;
  preview_url?: string;
}

export function useElevenLabs(options: UseElevenLabsOptions = {}): UseElevenLabsReturn {
  // Initialize client
  const clientRef = useRef<ElevenLabsClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // State
  const [state, setState] = useState<PlayerState>(PlayerState.IDLE);
  const [error, setError] = useState<Error | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // Voice settings
  const [voiceId, setVoiceId] = useState(options.defaultVoiceId || 'pNInz6obpgDQGcFmaJgB');
  const [modelId, setModelId] = useState(options.defaultModelId || 'eleven_turbo_v2_5');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    stability: 0.5,
    similarityBoost: 0.5,
    style: 0.0,
    useSpeakerBoost: true,
  });

  // Initialize client
  useEffect(() => {
    const client = new ElevenLabsClient({
      apiKey: options.apiKey,
      supabaseUrl: options.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: options.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      defaultVoiceId: voiceId,
      defaultModelId: modelId,
      streamingEnabled: options.streamingEnabled ?? true,
    });

    clientRef.current = client;

    // Set up event listeners
    client.on('streamComplete', () => {
      setState(PlayerState.STOPPED);
    });

    client.on('streamError', (error) => {
      setError(error);
      setState(PlayerState.ERROR);
    });

    client.on('streamStopped', () => {
      setState(PlayerState.STOPPED);
    });

    return () => {
      client.dispose();
    };
  }, [options.apiKey, options.supabaseUrl, options.supabaseAnonKey, voiceId, modelId, options.streamingEnabled]);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handlePlay = () => setState(PlayerState.PLAYING);
    const handlePause = () => setState(PlayerState.PAUSED);
    const handleEnded = () => {
      setState(PlayerState.STOPPED);
      setCurrentTime(0);
    };
    const handleError = () => {
      setState(PlayerState.ERROR);
      setError(new Error('Audio playback error'));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Cleanup audio URL when changed
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Methods
  const speak = useCallback(async (text: string, speakOptions?: Partial<TTSRequest>) => {
    if (!clientRef.current) {
      setError(new Error('ElevenLabs client not initialized'));
      return;
    }

    try {
      setState(PlayerState.LOADING);
      setError(null);

      // Clean up previous audio
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      // Generate speech
      const blob = await clientRef.current.textToSpeech({
        text,
        voiceId: speakOptions?.voiceId || voiceId,
        modelId: speakOptions?.modelId || modelId,
        voiceSettings: speakOptions?.voiceSettings || voiceSettings,
      });

      // Create audio URL and set to audio element
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.src = url;
        
        if (options.autoPlay) {
          await audioRef.current.play();
        } else {
          setState(PlayerState.IDLE);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate speech'));
      setState(PlayerState.ERROR);
    }
  }, [voiceId, modelId, voiceSettings, audioUrl, options.autoPlay]);

  const speakStreaming = useCallback(async (text: string, streamOptions?: Partial<StreamingTTSOptions>) => {
    if (!clientRef.current) {
      setError(new Error('ElevenLabs client not initialized'));
      return;
    }

    try {
      setState(PlayerState.LOADING);
      setError(null);

      await clientRef.current.streamTextToSpeech({
        text,
        voiceId: streamOptions?.voiceId || voiceId,
        modelId: streamOptions?.modelId || modelId,
        voiceSettings: streamOptions?.voiceSettings || voiceSettings,
        ...streamOptions,
      });

      setState(PlayerState.PLAYING);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to stream speech'));
      setState(PlayerState.ERROR);
    }
  }, [voiceId, modelId, voiceSettings]);

  const play = useCallback(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
    }
  }, [audioUrl]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (clientRef.current) {
      clientRef.current.stopStreaming();
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (clientRef.current) {
      clientRef.current.stopStreaming();
    }
    setState(PlayerState.STOPPED);
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const updateVoiceSettings = useCallback((settings: Partial<VoiceSettings>) => {
    setVoiceSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const getVoices = useCallback(async () => {
    if (!clientRef.current) {
      throw new Error('ElevenLabs client not initialized');
    }
    return await clientRef.current.getVoices();
  }, []);

  const cleanup = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (clientRef.current) {
      clientRef.current.stopStreaming();
    }
    setState(PlayerState.IDLE);
    setError(null);
    setAudioUrl(null);
    setCurrentTime(0);
  }, [audioUrl]);

  return {
    // State
    state,
    isLoading: state === PlayerState.LOADING,
    isPlaying: state === PlayerState.PLAYING,
    isPaused: state === PlayerState.PAUSED,
    error,
    
    // Audio state
    audioUrl,
    audioElement: audioRef.current,
    duration,
    currentTime,
    volume,
    isMuted,
    
    // Voice settings
    voiceId,
    modelId,
    voiceSettings,
    
    // Methods
    speak,
    speakStreaming,
    play,
    pause,
    stop,
    seek,
    setVolume,
    toggleMute,
    setVoiceId,
    setModelId,
    updateVoiceSettings,
    cleanup,
    getVoices,
  };
}