import { EventEmitter } from 'events';

export interface ElevenLabsConfig {
  apiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  defaultVoiceId?: string;
  defaultModelId?: string;
  streamingEnabled?: boolean;
}

export interface TTSRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
  streamingLatencyOptimization?: number;
}

export interface StreamingTTSOptions extends TTSRequest {
  onAudioChunk?: (chunk: ArrayBuffer) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class ElevenLabsClient extends EventEmitter {
  private config: ElevenLabsConfig;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private streamAbortController: AbortController | null = null;

  constructor(config: ElevenLabsConfig) {
    super();
    this.config = {
      defaultVoiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice
      defaultModelId: 'eleven_turbo_v2_5',
      streamingEnabled: true,
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.audioContext = new AudioContext();
    }
  }

  /**
   * Generate speech from text using ElevenLabs API
   */
  async textToSpeech(options: TTSRequest): Promise<Blob> {
    const { text, voiceId, modelId, voiceSettings } = options;

    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      throw new Error('Supabase configuration is required');
    }

    const response = await fetch(`${this.config.supabaseUrl}/functions/v1/elevenlabs-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId || this.config.defaultVoiceId,
        model_id: modelId || this.config.defaultModelId,
        voice_settings: voiceSettings,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`TTS Error: ${error.error || 'Unknown error'}`);
    }

    return await response.blob();
  }

  /**
   * Stream text to speech with real-time playback
   */
  async streamTextToSpeech(options: StreamingTTSOptions): Promise<void> {
    const { text, voiceId, modelId, voiceSettings, onAudioChunk, onError, onComplete } = options;

    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      throw new Error('Supabase configuration is required');
    }

    // Cancel any existing stream
    this.stopStreaming();

    this.streamAbortController = new AbortController();

    try {
      const response = await fetch(`${this.config.supabaseUrl}/functions/v1/elevenlabs-tts-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId || this.config.defaultVoiceId,
          model_id: modelId || this.config.defaultModelId,
          voice_settings: voiceSettings,
          streaming_latency_optimization: options.streamingLatencyOptimization || 3,
        }),
        signal: this.streamAbortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Streaming TTS Error: ${error.error || 'Unknown error'}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let audioBuffer = new Uint8Array(0);

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Process streaming audio chunks
        if (value) {
          // Append to buffer
          const newBuffer = new Uint8Array(audioBuffer.length + value.length);
          newBuffer.set(audioBuffer);
          newBuffer.set(value, audioBuffer.length);
          audioBuffer = newBuffer;

          // Check if we have enough data to process
          if (audioBuffer.length > 8192) { // Process in 8KB chunks
            const chunk = audioBuffer.slice(0, 8192);
            audioBuffer = audioBuffer.slice(8192);

            if (onAudioChunk) {
              onAudioChunk(chunk.buffer);
            }

            // Play the audio chunk
            await this.playAudioChunk(chunk.buffer);
          }
        }
      }

      // Process any remaining audio
      if (audioBuffer.length > 0) {
        if (onAudioChunk) {
          onAudioChunk(audioBuffer.buffer);
        }
        await this.playAudioChunk(audioBuffer.buffer);
      }

      if (onComplete) {
        onComplete();
      }

      this.emit('streamComplete');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.emit('streamCancelled');
        return;
      }

      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown streaming error'));
      }
      this.emit('streamError', error);
      throw error;
    }
  }

  /**
   * Play an audio chunk using Web Audio API
   */
  private async playAudioChunk(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      this.audioQueue.push(audioBuffer);

      if (!this.isPlaying) {
        this.playNextChunk();
      }
    } catch (error) {
      console.error('Error decoding audio:', error);
      this.emit('decodeError', error);
    }
  }

  /**
   * Play the next audio chunk from the queue
   */
  private playNextChunk(): void {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    source.onended = () => {
      this.currentSource = null;
      this.playNextChunk();
    };

    this.currentSource = source;
    source.start();
  }

  /**
   * Stop streaming and clear audio queue
   */
  stopStreaming(): void {
    if (this.streamAbortController) {
      this.streamAbortController.abort();
      this.streamAbortController = null;
    }

    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }

    this.audioQueue = [];
    this.isPlaying = false;
    this.emit('streamStopped');
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<Array<{ voice_id: string; name: string; preview_url?: string }>> {
    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      throw new Error('Supabase configuration is required');
    }

    const response = await fetch(`${this.config.supabaseUrl}/functions/v1/elevenlabs-voices`, {
      headers: {
        'Authorization': `Bearer ${this.config.supabaseAnonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch voices');
    }

    const data = await response.json();
    return data.voices || [];
  }

  /**
   * Get voice settings
   */
  getDefaultVoiceSettings() {
    return {
      stability: 0.5,
      similarityBoost: 0.5,
      style: 0.0,
      useSpeakerBoost: true,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopStreaming();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.removeAllListeners();
  }
}

// Export voice and model constants
export { ELEVENLABS_VOICES, ELEVENLABS_MODELS } from '@/lib/services/elevenlabs-tts';