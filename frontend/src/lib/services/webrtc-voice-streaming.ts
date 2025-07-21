// WebRTC-based real-time voice streaming service
import { EventEmitter } from 'events';

export interface StreamingOptions {
  language?: string;
  voiceId?: string;
  modelId?: string;
  temperature?: number;
}

export interface StreamingState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  response: string;
  latency: number;
}

export class WebRTCVoiceStreamingService extends EventEmitter {
  private pc: RTCPeerConnection | null = null;
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private state: StreamingState = {
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    transcript: '',
    response: '',
    latency: 0
  };
  
  constructor() {
    super();
  }

  // Initialize WebRTC connection for real-time streaming
  async connect(options: StreamingOptions = {}): Promise<void> {
    try {
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      // Initialize WebSocket for signaling
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.openai.com/v1/realtime';
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });
      
      this.ws.onopen = () => {
        this.emit('connected');
        this.state.isConnected = true;
        this.initializeSession(options);
      };
      
      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };
      
      this.ws.onerror = (error) => {
        this.emit('error', error);
      };
      
      this.ws.onclose = () => {
        this.state.isConnected = false;
        this.emit('disconnected');
      };
      
      // Initialize WebRTC peer connection
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      
      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.localStream!);
      });
      
      // Handle remote stream
      this.pc.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.emit('remoteStream', this.remoteStream);
        
        // Connect remote stream to analyser for visualization
        const source = this.audioContext!.createMediaStreamSource(this.remoteStream);
        source.connect(this.analyser!);
      };
      
      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }));
        }
      };
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  // Initialize streaming session
  private initializeSession(options: StreamingOptions): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    this.ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are Eva, a helpful AI assistant. Respond conversationally and concisely.',
        voice: options.voiceId || 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          enabled: true,
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        temperature: options.temperature || 0.8,
        max_response_output_tokens: 4096
      }
    }));
  }
  
  // Handle WebSocket messages
  private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'session.created':
          this.emit('sessionCreated', data.session);
          break;
          
        case 'conversation.item.created':
          if (data.item.role === 'user') {
            this.state.transcript = data.item.content?.[0]?.transcript || '';
            this.emit('transcript', this.state.transcript);
          }
          break;
          
        case 'response.audio_transcript.delta':
          this.state.response += data.delta;
          this.emit('responseUpdate', this.state.response);
          break;
          
        case 'response.audio_transcript.done':
          this.emit('responseComplete', this.state.response);
          this.state.response = '';
          break;
          
        case 'input_audio_buffer.speech_started':
          this.state.isListening = true;
          this.emit('speechStarted');
          break;
          
        case 'input_audio_buffer.speech_stopped':
          this.state.isListening = false;
          this.emit('speechStopped');
          break;
          
        case 'response.audio.delta':
          // Handle audio chunks
          if (data.delta) {
            const audioData = this.base64ToArrayBuffer(data.delta);
            this.emit('audioChunk', audioData);
          }
          break;
          
        case 'response.audio.done':
          this.emit('audioComplete');
          break;
          
        case 'error':
          this.emit('error', new Error(data.error.message));
          break;
      }
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  // Start audio streaming
  startStreaming(): void {
    if (!this.localStream || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    
    // Create audio worklet for real-time processing
    this.processAudioStream();
  }
  
  // Process audio stream with Web Audio API
  private async processAudioStream(): Promise<void> {
    if (!this.audioContext || !this.localStream) return;
    
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64 = this.arrayBufferToBase64(pcm16.buffer);
        
        this.ws.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64
        }));
      }
    };
    
    source.connect(processor);
    processor.connect(this.audioContext.destination);
  }
  
  // Convert float32 to 16-bit PCM
  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return int16Array;
  }
  
  // Convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  // Convert base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  // Get audio visualization data
  getAudioData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(128);
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
  
  // Send text message
  sendMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    }));
  }
  
  // Interrupt current response
  interrupt(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    this.ws.send(JSON.stringify({
      type: 'response.cancel'
    }));
  }
  
  // Disconnect and cleanup
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.state = {
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      transcript: '',
      response: '',
      latency: 0
    };
    
    this.removeAllListeners();
  }
  
  // Get current state
  getState(): StreamingState {
    return { ...this.state };
  }
}

// Singleton instance
export const voiceStreamingService = new WebRTCVoiceStreamingService();