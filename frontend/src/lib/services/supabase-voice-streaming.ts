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
  private lastTranscript = '';
  private lastTranscriptTime = 0;
  private evaBrain: EvaBrain | null = null;
  private audioCache: AudioCacheService;
  private vadEnabled = true;
  private chunkDuration = 2000; // ms - send audio every 2 seconds for faster response
  private silenceThreshold = 0.01; // Raised to avoid treating low-level noise as speech
  private speechThreshold = 0.015; // Slightly higher threshold to prevent early triggers
  private silenceDuration = 4000; // ms - wait 4 seconds of silence before ending speech

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
      
      // Skip Realtime channel setup - not essential for voice streaming
      // Directly start audio capture instead
      console.log('[VoiceStreaming] Session started, initializing audio capture');
      this.emit('connected', this.sessionId);
      
      // Start audio capture directly
      await this.startAudioCapture();

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
    if (!this.sessionId || audioBlob.size < 1000) return; // Lower threshold to capture more audio

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
        const transcript = data.transcript.trim();
        const currentTime = Date.now();
        
        console.log('[VoiceStreaming] Raw transcript received:', transcript);
        
        // Common false positives from Whisper when there's silence or noise
        const falsePositives = ['you', 'You', 'Thank you', 'Thank you.', 'Thank you for watching.', 
                               'Thanks for watching', 'the', 'The', '.', '..', '...', 'Bye.', 
                               'Bye', 'Goodbye', 'Please subscribe', 'Like and subscribe'];
        
        // Check if it's a false positive
        const isFalsePositive = falsePositives.includes(transcript) || 
                               transcript.toLowerCase().includes('thank you for watching') ||
                               transcript.toLowerCase().includes('subscribe');
        
        // Avoid duplicate processing of similar transcripts within 3 seconds
        const isDuplicate = transcript === this.lastTranscript && 
                           (currentTime - this.lastTranscriptTime) < 3000;
        
        if (!isDuplicate && !isFalsePositive && transcript.length > 2) {
          // Only emit transcript if it's meaningful
          if (transcript.length > 4 || transcript.split(' ').length > 1) {
            this.emit('transcript', transcript);
            
            // Add to processing queue
            this.processingQueue.push({
              transcript: transcript,
              timestamp: currentTime
            });
            
            this.lastTranscript = transcript;
            this.lastTranscriptTime = currentTime;
            
            this.processNextInQueue();
          }
        } else {
          console.log('[VoiceStreaming] Filtered transcript:', transcript, 
                     { isDuplicate, isFalsePositive, length: transcript.length });
        }
      }
    } catch (error) {
      console.error('[VoiceStreaming] Audio processing error:', error);
      this.emit('error', error);
    }
  }

  // Process queued transcripts sequentially with optional attachments
  private async processNextInQueue(attachments?: Array<{
    type: 'image' | 'document';
    content: string;
    mimeType: string;
    fileName?: string;
  }>): Promise<void> {
    if (this.isProcessingResponse || this.processingQueue.length === 0) return;
    
    this.isProcessingResponse = true;
    const { transcript, timestamp } = this.processingQueue.shift()!;
    
    try {
      this.emit('processingStart');
      
      // Process with Eva Brain including attachments
      const response = await this.evaBrain!.processVoiceCommand(transcript, attachments);
      
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

  // Note: Realtime control messages removed for simplicity

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

  // Process transcript with attachments
  async processTranscriptWithAttachments(
    transcript: string,
    attachments?: Array<{
      type: 'image' | 'document';
      content: string;
      mimeType: string;
      fileName?: string;
    }>
  ): Promise<void> {
    if (!this.sessionId) return;

    // Add to processing queue with attachments
    this.processingQueue.push({
      transcript,
      timestamp: Date.now()
    });

    // Process with attachments
    await this.processNextInQueue(attachments);
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

  // Set chunk duration for audio recording
  setChunkDuration(milliseconds: number): void {
    if (milliseconds > 0 && milliseconds <= 10000) { // Max 10 seconds for safety
      this.chunkDuration = milliseconds;
      console.log('[VoiceStreaming] Chunk duration set to:', milliseconds, 'ms');
    }
  }

  // Calibrate microphone to adjust VAD thresholds based on ambient noise
  async calibrateMicrophone(durationMs = 2000): Promise<void> {
    if (!this.analyser || !this.audioContext) {
      throw new Error('Audio not initialized. Start session first.');
    }

    console.log('[VoiceStreaming] Starting microphone calibration for', durationMs, 'ms');
    
    return new Promise((resolve) => {
      const samples: number[] = [];
      const startTime = Date.now();
      const bufferLength = this.analyser!.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const collectSamples = () => {
        this.analyser!.getByteFrequencyData(dataArray);
        
        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength) / 255;
        
        if (rms > 0) {
          samples.push(rms);
        }
        
        if (Date.now() - startTime < durationMs) {
          requestAnimationFrame(collectSamples);
        } else {
          // Calculate average and standard deviation
          if (samples.length > 0) {
            const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
            const variance = samples.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / samples.length;
            const stdDev = Math.sqrt(variance);
            
            // Set thresholds based on noise floor
            // Silence threshold = average + 1 standard deviation
            // Speech threshold = average + 2.5 standard deviations
            const newSilenceThreshold = Math.max(0.005, avg + stdDev);
            const newSpeechThreshold = Math.max(0.01, avg + (2.5 * stdDev));
            
            this.silenceThreshold = Math.min(newSilenceThreshold, 0.02); // Cap at reasonable levels
            this.speechThreshold = Math.min(newSpeechThreshold, 0.03);
            
            console.log('[VoiceStreaming] Calibration complete:', {
              noiseFloor: avg.toFixed(4),
              stdDev: stdDev.toFixed(4),
              silenceThreshold: this.silenceThreshold.toFixed(4),
              speechThreshold: this.speechThreshold.toFixed(4)
            });
          } else {
            console.warn('[VoiceStreaming] No samples collected during calibration');
          }
          
          resolve();
        }
      };
      
      collectSamples();
    });
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
    
    // Channel cleanup no longer needed since we removed Realtime dependency
    this.channel = null;
    
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
      isConnected: !!this.sessionId, // Connected if we have an active session
      isListening: this.lastAudioLevel > this.speechThreshold,
      isSpeaking: false, // Updated via events
      isProcessing: this.isProcessingResponse
    };
  }
}

// Singleton instance
export const supabaseVoiceStreaming = new SupabaseVoiceStreamingService();