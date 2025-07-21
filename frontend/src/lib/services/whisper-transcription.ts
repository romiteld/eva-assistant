// OpenAI Whisper API integration for speech-to-text transcription
import { EventEmitter } from 'events';

export interface TranscriptionOptions {
  language?: string; // ISO 639-1 code (e.g., 'en', 'es', 'fr')
  temperature?: number; // 0-1, higher = more creative
  prompt?: string; // Context to help with transcription
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
}

export class WhisperTranscriptionService extends EventEmitter {
  private apiKey: string;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;

  constructor() {
    super();
    this.apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY!;
    
    if (!this.apiKey) {
      console.error('OpenAI API key not found. Please set NEXT_PUBLIC_OPENAI_API_KEY environment variable.');
    }
  }

  // Initialize audio context and media stream
  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    this.audioContext = new AudioContext();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.emit('audio_chunk', event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        
        if (audioBlob.size > 0) {
          await this.transcribeBlob(audioBlob);
        } else {
          console.warn('Audio blob is empty, skipping transcription');
          this.emit('transcription_complete', { text: '', language: 'en', duration: 0 });
        }
      };

      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Start recording audio
  startRecording(): void {
    if (!this.mediaRecorder || this.isRecording) return;

    this.audioChunks = [];
    this.mediaRecorder.start(250); // Collect data more frequently for better audio capture
    this.isRecording = true;
    this.emit('recording_started');
  }

  // Stop recording and transcribe
  async stopRecording(): Promise<TranscriptionResult> {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error('Not recording');
    }

    return new Promise((resolve) => {
      this.once('transcription_complete', resolve);
      this.mediaRecorder!.stop();
      this.isRecording = false;
      this.emit('recording_stopped');
    });
  }

  // Transcribe audio blob using Whisper API
  private async transcribeBlob(audioBlob: Blob, options?: TranscriptionOptions): Promise<void> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      if (audioBlob.size === 0) {
        throw new Error('Audio blob is empty');
      }

      this.emit('transcription_started');

      // Convert blob to File for FormData
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      
      if (options?.language) {
        formData.append('language', options.language);
      }
      
      if (options?.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }
      
      if (options?.prompt) {
        formData.append('prompt', options.prompt);
      }

      // Include timestamps for segments
      formData.append('response_format', 'verbose_json');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed (${response.status}): ${response.statusText}. Details: ${errorText}`);
      }

      const data = await response.json();
      
      const result: TranscriptionResult = {
        text: data.text,
        language: data.language,
        duration: data.duration,
        segments: data.segments?.map((seg: any) => ({
          text: seg.text,
          start: seg.start,
          end: seg.end
        }))
      };

      this.emit('transcription_complete', result);
    } catch (error) {
      this.emit('transcription_error', error);
      throw error;
    }
  }

  // Stream transcription for real-time results
  async streamTranscription(options?: TranscriptionOptions): Promise<void> {
    if (!this.mediaRecorder) {
      await this.initialize();
    }

    let audioBuffer: Blob[] = [];
    let transcriptionTimeout: NodeJS.Timeout;
    
    const processAudioBuffer = async () => {
      if (audioBuffer.length === 0) return;
      
      const audioBlob = new Blob(audioBuffer, { type: 'audio/webm' });
      audioBuffer = [];
      
      try {
        const formData = new FormData();
        formData.append('file', new File([audioBlob], 'audio.webm', { type: 'audio/webm' }));
        formData.append('model', 'whisper-1');
        
        if (options?.language) {
          formData.append('language', options.language);
        }

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          this.emit('partial_transcription', data.text);
        }
      } catch (error) {
        this.emit('stream_error', error);
      }
    };

    // Collect audio chunks and process periodically
    this.on('audio_chunk', (chunk: Blob) => {
      audioBuffer.push(chunk);
      
      // Clear existing timeout
      if (transcriptionTimeout) {
        clearTimeout(transcriptionTimeout);
      }
      
      // Set new timeout to process after 2 seconds of silence
      transcriptionTimeout = setTimeout(processAudioBuffer, 2000);
    });

    this.startRecording();
  }

  // Transcribe a pre-recorded audio file
  async transcribeFile(file: File, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    
    if (options?.language) {
      formData.append('language', options.language);
    }
    
    if (options?.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }
    
    if (options?.prompt) {
      formData.append('prompt', options.prompt);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      text: data.text,
      language: data.language,
      duration: data.duration,
      segments: data.segments?.map((seg: any) => ({
        text: seg.text,
        start: seg.start,
        end: seg.end
      }))
    };
  }

  // Clean up resources
  destroy(): void {
    if (this.mediaRecorder) {
      if (this.isRecording) {
        this.mediaRecorder.stop();
      }
      
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.removeAllListeners();
  }

  // Getters
  get recording(): boolean {
    return this.isRecording;
  }
}

// Singleton instance
export const whisperService = new WhisperTranscriptionService();