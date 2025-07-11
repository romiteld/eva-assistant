# EVA Voice Agent Implementation

This document provides an overview of the comprehensive voice agent service implementation for EVA Assistant using the Gemini Live API.

## Overview

The voice agent enables real-time voice interactions with EVA, supporting:
- Real-time audio streaming (input and output)
- Voice activity detection (VAD)
- Function calling capabilities
- Multiple voice personalities
- Audio transcription
- Session management and resumption

## Architecture

### Core Components

1. **Voice Service Layer** (`/src/lib/services/voice.ts`)
   - WebSocket connection to Gemini Live API
   - Audio streaming management
   - Function calling handling
   - Session management
   - Error handling and reconnection logic

2. **Audio Processing** (`/src/lib/audio/processor.ts`)
   - Audio format conversion (16-bit PCM, 16kHz mono)
   - Volume level detection
   - Voice activity detection
   - Audio buffering and chunking
   - Noise suppression utilities

3. **React Hook** (`/src/hooks/useVoiceAgent.ts`)
   - Voice agent state management
   - Audio stream management
   - Permission handling
   - Metrics and analytics

4. **UI Components** (`/src/components/voice/`)
   - `VoiceAgent.tsx` - Main voice agent component
   - `VoiceControl.tsx` - Microphone and connection controls
   - `AudioVisualizer.tsx` - Waveform and frequency visualization
   - `TranscriptionDisplay.tsx` - Real-time transcription display
   - `VoiceSettings.tsx` - Voice selection and settings
   - `ConversationHistory.tsx` - Turn-by-turn conversation display
   - `FunctionCallHandler.tsx` - Function call visualization

## Setup

1. **Environment Variables**
   Add the following to your `.env.local` file:
   ```
   NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Navigate to Voice Agent**
   Visit `/dashboard/voice` to access the voice agent interface.

## Usage

### Basic Voice Interaction

```tsx
import { VoiceAgent } from '@/components/voice/VoiceAgent';

function MyComponent() {
  return (
    <VoiceAgent
      systemInstructions="You are a helpful assistant"
      voice={VoiceType.PUCK}
    />
  );
}
```

### With Function Calling

```tsx
import { VoiceAgent } from '@/components/voice/VoiceAgent';
import { Tool, FunctionCall } from '@/types/voice';

const tools: Tool[] = [
  {
    name: 'get_weather',
    description: 'Get weather information',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' }
      },
      required: ['location']
    }
  }
];

async function handleFunctionCall(call: FunctionCall) {
  if (call.name === 'get_weather') {
    // Implement your function logic
    return { temperature: 72, condition: 'sunny' };
  }
}

function MyComponent() {
  return (
    <VoiceAgent
      tools={tools}
      onFunctionCall={handleFunctionCall}
    />
  );
}
```

### Using the Hook Directly

```tsx
import { useVoiceAgent } from '@/hooks/useVoiceAgent';

function MyComponent() {
  const {
    state,
    isListening,
    toggleListening,
    sendText,
    metrics,
    frequencyData
  } = useVoiceAgent({
    voice: VoiceType.KORE,
    enableAnalytics: true
  });

  return (
    <div>
      <button onClick={toggleListening}>
        {isListening ? 'Stop' : 'Start'} Listening
      </button>
      <p>Audio Level: {Math.round(metrics.audioLevel * 100)}%</p>
    </div>
  );
}
```

## Voice Options

Available voice personalities:
- **Puck** - Warm, friendly voice with a slight British accent
- **Charon** - Deep, authoritative voice with clear pronunciation
- **Kore** - Bright, energetic voice with a modern feel
- **Fenrir** - Strong, masculine voice with gravitas
- **Aoede** - Melodic, soothing voice with gentle tones

## Features

### Real-time Audio Processing
- 16-bit PCM audio format at 16kHz
- Automatic echo cancellation and noise suppression
- Voice activity detection with configurable thresholds
- Audio visualization (waveform and frequency spectrum)

### Function Calling
- Define custom tools with JSON schema
- Automatic function call detection and handling
- Visual feedback for pending function calls
- Async function result handling

### Session Management
- Automatic session creation and tracking
- Conversation history with turn-by-turn display
- Session metrics and analytics
- Persistent state across reconnections

### Error Handling
- Graceful error recovery
- Automatic reconnection with exponential backoff
- User-friendly error messages
- Permission request handling

## Best Practices

1. **Permissions**: Always check for microphone permissions before initializing
2. **Error Handling**: Implement proper error handling for function calls
3. **Performance**: Use the `enableAnalytics` flag sparingly in production
4. **Voice Selection**: Choose appropriate voice based on your use case
5. **Function Tools**: Keep tool descriptions clear and parameters well-defined

## Troubleshooting

### Common Issues

1. **Microphone Permission Denied**
   - Ensure the site is served over HTTPS
   - Check browser permissions settings
   - Try different browsers if issues persist

2. **Connection Errors**
   - Verify GEMINI_API_KEY is correctly set
   - Check network connectivity
   - Review browser console for detailed errors

3. **Audio Quality Issues**
   - Ensure microphone is properly configured
   - Check for background noise
   - Verify audio settings in VoiceSettings component

## API Reference

### VoiceAgentState
```typescript
enum VoiceAgentState {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking',
  ERROR = 'error'
}
```

### VoiceConfig
```typescript
interface VoiceConfig {
  model?: string;
  voice?: VoiceType;
  language?: string;
  responseModalities?: ResponseModality[];
  systemInstructions?: string;
  tools?: Tool[];
}
```

### Tool Definition
```typescript
interface Tool {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}
```

## Performance Considerations

- Audio processing runs in a separate thread using Web Audio API
- WebSocket connection uses binary frames for audio data
- Automatic cleanup of audio resources on component unmount
- Efficient audio buffering to prevent memory leaks
- Optimized visualization using requestAnimationFrame

## Security

- API key is only exposed on client-side (use server-side proxy for production)
- Audio data is transmitted securely over WSS
- No audio is stored unless explicitly implemented
- Function calls are validated before execution

## Future Enhancements

- [ ] Server-side WebSocket proxy for enhanced security
- [ ] Audio recording and playback features
- [ ] Multi-language support
- [ ] Custom wake word detection
- [ ] Emotion detection in voice
- [ ] Voice cloning capabilities
- [ ] Offline mode with local speech recognition