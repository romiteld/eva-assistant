// WebRTC Audio Manager for Voice Agent
// Handles microphone capture, audio streaming, playback, and real-time processing

import { EventEmitter } from 'events';

export interface WebRTCAudioConfig {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  bufferSize?: number;
  vadThreshold?: number;
  silenceDuration?: number;
}

export interface AudioMetrics {
  inputLevel: number;
  outputLevel: number;
  noiseLevel: number;
  voiceActivity: boolean;
  latency: number;
  packetsLost: number;
  jitter: number;
}

export enum AudioEvent {
  STREAM_READY = 'stream:ready',
  STREAM_ERROR = 'stream:error',
  AUDIO_DATA = 'audio:data',
  VOICE_START = 'voice:start',
  VOICE_END = 'voice:end',
  PLAYBACK_START = 'playback:start',
  PLAYBACK_END = 'playback:end',
  METRICS_UPDATE = 'metrics:update',
  PERMISSION_GRANTED = 'permission:granted',
  PERMISSION_DENIED = 'permission:denied',
}

export class WebRTCAudioManager extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  
  // Playback nodes
  private playbackGainNode: GainNode | null = null;
  private playbackQueue: AudioBuffer[] = [];
  private isPlaying = false;
  
  // Configuration
  private config: Required<WebRTCAudioConfig>;
  
  // Metrics
  private metrics: AudioMetrics = {
    inputLevel: 0,
    outputLevel: 0,
    noiseLevel: 0,
    voiceActivity: false,
    latency: 0,
    packetsLost: 0,
    jitter: 0,
  };
  
  // Voice Activity Detection
  private vadHistory: boolean[] = [];
  private readonly VAD_HISTORY_SIZE = 10;
  private calibratedNoiseLevel = 0;
  private isCalibrating = false;
  
  // Visualization data
  private frequencyData: Uint8Array | null = null;
  private waveformData: Uint8Array | null = null;
  
  constructor(config: WebRTCAudioConfig = {}) {
    super();
    
    this.config = {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      bufferSize: 4096,
      vadThreshold: 0.15,
      silenceDuration: 1500,
      ...config,
    };
  }
  
  /**
   * Initialize audio context and request microphone permission
   */
  async initialize(): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate,
      });
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
        },
      });
      
      this.stream = stream;
      this.emit(AudioEvent.PERMISSION_GRANTED);
      
      // Setup audio graph
      await this.setupAudioGraph();
      
      // Start metrics update loop
      this.startMetricsUpdate();
      
      this.emit(AudioEvent.STREAM_READY, stream);
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.emit(AudioEvent.PERMISSION_DENIED, error);
      } else {
        this.emit(AudioEvent.STREAM_ERROR, error);
      }
      
      throw error;
    }
  }
  
  /**
   * Setup audio processing graph
   */
  private async setupAudioGraph(): Promise<void> {
    if (!this.audioContext || !this.stream) {
      throw new Error('Audio context or stream not initialized');
    }
    
    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    // Create source node from microphone
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    
    // Create analyser for visualization and metrics
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    // Create gain node for input volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Create playback gain node
    this.playbackGainNode = this.audioContext.createGain();
    this.playbackGainNode.gain.value = 1.0;
    this.playbackGainNode.connect(this.audioContext.destination);
    
    // Load and create audio worklet for processing
    try {
      // Check if worklet is already registered
      await this.audioContext.audioWorklet.addModule('/audio-processor-worklet.js');
    } catch (error) {
      console.warn('Audio worklet already loaded or failed to load:', error);
    }
    
    this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor-worklet', {
      processorOptions: {
        sampleRate: this.config.sampleRate,
        bufferSize: this.config.bufferSize,
        channels: this.config.channelCount,
      },
    });
    
    // Setup worklet message handling
    this.workletNode.port.onmessage = this.handleWorkletMessage.bind(this);
    
    // Connect audio graph: source -> gain -> analyser -> worklet
    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.workletNode);
    
    // Initialize visualization buffers
    this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.waveformData = new Uint8Array(this.analyserNode.frequencyBinCount);
  }
  
  /**
   * Handle messages from audio worklet
   */
  private handleWorkletMessage(event: MessageEvent): void {
    const { type, data } = event.data;
    
    switch (type) {
      case 'audioData':
        // Emit PCM16 audio data for streaming
        this.emit(AudioEvent.AUDIO_DATA, data.pcm16);
        break;
        
      case 'volumeLevel':
        // Update volume metrics
        this.metrics.inputLevel = data;
        
        // Perform VAD
        const isVoiceActive = this.performVAD(data);
        if (isVoiceActive !== this.metrics.voiceActivity) {
          this.metrics.voiceActivity = isVoiceActive;
          this.emit(isVoiceActive ? AudioEvent.VOICE_START : AudioEvent.VOICE_END);
        }
        break;
    }
  }
  
  /**
   * Perform Voice Activity Detection
   */
  private performVAD(volumeLevel: number): boolean {
    if (this.isCalibrating) {
      return false;
    }
    
    // Add to history
    this.vadHistory.push(volumeLevel > this.calibratedNoiseLevel + this.config.vadThreshold);
    if (this.vadHistory.length > this.VAD_HISTORY_SIZE) {
      this.vadHistory.shift();
    }
    
    // Require majority of recent samples to indicate voice
    const voiceCount = this.vadHistory.filter(v => v).length;
    return voiceCount > this.VAD_HISTORY_SIZE / 2;
  }
  
  /**
   * Calibrate noise level for better VAD
   */
  async calibrateNoiseLevel(duration = 2000): Promise<void> {
    return new Promise((resolve) => {
      this.isCalibrating = true;
      const samples: number[] = [];
      const startTime = Date.now();
      
      const collectSamples = () => {
        if (this.metrics.inputLevel > 0) {
          samples.push(this.metrics.inputLevel);
        }
        
        if (Date.now() - startTime < duration) {
          requestAnimationFrame(collectSamples);
        } else {
          // Calculate average and standard deviation
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          const variance = samples.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / samples.length;
          const stdDev = Math.sqrt(variance);
          
          // Set noise level to average + 2 standard deviations
          this.calibratedNoiseLevel = avg + (2 * stdDev);
          this.metrics.noiseLevel = this.calibratedNoiseLevel;
          
          this.isCalibrating = false;
          resolve();
        }
      };
      
      collectSamples();
    });
  }
  
  /**
   * Start audio capture
   */
  startCapture(callback: (audioData: Int16Array) => void): void {
    if (!this.workletNode) {
      throw new Error('Audio not initialized');
    }
    
    // Subscribe to audio data events
    this.on(AudioEvent.AUDIO_DATA, callback);
    
    // Send start message to worklet
    this.workletNode.port.postMessage({ type: 'start' });
  }
  
  /**
   * Stop audio capture
   */
  stopCapture(): void {
    if (!this.workletNode) {
      return;
    }
    
    // Remove all audio data listeners
    this.removeAllListeners(AudioEvent.AUDIO_DATA);
    
    // Send stop message to worklet
    this.workletNode.port.postMessage({ type: 'stop' });
  }
  
  /**
   * Play audio from base64 encoded data
   */
  async playBase64Audio(base64Audio: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }
    
    // Decode base64 to array buffer
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert to Int16Array
    const int16Data = new Int16Array(bytes.buffer);
    
    // Convert to Float32Array
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768;
    }
    
    // Create audio buffer
    const audioBuffer = this.audioContext.createBuffer(
      1, // mono
      float32Data.length,
      this.config.sampleRate
    );
    audioBuffer.copyToChannel(float32Data, 0);
    
    // Add to playback queue
    this.playbackQueue.push(audioBuffer);
    
    // Start playback if not already playing
    if (!this.isPlaying) {
      this.processPlaybackQueue();
    }
  }
  
  /**
   * Process playback queue
   */
  private async processPlaybackQueue(): Promise<void> {
    if (!this.audioContext || !this.playbackGainNode) {
      return;
    }
    
    if (this.playbackQueue.length === 0) {
      this.isPlaying = false;
      this.emit(AudioEvent.PLAYBACK_END);
      return;
    }
    
    this.isPlaying = true;
    this.emit(AudioEvent.PLAYBACK_START);
    
    const audioBuffer = this.playbackQueue.shift()!;
    
    // Create buffer source
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.playbackGainNode);
    
    // Play and wait for completion
    source.start();
    
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });
    
    // Update output level metric
    this.updateOutputLevel(audioBuffer);
    
    // Continue with next buffer
    this.processPlaybackQueue();
  }
  
  /**
   * Update output level metric from audio buffer
   */
  private updateOutputLevel(audioBuffer: AudioBuffer): void {
    const data = audioBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i]);
    }
    this.metrics.outputLevel = sum / data.length;
  }
  
  /**
   * Start metrics update loop
   */
  private startMetricsUpdate(): void {
    const updateMetrics = () => {
      if (!this.analyserNode) {
        return;
      }
      
      // Update frequency and waveform data
      if (this.frequencyData && this.waveformData) {
        this.analyserNode.getByteFrequencyData(this.frequencyData);
        this.analyserNode.getByteTimeDomainData(this.waveformData);
      }
      
      // Calculate current input level
      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      this.metrics.inputLevel = sum / (dataArray.length * 255);
      
      // Emit metrics update
      this.emit(AudioEvent.METRICS_UPDATE, { ...this.metrics });
      
      // Continue loop
      requestAnimationFrame(updateMetrics);
    };
    
    updateMetrics();
  }
  
  /**
   * Set input gain
   */
  setInputGain(gain: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(2, gain));
    }
  }
  
  /**
   * Set output gain
   */
  setOutputGain(gain: number): void {
    if (this.playbackGainNode) {
      this.playbackGainNode.gain.value = Math.max(0, Math.min(2, gain));
    }
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): AudioMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get frequency data for visualization
   */
  getFrequencyData(): Uint8Array | null {
    return this.frequencyData;
  }
  
  /**
   * Get waveform data for visualization
   */
  getWaveformData(): Uint8Array | null {
    return this.waveformData;
  }
  
  /**
   * Check if microphone permission is granted
   */
  async checkPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state === 'granted';
    } catch (error) {
      console.error('Failed to check microphone permission:', error);
      return false;
    }
  }
  
  /**
   * Update audio constraints
   */
  async updateConstraints(constraints: MediaTrackConstraints): Promise<void> {
    if (!this.stream) {
      throw new Error('No active stream');
    }
    
    const audioTracks = this.stream.getAudioTracks();
    for (const track of audioTracks) {
      await track.applyConstraints(constraints);
    }
  }
  
  /**
   * Get supported constraints
   */
  getSupportedConstraints(): MediaTrackSupportedConstraints {
    return navigator.mediaDevices.getSupportedConstraints();
  }
  
  /**
   * Cleanup and release resources
   */
  dispose(): void {
    // Stop capture
    this.stopCapture();
    
    // Disconnect nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.playbackGainNode) {
      this.playbackGainNode.disconnect();
      this.playbackGainNode = null;
    }
    
    // Stop media stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Clear data
    this.frequencyData = null;
    this.waveformData = null;
    this.playbackQueue = [];
    
    // Remove all listeners
    this.removeAllListeners();
  }
}