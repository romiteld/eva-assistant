// Voice Agent React Hook

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  VoiceAgentState,
  VoiceEvent,
  VoiceConfig,
  VoiceSession,
  ConversationTurn,
  VoiceError,
  VoiceMetrics,
  FunctionCall,
  FunctionResult,
  TranscriptionResult,
  VoiceAnalytics,
} from '@/types/voice';
import { VoiceService } from '@/lib/services/voice';
import { VoiceWithVisualService } from '@/lib/services/voiceWithVisual';
import { chatHistory } from '@/lib/services/chatHistory';
import { useToast } from '@/hooks/use-toast';
import { VoiceBroadcastService } from '@/lib/realtime/voice-broadcast';
import { useAuth } from '@/hooks/useAuth';

interface UseVoiceAgentOptions extends VoiceConfig {
  onStateChange?: (state: VoiceAgentState) => void;
  onTranscription?: (transcription: TranscriptionResult) => void;
  onFunctionCall?: (functionCall: FunctionCall) => void;
  onError?: (error: VoiceError) => void;
  autoConnect?: boolean;
  enableAnalytics?: boolean;
  enableHistory?: boolean;
  sessionId?: string; // Resume existing session
  enableVisual?: boolean; // Enable visual input (screen/camera share)
}

interface UseVoiceAgentReturn {
  // State
  state: VoiceAgentState;
  session: VoiceSession | null;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  error: VoiceError | null;
  
  // Conversation
  turns: ConversationTurn[];
  currentTranscription: TranscriptionResult | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendText: (text: string) => void;
  sendFunctionResult: (functionCallId: string, result: any) => void;
  toggleListening: () => Promise<void>;
  setVisualStream: (stream: MediaStream | null) => void;
  
  // Metrics & Analytics
  metrics: VoiceMetrics;
  analytics: VoiceAnalytics | null;
  
  // Audio visualization
  frequencyData: Uint8Array | null;
  waveformData: Uint8Array | null;
  
