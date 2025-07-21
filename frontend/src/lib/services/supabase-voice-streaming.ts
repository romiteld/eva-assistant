// Supabase Realtime voice streaming service - Storage-based approach
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/browser';
import { EventEmitter } from 'events';
import { EvaBrain } from '@/lib/services/eva-brain';
import { AudioCacheService } from '@/lib/services/audio-cache';

interface VoiceStreamState {
  sessionId: string;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
}

export class SupabaseVoiceStreamingService extends EventEmitter {
  private channel: RealtimeChannel | null = null;
  private sessionId: string | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastAudioLevel = 0;
  private processingQueue: Array<{ transcript: string; timestamp: number }> = [];
  private isProcessingResponse = false;
  private evaBrain: EvaBrain | null = null;
  private audioCache: AudioCacheService;
  private vadEnabled = true;
  private chunkDuration = 1500; // ms
  private silenceThreshold = 0.02;
  private speechThreshold = 0.05;
  private silenceDuration = 800; // ms

  constructor() {
    super();
    this.audioCache = new AudioCacheService();
  }

  // Get the current access token
  private async getAccessToken(): Promise<string | null> {
    // For voice streaming, use the Supabase anon key like other edge functions
    // This works for both regular Supabase auth and Microsoft OAuth users
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) {
      return anonKey;
    }
    
