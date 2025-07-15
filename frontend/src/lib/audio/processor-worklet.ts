// Audio Processing Module with AudioWorkletNode
// Replaces deprecated ScriptProcessorNode with modern AudioWorkletNode

export class AudioProcessor {
  private audioContext: AudioContext;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyser: AnalyserNode;
  private stream: MediaStream | null = null;
  private isProcessing = false;
  private onAudioChunkCallback: ((chunk: Int16Array) => void) | null = null;
  
  // Configuration
  private readonly SAMPLE_RATE = 16000; // Required by Gemini API
  private readonly BUFFER_SIZE = 4096;
  private readonly CHANNELS = 1; // Mono
  private readonly FFT_SIZE = 2048;
  
  // Audio settings
  private volumeThreshold = 0.1;
  private noiseGate = 0.02;
  private calibratedNoiseLevel = 0;
  
  constructor() {
    // Don't create AudioContext here - wait for user interaction
    this.audioContext = null as any;
    this.analyser = null as any;
  }

  /**
   * Initialize audio context on first user interaction
   */
  private async ensureAudioContext(): Promise<void> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Setup analyser for visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.8;
    }
    
    // Resume context if suspended (happens on some browsers)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Initialize audio input and load worklet
   */
  async initializeAudioInput(stream: MediaStream): Promise<void> {
    this.stream = stream;
    
    // Ensure audio context is created and resumed
    await this.ensureAudioContext();
    
    // Load the audio worklet module
    try {
      await this.audioContext.audioWorklet.addModule('/audio-processor-worklet.js');
    } catch (error) {
      console.error('Failed to load audio worklet:', error);
      // Try to recover by recreating the context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      await this.audioContext.resume();
      
      // Try once more
      await this.audioContext.audioWorklet.addModule('/audio-processor-worklet.js');
    }
    
    // Create source node from stream
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    
    // Create worklet node
    this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor-worklet', {
      processorOptions: {
        sampleRate: this.SAMPLE_RATE,
        bufferSize: this.BUFFER_SIZE,
        channels: this.CHANNELS
      }
    });
    
    // Setup message handling from worklet
    this.workletNode.port.onmessage = (event) => {
      if (event.data.type === 'audioData' && this.onAudioChunkCallback) {
        const pcm16Data = new Int16Array(event.data.pcm16);
        this.onAudioChunkCallback(pcm16Data);
      }
    };
    
    // Connect audio nodes
    this.sourceNode.connect(this.analyser);
    this.sourceNode.connect(this.workletNode);
    // Don't connect to destination to avoid echo
  }

  /**
   * Start audio processing
   */
  startProcessing(onAudioChunk: (chunk: Int16Array) => void): void {
    if (!this.workletNode) {
      throw new Error('Audio input not initialized');
    }
    
    this.onAudioChunkCallback = onAudioChunk;
    this.isProcessing = true;
    
    // Send start message to worklet
    this.workletNode.port.postMessage({ type: 'start' });
  }

  /**
   * Stop audio processing
   */
  stopProcessing(): void {
    this.isProcessing = false;
    this.onAudioChunkCallback = null;
    
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'stop' });
    }
  }

  /**
   * Get current audio volume level (0-1)
   */
  getVolumeLevel(): number {
    if (!this.analyser) return 0;
    
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
    if (!this.analyser) return new Uint8Array(0);
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get time domain data for waveform visualization
   */
  getWaveformData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Check if voice is detected using frequency analysis
   */
  isVoiceDetected(): boolean {
    if (!this.audioContext || !this.analyser) return false;
    
    const frequencyData = this.getFrequencyData();
    const sampleRate = this.audioContext.sampleRate;
    const nyquist = sampleRate / 2;
    
    // Voice frequency range (85Hz - 3000Hz)
    const minVoiceFreq = 85;
    const maxVoiceFreq = 3000;
    const minBin = Math.floor(minVoiceFreq / nyquist * frequencyData.length);
    const maxBin = Math.ceil(maxVoiceFreq / nyquist * frequencyData.length);
    
    // Calculate energy in voice frequency range
    let voiceEnergy = 0;
    for (let i = minBin; i < maxBin && i < frequencyData.length; i++) {
      voiceEnergy += frequencyData[i];
    }
    
    const avgEnergy = voiceEnergy / (maxBin - minBin);
    
    // Voice detection threshold
    return avgEnergy > 50;
  }

  /**
   * Calibrate noise level for better voice detection
   */
  async calibrateNoiseLevel(duration: number = 2000): Promise<void> {
    return new Promise((resolve) => {
      const samples: number[] = [];
      const startTime = Date.now();
      
      const collectSamples = () => {
        const level = this.getVolumeLevel();
        samples.push(level);
        
        if (Date.now() - startTime < duration) {
          requestAnimationFrame(collectSamples);
        } else {
          // Calculate average noise level
          const avgNoise = samples.reduce((a, b) => a + b, 0) / samples.length;
          this.calibratedNoiseLevel = avgNoise;
          this.noiseGate = avgNoise * 1.5; // Set noise gate slightly above average
          resolve();
        }
      };
      
      collectSamples();
    });
  }

  /**
   * Apply noise suppression configuration
   */
  setNoiseSuppression(enabled: boolean): void {
    if (this.stream) {
      const audioTracks = this.stream.getAudioTracks();
      audioTracks.forEach(track => {
        const constraints = track.getConstraints();
        track.applyConstraints({
          ...constraints,
          noiseSuppression: enabled,
          echoCancellation: enabled,
          autoGainControl: enabled
        });
      });
    }
  }

  /**
   * Set volume threshold for voice detection
   */
  setVolumeThreshold(threshold: number): void {
    this.volumeThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Clean up audio resources
   */
  dispose(): void {
    this.stopProcessing();
    
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  /**
   * Convert base64 to Int16Array (for playing back Gemini audio)
   */
  static base64ToInt16Array(base64: string): Int16Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }

  /**
   * Convert Int16Array to base64 (for sending to Gemini)
   */
  static int16ArrayToBase64(int16Array: Int16Array): string {
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Play audio from Int16Array
   */
  async playAudio(audioData: Int16Array): Promise<void> {
    // Ensure audio context is initialized
    await this.ensureAudioContext();
    
    // Convert Int16Array to Float32Array for Web Audio API
    const float32Data = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      float32Data[i] = audioData[i] / 32768; // Convert to -1 to 1 range
    }
    
    // Create audio buffer
    const audioBuffer = this.audioContext.createBuffer(
      1, // mono
      float32Data.length,
      this.SAMPLE_RATE
    );
    
    // Copy data to buffer
    audioBuffer.copyToChannel(float32Data, 0);
    
    // Create and play buffer source
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
    
    // Return promise that resolves when playback ends
    return new Promise((resolve) => {
      source.onended = () => resolve();
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopProcessing();
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }

  /**
   * Play base64 encoded audio
   */
  async playBase64Audio(base64Audio: string): Promise<void> {
    const audioData = AudioProcessor.base64ToInt16Array(base64Audio);
    return this.playAudio(audioData);
  }

  /**
   * Resume audio context
   */
  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Convert PCM16 to base64
   */
  pcm16ToBase64(pcm16Data: Int16Array): string {
    return AudioProcessor.int16ArrayToBase64(pcm16Data);
  }

  /**
   * Detect voice activity
   */
  detectVoiceActivity(): boolean {
    return this.isVoiceDetected();
  }
}