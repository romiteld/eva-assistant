// Voice Service Layer for Gemini Live API

import { EventEmitter } from 'events';
import {
  VoiceAgentState,
  VoiceEvent,
  VoiceConfig,
  VoiceType,
  ResponseModality,
  VoiceSession,
  ConversationTurn,
  VoiceError,
  VoiceErrorCode,
  GeminiLiveConfig,
  GeminiLiveMessage,
  GeminiLiveResponse,
  FunctionCall,
  FunctionResult,
  TranscriptionResult,
  VoiceMetrics,
} from '@/types/voice';
import { AudioProcessor } from '@/lib/audio/processor-worklet';

export class VoiceService extends EventEmitter {
  protected ws: WebSocket | null = null;
  private audioProcessor: AudioProcessor;
  private config: VoiceConfig;
  private session: VoiceSession | null = null;
  private state: VoiceAgentState = VoiceAgentState.IDLE;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private audioQueue: string[] = [];
  private isPlaying = false;
  private currentFunctionCalls = new Map<string, FunctionCall>();
  private metrics: VoiceMetrics = {
    audioLevel: 0,
    speechProbability: 0,
    noiseLevel: 0,
    latency: 0,
    packetsLost: 0,
    jitter: 0,
  };

  constructor(config: VoiceConfig = {}) {
    super();
    this.audioProcessor = new AudioProcessor();
    this.config = {
      model: 'models/gemini-2.0-flash-exp',
      voice: VoiceType.PUCK,
      language: 'en-US',
      responseModalities: [ResponseModality.AUDIO, ResponseModality.TEXT],
      ...config,
    };
  }

