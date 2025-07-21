// Voice Agent Types

export enum VoiceAgentState {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking',
  ERROR = 'error',
}

export enum VoiceEvent {
  // Connection events
  CONNECTED = 'voice:connected',
  DISCONNECTED = 'voice:disconnected',
  
  // Audio events
  AUDIO_START = 'voice:audio-start',
  AUDIO_END = 'voice:audio-end',
  AUDIO_DATA = 'voice:audio-data',
  
  // Speech events
  SPEECH_START = 'voice:speech-start',
  SPEECH_END = 'voice:speech-end',
  SPEECH_INTERIM = 'voice:speech-interim',
  SPEECH_FINAL = 'voice:speech-final',
  
  // Conversation events
  CONVERSATION_START = 'voice:conversation-start',
  CONVERSATION_END = 'voice:conversation-end',
  CONVERSATION_TURN = 'voice:conversation-turn',
  
  // State events
  STATE_CHANGE = 'voice:state-change',
  ERROR = 'voice:error',
  
  // Function calling
  FUNCTION_CALL = 'voice:function-call',
  FUNCTION_RESULT = 'voice:function-result',
}

export interface VoiceConfig {
  model?: string;
  voice?: VoiceType;
  language?: string;
  responseModalities?: ResponseModality[];
  systemInstructions?: string;
  tools?: Tool[];
  speechSettings?: SpeechSettings;
  generationConfig?: GenerationConfig;
}

export enum VoiceType {
  // Gemini voices
  PUCK = 'Puck',
  CHARON = 'Charon',
  KORE = 'Kore',
  FENRIR = 'Fenrir',
  AOEDE = 'Aoede',
  
  // ElevenLabs voices
  ELEVENLABS_ADAM = 'elevenlabs:adam',
  ELEVENLABS_ANTONI = 'elevenlabs:antoni',
  ELEVENLABS_ARNOLD = 'elevenlabs:arnold',
  ELEVENLABS_BELLA = 'elevenlabs:bella',
  ELEVENLABS_DOMI = 'elevenlabs:domi',
  ELEVENLABS_ELLI = 'elevenlabs:elli',
  ELEVENLABS_EMILY = 'elevenlabs:emily',
  ELEVENLABS_ETHAN = 'elevenlabs:ethan',
  ELEVENLABS_FREYA = 'elevenlabs:freya',
  ELEVENLABS_GIGI = 'elevenlabs:gigi',
  ELEVENLABS_GIOVANNI = 'elevenlabs:giovanni',
  ELEVENLABS_GLINDA = 'elevenlabs:glinda',
  ELEVENLABS_GRACE = 'elevenlabs:grace',
  ELEVENLABS_HARRY = 'elevenlabs:harry',
  ELEVENLABS_JAMES = 'elevenlabs:james',
  ELEVENLABS_JEREMY = 'elevenlabs:jeremy',
  ELEVENLABS_JESSIE = 'elevenlabs:jessie',
  ELEVENLABS_JOSEPH = 'elevenlabs:joseph',
  ELEVENLABS_JOSH = 'elevenlabs:josh',
  ELEVENLABS_LIAM = 'elevenlabs:liam',
  ELEVENLABS_MATILDA = 'elevenlabs:matilda',
  ELEVENLABS_MATTHEW = 'elevenlabs:matthew',
  ELEVENLABS_MICHAEL = 'elevenlabs:michael',
  ELEVENLABS_MIMI = 'elevenlabs:mimi',
  ELEVENLABS_NICOLE = 'elevenlabs:nicole',
  ELEVENLABS_PATRICK = 'elevenlabs:patrick',
  ELEVENLABS_RACHEL = 'elevenlabs:rachel',
  ELEVENLABS_RYAN = 'elevenlabs:ryan',
  ELEVENLABS_SAM = 'elevenlabs:sam',
  ELEVENLABS_SARAH = 'elevenlabs:sarah',
  ELEVENLABS_SERENA = 'elevenlabs:serena',
  ELEVENLABS_THOMAS = 'elevenlabs:thomas',
}

export enum ResponseModality {
  AUDIO = 'AUDIO',
  TEXT = 'TEXT',
}

export interface SpeechSettings {
  voiceConfig?: {
    prebuiltVoiceConfig?: {
      voiceName: VoiceType;
    };
  };
}