    // Fallback to session token if anon key not available
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  // Initialize streaming session
  async startSession(userId: string): Promise<string> {
    try {
      console.log('[VoiceStreaming] Starting session for user:', userId);
      
      // Generate a session ID locally
      this.sessionId = crypto.randomUUID();
      this.evaBrain = new EvaBrain(this.sessionId);
      
      // Set up Realtime channel for communication
      this.channel = supabase.channel(`voice_${this.sessionId}`)
        .on('broadcast', { event: 'control' }, (payload) => {
          this.handleControlMessage(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[VoiceStreaming] Channel subscribed');
            this.emit('connected', this.sessionId);
            this.startAudioCapture();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[VoiceStreaming] Channel error');
            this.emit('error', new Error('Failed to subscribe to channel'));
          }
        });

      return this.sessionId;
    } catch (error) {
      console.error('[VoiceStreaming] Start session error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Start continuous audio capture with VAD
  private async startAudioCapture(): Promise<void> {
    try {
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Get user media with echo cancellation
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Optimal for Whisper
        } 
      });

      // Set up audio analysis
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);

      // Set up media recorder for chunked recording
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
        
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          this.audioChunks = [];
          
          if (audioBlob.size > 0) {
            await this.processAudioChunk(audioBlob);
          }
        }
      };

      // Start recording in chunks
      this.startChunkRecording();
      this.isRecording = true;
      
      // Start monitoring audio levels for VAD
      if (this.vadEnabled) {
        this.monitorAudioLevels();
      }
      
      console.log('[VoiceStreaming] Audio capture started');
    } catch (error) {
      console.error('[VoiceStreaming] Audio capture error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Record audio in chunks for real-time processing
  private startChunkRecording(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'recording') return;
    
    this.audioChunks = [];
    this.mediaRecorder.start();
    
    // Stop and restart recording after chunk duration
    setTimeout(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        // Restart after brief pause
        setTimeout(() => {
          if (this.isRecording) {
            this.startChunkRecording();
          }
        }, 50);
      }
    }, this.chunkDuration);
  }

  // Monitor audio levels for voice activity detection
  private monitorAudioLevels(): void {
    if (!this.analyser || !this.isRecording) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Calculate RMS for better voice detection
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength) / 255;
    
    // Emit audio data for visualization
    this.emit('audioData', dataArray);
    
    // Voice activity detection with hysteresis
    if (rms > this.speechThreshold && this.lastAudioLevel <= this.speechThreshold) {
      // Speech started
      this.emit('speechStart');
      this.emit('listening', true);
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (rms < this.silenceThreshold && this.lastAudioLevel >= this.silenceThreshold) {
      // Potential silence started
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.emit('speechEnd');
          this.emit('listening', false);
          this.silenceTimer = null;
        }, this.silenceDuration);
      }
    }
    
    this.lastAudioLevel = rms;
    
    // Continue monitoring
    requestAnimationFrame(() => this.monitorAudioLevels());
  }

  // Process audio chunk with transcription
  private async processAudioChunk(audioBlob: Blob): Promise<void> {
    if (!this.sessionId || audioBlob.size < 1000) return; // Skip very small chunks

    try {
      // Convert blob to base64
      const base64Audio = await this.blobToBase64(audioBlob);
      
      // Get access token
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Call edge function for transcription
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/voice-stream/transcribe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.sessionId,
            audioData: base64Audio,
            language: 'en' // Can be made configurable
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Transcription failed: ${error}`);
      }

      const data = await response.json();
      if (data.transcript && data.transcript.trim()) {
        this.emit('transcript', data.transcript);
        
        // Add to processing queue
        this.processingQueue.push({
          transcript: data.transcript,
          timestamp: Date.now()
        });
        
        this.processNextInQueue();
      }
    } catch (error) {
      console.error('[VoiceStreaming] Audio processing error:', error);
      this.emit('error', error);
    }
  }

  // Process queued transcripts sequentially
  private async processNextInQueue(): Promise<void> {
    if (this.isProcessingResponse || this.processingQueue.length === 0) return;
    
    this.isProcessingResponse = true;
    const { transcript, timestamp } = this.processingQueue.shift()!;
    
    try {
      this.emit('processingStart');
      
      // Process with Eva Brain
      const response = await this.evaBrain!.processVoiceCommand(transcript);
      
      if (response.response) {
        this.emit('response', response.response);
        
        // Generate and play speech
        await this.synthesizeSpeech(response.response);
      }
      
      // Handle any tool executions
      if (response.toolExecutions && response.toolExecutions.length > 0) {
        for (const tool of response.toolExecutions) {
          this.emit('functionCall', {
            name: tool.toolName,
            status: tool.status,
            result: tool.result
          });
        }
      }
      
      this.emit('processingEnd');
    } catch (error) {
      console.error('[VoiceStreaming] Processing error:', error);
      this.emit('error', error);
    } finally {
      this.isProcessingResponse = false;
      // Process next item after a short delay
      setTimeout(() => this.processNextInQueue(), 100);
    }
  }

  // Synthesize speech with caching
  private async synthesizeSpeech(text: string): Promise<void> {
    try {
      this.emit('speakingStart');
      
      const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
      const cacheOptions = { text, voiceId };
      
      // Check cache first
      const cachedUrl = await this.audioCache.checkCache(cacheOptions);
      if (cachedUrl) {
        console.log('[VoiceStreaming] Using cached audio');
        await this.playAudio(cachedUrl);
        return;
      }
      
      // Generate new audio
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            voice_id: voiceId,
            model_id: 'eleven_multilingual_v2'
          })
        }
      );

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Cache for future use if not already cached
        const isCached = response.headers.get('X-Audio-Cached') === 'true';
        if (!isCached) {
          this.audioCache.cacheAudioBlob(audioBlob, cacheOptions);
        }
        
        await this.playAudio(audioUrl);
        URL.revokeObjectURL(audioUrl);
      } else {
        throw new Error('TTS generation failed');
      }
    } catch (error) {
      console.error('[VoiceStreaming] TTS error:', error);
      this.emit('speakingEnd');
    }
  }

  // Play audio with event handling
  private async playAudio(url: string): Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      
      audio.onended = () => {
        this.emit('speakingEnd');
        resolve();
      };
      
      audio.onerror = () => {
        console.error('[VoiceStreaming] Audio playback error');
        this.emit('speakingEnd');
        resolve();
      };
      
      audio.play().catch((error) => {
        console.error('[VoiceStreaming] Audio play error:', error);
        this.emit('speakingEnd');
        resolve();
      });
    });
  }

  // Handle control messages from channel
  private handleControlMessage(payload: any): void {
    console.log('[VoiceStreaming] Control message:', payload);
    // Handle remote control messages if needed
  }

  // Convert blob to base64
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Set VAD configuration
  setVADConfig(config: {
    enabled?: boolean;
    silenceThreshold?: number;
    speechThreshold?: number;
    silenceDuration?: number;
  }): void {
    if (config.enabled !== undefined) this.vadEnabled = config.enabled;
    if (config.silenceThreshold !== undefined) this.silenceThreshold = config.silenceThreshold;
    if (config.speechThreshold !== undefined) this.speechThreshold = config.speechThreshold;
    if (config.silenceDuration !== undefined) this.silenceDuration = config.silenceDuration;
  }

  // End streaming session
  async endSession(): Promise<void> {
    this.isRecording = false;
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    
    this.mediaRecorder = null;
    this.analyser = null;
    this.audioChunks = [];
    this.processingQueue = [];
    this.sessionId = null;
    this.evaBrain = null;
    
    console.log('[VoiceStreaming] Session ended');
    this.emit('disconnected');
  }

  // Get current state
  getState(): VoiceStreamState {
    return {
      sessionId: this.sessionId || '',
      isConnected: !!this.channel,
      isListening: this.lastAudioLevel > this.speechThreshold,
      isSpeaking: false, // Updated via events
      isProcessing: this.isProcessingResponse
    };
  }
}

// Singleton instance
export const supabaseVoiceStreaming = new SupabaseVoiceStreamingService();