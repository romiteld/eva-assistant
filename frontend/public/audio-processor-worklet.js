// Audio Worklet Processor for Gemini Live API
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
    
    // Initialize message port
    this.port.onmessage = this.handleMessage.bind(this);
  }
  
  /**
   * Handle messages from the main thread
   */
  handleMessage(event) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'configure':
        // Handle configuration updates if needed
        if (data.bufferSize) {
          this.BUFFER_SIZE = data.bufferSize;
        }
        break;
      case 'reset':
        // Reset internal buffer
        this.buffer = [];
        this.bufferSize = 0;
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
    
    // Process input if available
    if (input && input[0]) {
      const inputData = input[0];
      
      // Add samples to buffer
      for (let i = 0; i < inputData.length; i++) {
        this.buffer.push(inputData[i]);
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
        
        // Send processed audio back to main thread
        this.port.postMessage({
          type: 'audioData',
          pcm16: pcm16Data,
          sampleRate: this.SAMPLE_RATE,
          channels: this.CHANNELS,
          timestamp: currentTime,
          frameCount: pcm16Data.length
        });
      }
      
      // Also send volume level for voice activity detection
      const volumeLevel = this.calculateVolumeLevel(inputData);
      this.port.postMessage({
        type: 'volumeLevel',
        data: volumeLevel
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