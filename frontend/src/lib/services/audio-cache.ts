// Audio caching service using Supabase Storage
import { supabase } from '@/lib/supabase/browser';
import * as crypto from 'crypto';

interface AudioCacheOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  voiceSettings?: any;
}

export class AudioCacheService {
  private bucketName = 'audio';
  private cacheDuration = 60; // seconds for signed URL

  // Generate cache key using MD5 hash
  private generateCacheKey(options: AudioCacheOptions): string {
    const cacheData = {
      text: options.text,
      voiceId: options.voiceId || 'default',
      modelId: options.modelId || 'eleven_multilingual_v2',
      voiceSettings: options.voiceSettings || {}
    };
    
    // Create MD5 hash of the cache data
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(cacheData));
    return hash.digest('hex');
  }

  // Check if audio exists in cache
  async checkCache(options: AudioCacheOptions): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey(options);
      const filePath = `${cacheKey}.mp3`;

      // Try to create a signed URL for the cached audio
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, this.cacheDuration);

      if (error || !data) {
        return null;
      }

      // Verify the file actually exists by trying to fetch it
      const response = await fetch(data.signedUrl, { method: 'HEAD' });
      if (response.ok) {
        return data.signedUrl;
      }

      return null;
    } catch (error) {
      console.error('Cache check error:', error);
      return null;
    }
  }

  // Upload audio stream to cache
  async cacheAudioStream(
    stream: ReadableStream<Uint8Array>, 
    options: AudioCacheOptions
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(options);
      const filePath = `${cacheKey}.mp3`;

      // Convert stream to blob
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      const blob = new Blob(chunks, { type: 'audio/mp3' });

      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, blob, {
          contentType: 'audio/mp3',
          upsert: true
        });

      if (error) {
        console.error('Failed to cache audio:', error);
      } else {
        console.log('Audio cached successfully:', filePath);
      }
    } catch (error) {
      console.error('Audio caching error:', error);
    }
  }

  // Upload audio blob to cache
  async cacheAudioBlob(
    blob: Blob, 
    options: AudioCacheOptions
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(options);
      const filePath = `${cacheKey}.mp3`;

      const { error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, blob, {
          contentType: 'audio/mp3',
          upsert: true
        });

      if (error) {
        console.error('Failed to cache audio:', error);
      } else {
        console.log('Audio cached successfully:', filePath);
      }
    } catch (error) {
      console.error('Audio caching error:', error);
    }
  }

  // Get signed URL for cached audio
  async getCachedUrl(options: AudioCacheOptions): Promise<string | null> {
    return this.checkCache(options);
  }

  // Stream branching utility - splits a stream into two
  static branchStream(stream: ReadableStream<Uint8Array>): [ReadableStream<Uint8Array>, ReadableStream<Uint8Array>] {
    return stream.tee();
  }
}