  /**
   * Initialize and connect to Gemini Live API
   */
  async connect(): Promise<void> {
    try {
      this.updateState(VoiceAgentState.INITIALIZING);

      // Initialize audio input
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          sampleRate: 16000 
        } 
      });
      await this.audioProcessor.initializeAudioInput(stream);

      // Connect to Gemini Live WebSocket through our proxy
      // Remove 'models/' prefix if already present in the model name
      const modelName = this.config?.model?.startsWith('models/') 
        ? this.config.model.substring(7) 
        : this.config?.model || 'gemini-2.0-flash-exp';
      
      // Get auth token for WebSocket connection
      const authResponse = await fetch('/api/gemini', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': document.cookie
            .split('; ')
            .find(row => row.startsWith('csrf-token='))
            ?.split('=')[1] || '',
        },
        credentials: 'include',
      });
      
      if (!authResponse.ok) {
        throw new Error('Failed to get WebSocket token');
      }
      
      const { websocket } = await authResponse.json();
      
      // Use Supabase Edge Function for WebSocket proxy
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const wsUrl = `${supabaseUrl}/functions/v1/gemini-websocket?model=${encodeURIComponent(modelName)}`;
      console.log('Connecting to Supabase WebSocket proxy:', wsUrl);
      
      // Get Supabase session for Edge Function authentication
      const supabase = (await import('@/lib/supabase/browser')).supabase;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication session found');
      }
      
      // Add auth token to URL since browsers don't support custom headers in WebSocket
      const authenticatedWsUrl = `${wsUrl}&token=${encodeURIComponent(session.access_token)}`;
      
      this.ws = new WebSocket(authenticatedWsUrl);
      this.setupWebSocketHandlers();

      // Create new session
      this.session = {
        id: this.generateSessionId(),
        startTime: new Date(),
        config: this.config,
        turns: [],
        state: VoiceAgentState.INITIALIZING,
      };

      // Start ping interval
      this.startPingInterval();

    } catch (error) {
      this.handleError(error as Error, VoiceErrorCode.CONNECTION_ERROR);
      throw error;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.sendSetupMessage();
      this.updateState(VoiceAgentState.IDLE);
      this.emit(VoiceEvent.CONNECTED);
    };

    this.ws.onmessage = async (event) => {
      try {
        const response: GeminiLiveResponse = JSON.parse(event.data);
        await this.handleGeminiResponse(response);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleError(new Error('WebSocket error'), VoiceErrorCode.CONNECTION_ERROR);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emit(VoiceEvent.DISCONNECTED);
      this.handleReconnect();
    };
  }

  /**
   * Send initial setup message to configure the session
   */
  private sendSetupMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupConfig: GeminiLiveConfig = {
      model: this.config.model!,
      generationConfig: {
        responseModalities: this.config.responseModalities,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.config.voice!,
            },
          },
        },
        temperature: this.config.generationConfig?.temperature || 0.7,
        maxOutputTokens: this.config.generationConfig?.maxOutputTokens || 2048,
      },
    };

    if (this.config.systemInstructions) {
      setupConfig.systemInstruction = {
        parts: [{ text: this.config.systemInstructions }],
      };
    }

    if (this.config.tools && this.config.tools.length > 0) {
      setupConfig.tools = [{
        functionDeclarations: this.config.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      }];
    }

    this.ws.send(JSON.stringify({ setup: setupConfig }));
  }

  /**
   * Handle responses from Gemini Live API
   */
  private async handleGeminiResponse(response: GeminiLiveResponse): Promise<void> {
    if (response.serverContent) {
      const { modelTurn, turnComplete, interrupted } = response.serverContent;

      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.text) {
            // Handle text response
            this.handleTextResponse(part.text);
          }
          
          if (part.inlineData) {
            // Handle audio response
            await this.handleAudioResponse(part.inlineData.data);
          }
          
          if (part.functionCall) {
            // Handle function call
            this.handleFunctionCall(part.functionCall);
          }
        }
      }

      if (turnComplete) {
        this.emit(VoiceEvent.CONVERSATION_TURN, {
          role: 'assistant',
          timestamp: new Date(),
        });
      }

      if (interrupted) {
        this.updateState(VoiceAgentState.IDLE);
      }
    }

    if (response.toolCall) {
      for (const functionCall of response.toolCall.functionCalls) {
        this.handleFunctionCall(functionCall);
      }
    }

    if (response.toolCallCancellation) {
      for (const id of response.toolCallCancellation.ids) {
        this.currentFunctionCalls.delete(id);
      }
    }
  }

  /**
   * Handle text response from Gemini
   */
  private handleTextResponse(text: string): void {
    const transcription: TranscriptionResult = {
      text,
      isFinal: true,
      confidence: 1.0,
    };

    this.emit(VoiceEvent.SPEECH_FINAL, transcription);

    // Add to conversation history
    if (this.session) {
      this.session.turns.push({
        id: this.generateTurnId(),
        role: 'assistant',
        timestamp: new Date(),
        content: text,
      });
    }
  }

  /**
   * Handle audio response from Gemini
   */
  private async handleAudioResponse(audioData: string): Promise<void> {
    this.audioQueue.push(audioData);
    
    if (!this.isPlaying) {
      this.playAudioQueue();
    }
  }

  /**
   * Play queued audio responses
   */
  private async playAudioQueue(): Promise<void> {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      this.updateState(VoiceAgentState.IDLE);
      return;
    }

    this.isPlaying = true;
    this.updateState(VoiceAgentState.SPEAKING);
    
    const audioData = this.audioQueue.shift()!;
    
    try {
      await this.audioProcessor.playBase64Audio(audioData);
      this.emit(VoiceEvent.AUDIO_DATA, audioData);
      
      // Continue playing queue
      await this.playAudioQueue();
    } catch (error) {
      console.error('Error playing audio:', error);
      this.isPlaying = false;
      this.updateState(VoiceAgentState.IDLE);
    }
  }

  /**
   * Handle function call from Gemini
   */
  private handleFunctionCall(functionCall: FunctionCall): void {
    this.currentFunctionCalls.set(functionCall.id, functionCall);
    this.emit(VoiceEvent.FUNCTION_CALL, functionCall);
  }

  /**
   * Start listening for user input
   */
  async startListening(): Promise<void> {
    if (this.state === VoiceAgentState.LISTENING) return;

    try {
      await this.audioProcessor.resume();
      this.updateState(VoiceAgentState.LISTENING);
      this.emit(VoiceEvent.AUDIO_START);

      // Start processing audio chunks
      this.audioProcessor.startProcessing((chunk) => {
        if (this.state === VoiceAgentState.LISTENING) {
          this.sendAudioChunk(chunk);
          this.updateMetrics();
        }
      });

      // Start voice activity detection
      this.startVoiceActivityDetection();
      
    } catch (error) {
      this.handleError(error as Error, VoiceErrorCode.AUDIO_ERROR);
    }
  }

  /**
   * Stop listening for user input
   */
  stopListening(): void {
    if (this.state !== VoiceAgentState.LISTENING) return;

    this.audioProcessor.stopProcessing();
    this.updateState(VoiceAgentState.PROCESSING);
    this.emit(VoiceEvent.AUDIO_END);
    
    // Send turn complete signal
    this.sendTurnComplete();
  }

  /**
   * Send audio chunk to Gemini
   */
  private sendAudioChunk(chunk: Int16Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const base64Audio = this.audioProcessor.pcm16ToBase64(chunk);
    
    const message: GeminiLiveMessage = {
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'audio/pcm;rate=16000',
          data: base64Audio,
        }],
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send turn complete signal
   */
  private sendTurnComplete(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message: GeminiLiveMessage = {
      clientContent: {
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send text message
   */
  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message: GeminiLiveMessage = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }],
        }],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(message));
    
    // Add to conversation history
    if (this.session) {
      this.session.turns.push({
        id: this.generateTurnId(),
        role: 'user',
        timestamp: new Date(),
        content: text,
      });
    }

    this.updateState(VoiceAgentState.PROCESSING);
    this.emit(VoiceEvent.CONVERSATION_TURN, { role: 'user', content: text });
  }

  /**
   * Send function result
   */
  sendFunctionResult(functionCallId: string, result: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const functionCall = this.currentFunctionCalls.get(functionCallId);
    if (!functionCall) {
      console.error('Function call not found:', functionCallId);
      return;
    }

    const message: GeminiLiveMessage = {
      toolResponse: {
        functionResponses: [{
          id: functionCallId,
          name: functionCall.name,
          response: result,
        }],
      },
    };

    this.ws.send(JSON.stringify(message));
    
    // Remove from current calls
    this.currentFunctionCalls.delete(functionCallId);
    
    this.emit(VoiceEvent.FUNCTION_RESULT, {
      id: functionCallId,
      response: result,
    });
  }

  /**
   * Start voice activity detection
   */
  private startVoiceActivityDetection(): void {
    let speechStartTime: number | null = null;
    let silenceStartTime: number | null = null;
    const VAD_THRESHOLD = 0.15;
    const SPEECH_MIN_DURATION = 300; // ms
    const SILENCE_DURATION = 1500; // ms

    const vadInterval = setInterval(() => {
      if (this.state !== VoiceAgentState.LISTENING) {
        clearInterval(vadInterval);
        return;
      }

      const isVoiceActive = this.audioProcessor.detectVoiceActivity();

      if (isVoiceActive) {
        if (!speechStartTime) {
          speechStartTime = Date.now();
          this.emit(VoiceEvent.SPEECH_START);
        }
        silenceStartTime = null;
      } else {
        if (speechStartTime && !silenceStartTime) {
          silenceStartTime = Date.now();
        }

        if (silenceStartTime && speechStartTime) {
          const silenceDuration = Date.now() - silenceStartTime;
          const speechDuration = silenceStartTime - speechStartTime;

          if (silenceDuration >= SILENCE_DURATION && speechDuration >= SPEECH_MIN_DURATION) {
            // End of speech detected
            this.emit(VoiceEvent.SPEECH_END);
            this.stopListening();
            clearInterval(vadInterval);
          }
        }
      }
    }, 100);
  }

  /**
   * Update voice metrics
   */
  private updateMetrics(): void {
    this.metrics.audioLevel = this.audioProcessor.getVolumeLevel();
    this.metrics.speechProbability = this.audioProcessor.detectVoiceActivity() ? 1.0 : 0.0;
    
    // Calculate latency (simplified)
    if (this.session && this.session.turns.length > 0) {
      const lastTurn = this.session.turns[this.session.turns.length - 1];
      this.metrics.latency = Date.now() - lastTurn.timestamp.getTime();
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): VoiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Update agent state
   */
  private updateState(newState: VoiceAgentState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (this.session) {
      this.session.state = newState;
    }
    
    this.emit(VoiceEvent.STATE_CHANGE, { oldState, newState });
  }

  /**
   * Handle errors
   */
  private handleError(error: Error, code: VoiceErrorCode): void {
    const voiceError: VoiceError = {
      ...error,
      code,
      name: 'VoiceError',
    };

    if (this.session) {
      this.session.error = voiceError;
    }

    this.updateState(VoiceAgentState.ERROR);
    this.emit(VoiceEvent.ERROR, voiceError);
  }

  /**
   * Handle reconnection
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handleError(
        new Error('Maximum reconnection attempts reached'),
        VoiceErrorCode.CONNECTION_ERROR
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimeout = setTimeout(() => {
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect().catch(console.error);
    }, delay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: true }));
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Get current state
   */
  getState(): VoiceAgentState {
    return this.state;
  }

  /**
   * Get current session
   */
  getSession(): VoiceSession | null {
    return this.session;
  }

  /**
   * Get frequency data for visualization
   */
  getFrequencyData(): Uint8Array {
    return this.audioProcessor.getFrequencyData();
  }

  /**
   * Get waveform data for visualization
   */
  getWaveformData(): Uint8Array {
    return this.audioProcessor.getWaveformData();
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // Clear intervals
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Cleanup audio
    if (this.audioProcessor) {
      this.audioProcessor.cleanup();
    }

    // Update session
    if (this.session) {
      this.session.endTime = new Date();
    }

    this.updateState(VoiceAgentState.IDLE);
    this.emit(VoiceEvent.DISCONNECTED);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `voice-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique turn ID
   */
  private generateTurnId(): string {
    return `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}