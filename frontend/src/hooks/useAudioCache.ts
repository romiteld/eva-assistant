import { useState, useEffect, useRef } from 'react';

interface CachedAudio {
  url: string;
  blob: Blob;
  timestamp: number;
}

export function useAudioCache() {
  const cacheRef = useRef<Map<string, CachedAudio>>(new Map());
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up old cache entries (older than 1 hour)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      
      for (const [key, cached] of cacheRef.current.entries()) {
        if (cached.timestamp < oneHourAgo) {
          URL.revokeObjectURL(cached.url);
          cacheRef.current.delete(key);
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  const cacheAudio = async (key: string, audioData: Blob | ArrayBuffer) => {
    // If already cached, return existing URL
    const existing = cacheRef.current.get(key);
    if (existing) {
      return existing.url;
    }

    // Convert to Blob if needed
    const blob = audioData instanceof Blob 
      ? audioData 
      : new Blob([audioData], { type: 'audio/mpeg' });

    // Create object URL
    const url = URL.createObjectURL(blob);

    // Cache it
    cacheRef.current.set(key, {
      url,
      blob,
      timestamp: Date.now()
    });

    return url;
  };

  const playAudio = async (key: string, audioData?: Blob | ArrayBuffer) => {
    try {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Get or create cached URL
      let url: string;
      if (audioData) {
        url = await cacheAudio(key, audioData);
      } else {
        const cached = cacheRef.current.get(key);
        if (!cached) {
          throw new Error('Audio not found in cache');
        }
        url = cached.url;
      }

      // Create and play audio
      const audio = new Audio(url);
      audioRef.current = audio;
      setIsPlaying(key);

      audio.addEventListener('ended', () => {
        setIsPlaying(null);
        audioRef.current = null;
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(null);
        audioRef.current = null;
      });

      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsPlaying(null);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(null);
    }
  };

  const getCachedUrl = (key: string): string | null => {
    const cached = cacheRef.current.get(key);
    return cached ? cached.url : null;
  };

  const preloadAudio = async (key: string, url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await cacheAudio(key, blob);
    } catch (error) {
      console.error('Failed to preload audio:', error);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Clean up all cached URLs
      for (const cached of cacheRef.current.values()) {
        URL.revokeObjectURL(cached.url);
      }
      cacheRef.current.clear();
    };
  }, []);

  return {
    cacheAudio,
    playAudio,
    stopAudio,
    getCachedUrl,
    preloadAudio,
    isPlaying,
    cacheSize: cacheRef.current.size
  };
}