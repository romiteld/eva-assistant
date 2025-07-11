// Audio Processing Utilities for Voice Agent

export class AudioProcessor {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  
  // Audio format constants for Gemini Live API
  private readonly SAMPLE_RATE = 16000; // 16kHz required by Gemini
  private readonly CHANNELS = 1; // Mono
  private readonly BUFFER_SIZE = 4096;
  
  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
  }

  /**
   * Initialize audio input from microphone
   */
  async initializeAudioInput(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    try {
      const audioConstraints = constraints?.audio || {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: this.SAMPLE_RATE,
        channelCount: this.CHANNELS,
      };

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      // Create audio nodes
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.scriptProcessor = this.audioContext.createScriptProcessor(
        this.BUFFER_SIZE,
        this.CHANNELS,
        this.CHANNELS
      );

      // Connect nodes
      this.source.connect(this.analyser);
      this.analyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      return this.stream;
    } catch (error) {
      throw new Error(`Failed to initialize audio input: ${error}`);
    }
  }

  /**
   * Convert audio buffer to 16-bit PCM format required by Gemini
   */
  convertToPCM16(audioBuffer: Float32Array): Int16Array {
    const pcm16 = new Int16Array(audioBuffer.length);
    
    for (let i = 0; i < audioBuffer.length; i++) {
      // Clamp the value between -1 and 1
      const clamped = Math.max(-1, Math.min(1, audioBuffer[i]));
      // Convert to 16-bit PCM
      pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    
    return pcm16;
  }

  /**
   * Convert PCM16 data to base64 for transmission
   */
  pcm16ToBase64(pcm16: Int16Array): string {
    const uint8Array = new Uint8Array(pcm16.buffer);
    return btoa(String.fromCharCode(...uint8Array));
  }

  /**
   * Convert base64 audio data back to PCM16
   */
  base64ToPCM16(base64: string): Int16Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Int16Array(bytes.buffer);
  }

  /**
   * Start processing audio chunks with callback
   */
  startProcessing(onAudioChunk: (chunk: Int16Array) => void): void {
    if (!this.scriptProcessor) {
      throw new Error('Audio input not initialized');
    }

    this.scriptProcessor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const channelData = inputBuffer.getChannelData(0);
      const pcm16Data = this.convertToPCM16(channelData);
      onAudioChunk(pcm16Data);
    };
  }

  /**
   * Stop audio processing
   */
  stopProcessing(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
    }
  }

  /**
   * Get current audio volume level (0-1)
   */
  getVolumeLevel(): number {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    
    return sum / (dataArray.length * 255);
  }

  /**
   * Get frequency data for visualization
   */
  getFrequencyData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get time domain data for waveform visualization
   */
  getWaveformData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Detect voice activity based on volume and frequency
   */
  detectVoiceActivity(threshold: number = 0.1): boolean {
    const volume = this.getVolumeLevel();
    const frequencyData = this.getFrequencyData();
    
    // Check if volume exceeds threshold
    if (volume < threshold) return false;
    
    // Check for voice frequency range (85Hz - 3000Hz)
    const voiceFreqStart = Math.floor((85 / (this.audioContext.sampleRate / 2)) * frequencyData.length);
    const voiceFreqEnd = Math.floor((3000 / (this.audioContext.sampleRate / 2)) * frequencyData.length);
    
    let voiceEnergy = 0;
    for (let i = voiceFreqStart; i < voiceFreqEnd && i < frequencyData.length; i++) {
      voiceEnergy += frequencyData[i];
    }
    
    const avgVoiceEnergy = voiceEnergy / (voiceFreqEnd - voiceFreqStart);
    return avgVoiceEnergy > 50; // Threshold for voice detection
  }

  /**
   * Create audio buffer for playback
   */
  createAudioBuffer(pcm16Data: Int16Array): AudioBuffer {
    const audioBuffer = this.audioContext.createBuffer(
      this.CHANNELS,
      pcm16Data.length,
      this.SAMPLE_RATE
    );
    
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm16Data.length; i++) {
      channelData[i] = pcm16Data[i] / 0x8000;
    }
    
    return audioBuffer;
  }

  /**
   * Play audio buffer
   */
  async playAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.onended = () => resolve();
      source.start();
    });
  }

  /**
   * Play audio from base64 data
   */
  async playBase64Audio(base64Data: string): Promise<void> {
    const pcm16Data = this.base64ToPCM16(base64Data);
    const audioBuffer = this.createAudioBuffer(pcm16Data);
    await this.playAudioBuffer(audioBuffer);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopProcessing();
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }

  /**
   * Resume audio context if suspended
   */
  async resume(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

/**
 * Audio recording utility
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async startRecording(constraints?: MediaStreamConstraints): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: constraints?.audio || {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
    } catch (error) {
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm;codecs=opus' });
        this.cleanup();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

/**
 * Audio buffer utility for managing audio chunks
 */
export class AudioBufferQueue {
  private buffer: Int16Array[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  add(chunk: Int16Array): void {
    this.buffer.push(chunk);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll(): Int16Array {
    const totalLength = this.buffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Int16Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.buffer) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }
}

/**
 * Noise suppression utilities
 */
export class NoiseSuppressor {
  private noiseProfile: Float32Array | null = null;
  private calibrationSamples: Float32Array[] = [];
  private readonly calibrationDuration = 30; // frames

  calibrate(sample: Float32Array): boolean {
    this.calibrationSamples.push(sample);
    
    if (this.calibrationSamples.length >= this.calibrationDuration) {
      // Calculate average noise profile
      this.noiseProfile = new Float32Array(sample.length);
      
      for (let i = 0; i < sample.length; i++) {
        let sum = 0;
        for (const s of this.calibrationSamples) {
          sum += Math.abs(s[i]);
        }
        this.noiseProfile[i] = sum / this.calibrationSamples.length;
      }
      
      return true; // Calibration complete
    }
    
    return false; // Still calibrating
  }

  suppress(sample: Float32Array): Float32Array {
    if (!this.noiseProfile) {
      return sample; // No noise profile yet
    }
    
    const suppressed = new Float32Array(sample.length);
    
    for (let i = 0; i < sample.length; i++) {
      const signal = Math.abs(sample[i]);
      const noise = this.noiseProfile[i];
      
      // Simple spectral subtraction
      if (signal > noise * 1.5) {
        suppressed[i] = sample[i] * (1 - noise / signal);
      } else {
        suppressed[i] = sample[i] * 0.1; // Attenuate noise
      }
    }
    
    return suppressed;
  }

  reset(): void {
    this.noiseProfile = null;
    this.calibrationSamples = [];
  }
}