export interface GenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  candidateCount?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseModalities?: ResponseModality[];
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName: VoiceType;
      };
    };
  };
}

export interface Tool {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant' | 'function';
  timestamp: Date;
  content?: string;
  audioData?: ArrayBuffer;
  functionCall?: FunctionCall;
  functionResult?: FunctionResult;
  metadata?: Record<string, any>;
}

export interface FunctionCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface FunctionResult {
  id: string;
  response: any;
  error?: string;
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
  words?: Word[];
  alternatives?: Alternative[];
}

export interface Word {
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

export interface Alternative {
  text: string;
  confidence: number;
}

export interface VoiceSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  config: VoiceConfig;
  turns: ConversationTurn[];
  state: VoiceAgentState;
  error?: VoiceError;
}

export interface VoiceError extends Error {
  code: VoiceErrorCode;
  details?: any;
}

export enum VoiceErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  MICROPHONE_NOT_FOUND = 'MICROPHONE_NOT_FOUND',
  API_ERROR = 'API_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  AUDIO_ERROR = 'AUDIO_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  UNKNOWN = 'UNKNOWN',
}

export interface AudioStreamOptions {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface VoiceMetrics {
  audioLevel: number;
  speechProbability: number;
  noiseLevel: number;
  latency: number;
  packetsLost: number;
  jitter: number;
}

export interface VoiceAnalytics {
  sessionId: string;
  duration: number;
  turnCount: number;
  wordCount: number;
  averageResponseTime: number;
  sentiment?: {
    score: number;
    magnitude: number;
  };
  entities?: Entity[];
  topics?: string[];
  functionCalls?: {
    name: string;
    count: number;
    averageDuration: number;
  }[];
}

export interface Entity {
  text: string;
  type: EntityType;
  salience: number;
  mentions: EntityMention[];
}

export enum EntityType {
  PERSON = 'PERSON',
  LOCATION = 'LOCATION',
  ORGANIZATION = 'ORGANIZATION',
  EVENT = 'EVENT',
  WORK_OF_ART = 'WORK_OF_ART',
  CONSUMER_GOOD = 'CONSUMER_GOOD',
  OTHER = 'OTHER',
}

export interface EntityMention {
  text: string;
  type: 'TYPE_UNKNOWN' | 'PROPER' | 'COMMON';
  offset: number;
}

// Gemini Live specific types
export interface GeminiLiveConfig {
  model: string;
  systemInstruction?: {
    parts: Array<{
      text: string;
    }>;
  };
  generationConfig?: GenerationConfig;
  tools?: Array<{
    functionDeclarations: FunctionDeclaration[];
  }>;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface GeminiLiveMessage {
  clientContent?: {
    turns?: Array<{
      role: string;
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
        functionCall?: {
          name: string;
          args: Record<string, any>;
        };
        functionResponse?: {
          name: string;
          response: any;
        };
      }>;
    }>;
    turnComplete?: boolean;
  };
  realtimeInput?: {
    mediaChunks?: Array<{
      mimeType: string;
      data: string;
    }>;
  };
  toolResponse?: {
    functionResponses: Array<{
      id: string;
      name: string;
      response: any;
    }>;
  };
}

export interface GeminiLiveResponse {
  serverContent?: {
    modelTurn?: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
        functionCall?: {
          id: string;
          name: string;
          args: Record<string, any>;
        };
      }>;
    };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, any>;
    }>;
  };
  toolCallCancellation?: {
    ids: string[];
  };
}

// ElevenLabs specific types
export interface ElevenLabsVoiceConfig {
  voiceId: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
  streamingLatencyOptimization?: number;
}

export interface ElevenLabsStreamConfig {
  enabled: boolean;
  chunkSize?: number;
  flushInterval?: number;
  optimizeStreamingLatency?: number;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string;
  samples?: string[];
}

export interface ElevenLabsModel {
  model_id: string;
  name: string;
  description?: string;
  can_be_finetuned?: boolean;
  max_characters?: number;
  languages?: Array<{
    language_id: string;
    name: string;
  }>;
}

export enum VoiceProvider {
  GEMINI = 'gemini',
  ELEVENLABS = 'elevenlabs',
}

export interface UnifiedVoiceConfig {
  provider: VoiceProvider;
  geminiConfig?: VoiceConfig;
  elevenLabsConfig?: ElevenLabsVoiceConfig;
  streamingConfig?: ElevenLabsStreamConfig;
}