  // Permissions
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  
  // Enhanced WebRTC features
  enhancedMetrics: any;
  setInputGain: (gain: number) => void;
  setOutputGain: (gain: number) => void;
  calibrateNoise: (duration?: number) => Promise<void>;
  getWebRTCManager: () => any;
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}): UseVoiceAgentReturn {
  const { toast: showToast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const voiceServiceRef = useRef<VoiceService | VoiceWithVisualService | null>(null);
  const broadcastServiceRef = useRef<VoiceBroadcastService | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chatSessionIdRef = useRef<string | null>(null);
  
  // State
  const [state, setState] = useState<VoiceAgentState>(VoiceAgentState.IDLE);
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [error, setError] = useState<VoiceError | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState<TranscriptionResult | null>(null);
  const [metrics, setMetrics] = useState<VoiceMetrics>({
    audioLevel: 0,
    speechProbability: 0,
    noiseLevel: 0,
    latency: 0,
    packetsLost: 0,
    jitter: 0,
  });
  const [analytics, setAnalytics] = useState<VoiceAnalytics | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const [waveformData, setWaveformData] = useState<Uint8Array | null>(null);
  const [enhancedMetrics, setEnhancedMetrics] = useState<any>(null);

  // Store showToast in a ref to avoid closure issues
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Request microphone permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      if (result.state === 'granted') {
        setHasPermission(true);
        return true;
      } else if (result.state === 'prompt') {
        // Trigger permission prompt
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
        return true;
      } else {
        setHasPermission(false);
        showToast({
          title: 'Permission Denied',
          description: 'Microphone access is required for voice agent',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Permission error:', error);
      setHasPermission(false);
      return false;
    }
  }, [showToast]);

  // Check permission and connect
  const checkPermissionAndConnect = useCallback(async () => {
    const permitted = await requestPermission();
    if (permitted && voiceServiceRef.current) {
      try {
        await voiceServiceRef.current.connect();
      } catch (error) {
        console.error('Connection error:', error);
      }
    }
  }, [requestPermission]);

  // Initialize voice service
  useEffect(() => {
    // Use VoiceWithVisualService if visual is enabled
    if (options.enableVisual) {
      voiceServiceRef.current = new VoiceWithVisualService(options);
    } else {
      voiceServiceRef.current = new VoiceService(options, true); // Enable WebRTC
    }
    const voiceService = voiceServiceRef.current;

    // Setup event listeners
    voiceService.on(VoiceEvent.STATE_CHANGE, async ({ newState }) => {
      setState(newState);
      options.onStateChange?.(newState);
      
      // Broadcast state change
      if (broadcastServiceRef.current) {
        await broadcastServiceRef.current.broadcastStateChange(newState);
      }
    });

    voiceService.on(VoiceEvent.CONNECTED, () => {
      if (showToastRef.current) {
        showToastRef.current({
          title: 'Connected',
          description: 'Voice agent is ready',
        });
      }
    });

    voiceService.on(VoiceEvent.DISCONNECTED, () => {
      if (showToastRef.current) {
        showToastRef.current({
          title: 'Disconnected',
          description: 'Voice agent disconnected',
          variant: 'destructive',
        });
      }
    });

    voiceService.on(VoiceEvent.ERROR, (error: VoiceError) => {
      setError(error);
      options.onError?.(error);
      if (showToastRef.current) {
        showToastRef.current({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
    });

    voiceService.on(VoiceEvent.CONVERSATION_TURN, async (turn: ConversationTurn) => {
      setTurns(prev => [...prev, turn]);
      
      // Broadcast the turn if connected
      if (broadcastServiceRef.current) {
        await broadcastServiceRef.current.broadcastTurn(turn);
      }
      
      // Save to chat history if enabled
      if (options.enableHistory && chatSessionIdRef.current) {
        try {
          await chatHistory.saveMessage(chatSessionIdRef.current, turn);
        } catch (error) {
          console.error('Failed to save message to history:', error);
        }
      }
    });

    voiceService.on(VoiceEvent.SPEECH_INTERIM, async (transcription: TranscriptionResult) => {
      setCurrentTranscription(transcription);
      options.onTranscription?.(transcription);
      
      // Broadcast interim transcription
      if (broadcastServiceRef.current) {
        await broadcastServiceRef.current.broadcastTranscription({
          text: transcription.text,
          isFinal: false
        });
      }
    });

    voiceService.on(VoiceEvent.SPEECH_FINAL, async (transcription: TranscriptionResult) => {
      setCurrentTranscription(transcription);
      options.onTranscription?.(transcription);
      
      // Broadcast final transcription
      if (broadcastServiceRef.current) {
        await broadcastServiceRef.current.broadcastTranscription({
          text: transcription.text,
          isFinal: true
        });
      }
    });

    voiceService.on(VoiceEvent.FUNCTION_CALL, async (functionCall: FunctionCall) => {
      options.onFunctionCall?.(functionCall);
      
      // Broadcast function call
      if (broadcastServiceRef.current) {
        await broadcastServiceRef.current.broadcastFunctionCall(functionCall);
      }
    });

    // Update session
    const updateSession = () => {
      const currentSession = voiceService.getSession();
      if (currentSession) {
        setSession(currentSession);
        setTurns(currentSession.turns);
      }
    };

    voiceService.on(VoiceEvent.STATE_CHANGE, updateSession);
    voiceService.on(VoiceEvent.CONVERSATION_TURN, updateSession);

    // Auto-connect if enabled
    if (options.autoConnect) {
      checkPermissionAndConnect();
    }

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      voiceService.removeAllListeners();
      voiceService.disconnect();
    };
  }, [checkPermissionAndConnect]);

  // Update visualization data
  useEffect(() => {
    if (state === VoiceAgentState.LISTENING || state === VoiceAgentState.SPEAKING) {
      const updateVisualization = () => {
        if (voiceServiceRef.current) {
          setFrequencyData(voiceServiceRef.current.getFrequencyData());
          setWaveformData(voiceServiceRef.current.getWaveformData());
          setMetrics(voiceServiceRef.current.getMetrics());
          
          // Update enhanced metrics from WebRTC
          const enhanced = voiceServiceRef.current.getEnhancedMetrics();
          if (enhanced) {
            setEnhancedMetrics(enhanced);
          }
        }
        animationFrameRef.current = requestAnimationFrame(updateVisualization);
      };
      updateVisualization();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [state]);

  // Calculate analytics
  useEffect(() => {
    if (options.enableAnalytics && session && session.turns.length > 0) {
      const calculateAnalytics = () => {
        const duration = session.endTime 
          ? session.endTime.getTime() - session.startTime.getTime()
          : Date.now() - session.startTime.getTime();

        const userTurns = session.turns.filter(t => t.role === 'user');
        const assistantTurns = session.turns.filter(t => t.role === 'assistant');
        
        const wordCount = session.turns
          .filter(t => t.content)
          .reduce((sum, turn) => sum + (turn.content?.split(' ').length || 0), 0);

        const responseTimes: number[] = [];
        for (let i = 0; i < userTurns.length && i < assistantTurns.length; i++) {
          const userTime = userTurns[i].timestamp.getTime();
          const assistantTime = assistantTurns[i].timestamp.getTime();
          if (assistantTime > userTime) {
            responseTimes.push(assistantTime - userTime);
          }
        }

        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

        setAnalytics({
          sessionId: session.id,
          duration,
          turnCount: session.turns.length,
          wordCount,
          averageResponseTime: avgResponseTime,
        });
      };

      const interval = setInterval(calculateAnalytics, 5000); // Update every 5 seconds
      calculateAnalytics();

      return () => clearInterval(interval);
    }
  }, [session, options.enableAnalytics]);

  // Actions
  const connect = useCallback(async () => {
    if (!voiceServiceRef.current) return;
    
    // Check authentication first
    if (!isAuthenticated) {
      showToast({
        title: 'Authentication Required',
        description: 'Please sign in to use the voice assistant',
        variant: 'destructive',
      });
      return;
    }
    
    const permitted = await requestPermission();
    if (!permitted) return;

    try {
      // Create or load chat session if history is enabled
      if (options.enableHistory) {
        try {
          if (options.sessionId) {
            // Resume existing session
            chatSessionIdRef.current = options.sessionId;
            const messages = await chatHistory.getSessionMessages(options.sessionId);
            const restoredTurns: ConversationTurn[] = messages.map(msg => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant' | 'function',
              timestamp: new Date(msg.timestamp),
              content: msg.content || undefined,
              functionCall: msg.function_call ? (msg.function_call as FunctionCall) : undefined,
              functionResult: msg.function_result ? (msg.function_result as FunctionResult) : undefined,
              metadata: msg.metadata || undefined
            }));
            setTurns(restoredTurns);
          } else {
            // Create new session
            const model = options.model || 'gemini-2.5-flash-preview-native-audio-dialog';
            const chatSession = await chatHistory.createSession(
              `Voice Chat - ${new Date().toLocaleString()}`,
              model
            );
            chatSessionIdRef.current = chatSession.id;
          }
        } catch (error) {
          console.error('Failed to initialize chat history:', error);
          // Continue without history
        }
      }

      await voiceServiceRef.current.connect();
      
      // Initialize broadcast service if user is authenticated
      if (user && chatSessionIdRef.current) {
        try {
          broadcastServiceRef.current = new VoiceBroadcastService(chatSessionIdRef.current);
          await broadcastServiceRef.current.initialize(user.id);
          
          // Subscribe to broadcast events from other users
          broadcastServiceRef.current.on('turn', (turn: ConversationTurn) => {
            setTurns(prev => [...prev, turn]);
          });
          
          broadcastServiceRef.current.on('transcription', (transcription: { text: string; isFinal: boolean }) => {
            if (!transcription.isFinal) {
              setCurrentTranscription({ text: transcription.text, confidence: 1, isFinal: false });
            }
          });
        } catch (error) {
          console.error('Failed to initialize broadcast service:', error);
          // Continue without broadcast
        }
      }
    } catch (error) {
      console.error('Connection error:', error);
    }
  }, [requestPermission, options.enableHistory, options.sessionId, options.model, user, isAuthenticated, showToast]);

  const disconnect = useCallback(() => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.disconnect();
    }
    
    // Cleanup broadcast service
    if (broadcastServiceRef.current) {
      broadcastServiceRef.current.cleanup();
      broadcastServiceRef.current = null;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!voiceServiceRef.current) return;
    
    // Check authentication
    if (!isAuthenticated) {
      showToast({
        title: 'Authentication Required',
        description: 'Please sign in to use the voice assistant',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await voiceServiceRef.current.startListening();
    } catch (error) {
      console.error('Start listening error:', error);
    }
  }, [isAuthenticated, showToast]);

  const stopListening = useCallback(() => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.stopListening();
    }
  }, []);

  const toggleListening = useCallback(async () => {
    if (state === VoiceAgentState.LISTENING) {
      stopListening();
    } else if (state === VoiceAgentState.IDLE) {
      await startListening();
    }
  }, [state, startListening, stopListening]);

  const sendText = useCallback((text: string) => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.sendText(text);
    }
  }, []);

  const sendFunctionResult = useCallback((functionCallId: string, result: any) => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.sendFunctionResult(functionCallId, result);
    }
  }, []);

  const setVisualStream = useCallback((stream: MediaStream | null) => {
    if (voiceServiceRef.current && voiceServiceRef.current instanceof VoiceWithVisualService) {
      voiceServiceRef.current.setVisualStream(stream);
    }
  }, []);

  // Enhanced WebRTC methods
  const setInputGain = useCallback((gain: number) => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.setInputGain(gain);
    }
  }, []);

  const setOutputGain = useCallback((gain: number) => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.setOutputGain(gain);
    }
  }, []);

  const calibrateNoise = useCallback(async (duration = 2000): Promise<void> => {
    if (voiceServiceRef.current) {
      await voiceServiceRef.current.calibrateNoiseLevel(duration);
    }
  }, []);

  const getWebRTCManager = useCallback(() => {
    if (voiceServiceRef.current) {
      return voiceServiceRef.current.getWebRTCManager();
    }
    return null;
  }, []);

  // Computed states
  const isConnected = state !== VoiceAgentState.IDLE && state !== VoiceAgentState.ERROR;
  const isListening = state === VoiceAgentState.LISTENING;
  const isSpeaking = state === VoiceAgentState.SPEAKING;
  const isProcessing = state === VoiceAgentState.PROCESSING;

  return {
    // State
    state,
    session,
    isConnected,
    isListening,
    isSpeaking,
    isProcessing,
    error,
    
    // Conversation
    turns,
    currentTranscription,
    
    // Actions
    connect,
    disconnect,
    startListening,
    stopListening,
    sendText,
    sendFunctionResult,
    toggleListening,
    setVisualStream,
    
    // Metrics & Analytics
    metrics,
    analytics,
    
    // Audio visualization
    frequencyData,
    waveformData,
    
    // Permissions
    hasPermission,
    requestPermission,
    
    // Enhanced WebRTC features
    enhancedMetrics,
    setInputGain,
    setOutputGain,
    calibrateNoise,
    getWebRTCManager,
  };
}