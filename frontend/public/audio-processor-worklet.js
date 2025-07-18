// Enhanced Audio Worklet Processor for Gemini Live API
// Handles real-time audio processing with 16kHz mono PCM16 format

class AudioProcessorWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Audio format constants for Gemini Live API
    this.SAMPLE_RATE = 16000; // 16kHz required by Gemini
    this.CHANNELS = 1; // Mono
    this.BUFFER_SIZE = 4096;
    
    // Internal buffer for accumulating samples
    this.buffer = [];
    this.bufferSize = 0;
    
    // Processing state
    this.isProcessing = false;
    
    // Voice Activity Detection
    this.vadThreshold = 0.1;
    this.vadHistory = [];
    this.vadHistorySize = 10;
    
    // Noise gate and suppression
    this.noiseFloor = 0.01;
    this.noiseGate = 0.02;
    
    // Metrics
    this.metrics = {
      inputLevel: 0,
      outputLevel: 0,
      noiseLevel: 0,
      voiceActivity: false,
      packetsProcessed: 0,
    };
    
    // Initialize message port
    this.port.onmessage = this.handleMessage.bind(this);
  }
  
  /**
   * Handle messages from the main thread
   */
  handleMessage(event) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'start':
        this.isProcessing = true;
        this.metrics.packetsProcessed = 0;
        break;
        
      case 'stop':
        this.isProcessing = false;
        break;
        
      case 'configure':
        // Handle configuration updates
        if (data.bufferSize) {
          this.BUFFER_SIZE = data.bufferSize;
        }
        if (data.vadThreshold !== undefined) {
          this.vadThreshold = data.vadThreshold;
        }
        if (data.noiseGate !== undefined) {
          this.noiseGate = data.noiseGate;
        }
        break;
        
      case 'reset':
        // Reset internal buffer and state
        this.buffer = [];
        this.bufferSize = 0;
        this.vadHistory = [];
        this.metrics.packetsProcessed = 0;
        break;
        
      case 'calibrateNoise':
        // Set noise floor from calibration
        if (data.noiseLevel !== undefined) {
          this.noiseFloor = data.noiseLevel;
          this.noiseGate = data.noiseLevel * 1.5;
        }
        break;
        
      default:
        console.warn('Unknown message type:', type);
    }
  }
  
  /**
   * Convert Float32Array audio buffer to 16-bit PCM format required by Gemini
   * @param {Float32Array} audioBuffer - Input audio buffer
   * @returns {Int16Array} - Converted PCM16 data
   */
  convertToPCM16(audioBuffer) {
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
   * Apply noise gate to audio data
   * @param {Float32Array} audioData - Input audio data
   * @returns {Float32Array} - Processed audio data
   */
  applyNoiseGate(audioData) {
    const processedData = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i];
      const magnitude = Math.abs(sample);
      
      // Apply noise gate
      if (magnitude < this.noiseGate) {
        processedData[i] = 0;
      } else {
        // Apply gradual fade-in above noise gate to avoid clicks
        const gateRatio = Math.min(1, (magnitude - this.noiseFloor) / (this.noiseGate - this.noiseFloor));
        processedData[i] = sample * gateRatio;
      }
    }
    
    return processedData;
  }
  
  /**
   * Detect voice activity in audio data
   * @param {Float32Array} audioData - Input audio data
   * @returns {boolean} - Voice activity detected
   */
  detectVoiceActivity(audioData) {
    const volumeLevel = this.calculateVolumeLevel(audioData);
    const isVoiceActive = volumeLevel > this.vadThreshold;
    
    // Add to history
    this.vadHistory.push(isVoiceActive);
    if (this.vadHistory.length > this.vadHistorySize) {
      this.vadHistory.shift();
    }
    
    // Require majority consensus for voice activity
    const voiceCount = this.vadHistory.filter(v => v).length;
    return voiceCount > this.vadHistorySize / 2;
  }

  /**
   * Process audio data
   * @param {Float32Array[][]} inputs - Input audio data
   * @param {Float32Array[][]} outputs - Output audio data (pass-through)
   * @param {Object} parameters - Audio parameters
   * @returns {boolean} - Keep processor alive
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    // Pass through audio (if output exists)
    if (input && output && input[0] && output[0]) {
      output[0].set(input[0]);
    }
    
    // Process input if available and processing is enabled
    if (input && input[0] && this.isProcessing) {
      const inputData = input[0];
      
      // Calculate metrics
      const volumeLevel = this.calculateVolumeLevel(inputData);
      this.metrics.inputLevel = volumeLevel;
      
      // Detect voice activity
      const voiceActivity = this.detectVoiceActivity(inputData);
      this.metrics.voiceActivity = voiceActivity;
      
      // Apply noise gate if voice is detected
      const processedData = voiceActivity ? this.applyNoiseGate(inputData) : inputData;
      
      // Add samples to buffer
      for (let i = 0; i < processedData.length; i++) {
        this.buffer.push(processedData[i]);
        this.bufferSize++;
      }
      
      // Check if we have enough samples to process
      while (this.bufferSize >= this.BUFFER_SIZE) {
        // Extract a chunk of samples
        const chunk = this.buffer.splice(0, this.BUFFER_SIZE);
        this.bufferSize -= this.BUFFER_SIZE;
        
        // Convert to Float32Array
        const float32Chunk = new Float32Array(chunk);
        
        // Convert to PCM16
        const pcm16Data = this.convertToPCM16(float32Chunk);
        
        // Update metrics
        this.metrics.packetsProcessed++;
        
        // Send processed audio back to main thread
        this.port.postMessage({
          type: 'audioData',
          pcm16: pcm16Data,
          sampleRate: this.SAMPLE_RATE,
          channels: this.CHANNELS,
          timestamp: currentTime,
          frameCount: pcm16Data.length,
          voiceActivity: voiceActivity,
          inputLevel: volumeLevel
        });
      }
      
      // Send metrics update
      this.port.postMessage({
        type: 'metrics',
        data: this.metrics
      });
    }
    
    // Send volume level even when not processing
    if (input && input[0]) {
      const volumeLevel = this.calculateVolumeLevel(input[0]);
      this.port.postMessage({
        type: 'volumeLevel',
        data: volumeLevel,
        voiceActivity: this.metrics.voiceActivity
      });
    }
    
    // Return true to keep the processor alive
    return true;
  }
  
  /**
   * Calculate volume level from audio data
   * @param {Float32Array} audioData - Input audio data
   * @returns {number} - Volume level (0-1)
   */
  calculateVolumeLevel(audioData) {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += Math.abs(audioData[i]);
    }
    return sum / audioData.length;
  }
}

// Register the processor
registerProcessor('audio-processor-worklet', AudioProcessorWorklet);