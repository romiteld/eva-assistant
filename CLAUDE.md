# Eva Assistant - AI-Powered Multimodal Voice Assistant

## Commands

### Development
- `npm run dev` - Start development servers (frontend + Supabase local)
- `npm run build` - Build production frontend
- `npm run lint` - ESLint checks
- `npm run type-check` - TypeScript validation
- `npm test` - Run test suite
- `node validate-edge-functions.js` - Test all Supabase edge functions

### Supabase
- `supabase status` - Check local stack status
- `supabase db reset` - Reset database with fresh migrations
- `supabase functions deploy` - Deploy all edge functions
- `supabase storage update` - Update storage bucket configurations

## Architecture Overview

### Storage-Based Voice Streaming
Eva uses Supabase Storage (NOT database tables) for audio caching to avoid RLS policy conflicts. This follows ElevenLabs' recommended pattern:

**Key Flow:**
```
User Speech → Whisper API → Eva Brain (Gemini) → ElevenLabs TTS → Stream Branching
                                                                      ↓
                                                          Browser (immediate) + Storage (cache)
```

**Stream Branching Pattern:**
```typescript
// Edge function splits stream for real-time + caching
const [browserStream, storageStream] = stream.tee();
EdgeRuntime.waitUntil(uploadAudioToStorage(storageStream, cacheKey));
return new Response(browserStream);
```

### Multi-Agent System
- **Eva Brain** (`lib/services/eva-brain.ts`): Master AI Orchestrator using Gemini Pro 2.5/Flash 2.5 with advanced tool calling
- **Agent Orchestrator** (Supabase function): A2A communication hub
- **Specialized Agents**: Document processing, error logging, queue processing, deep thinking, lead generation, content creation

### Microsoft Integration Architecture
- **Authentication**: Entra ID OAuth 2.0 PKCE (SPA configuration)
- **Data Access**: Microsoft Graph API for M365 services
- **No Azure Required**: Uses Entra ID for auth only, all infrastructure on Supabase

### Voice Session Management
- Sessions stored as JSON files in `voice-history` Storage bucket
- Real-time communication via Supabase Realtime channels
- Audio caching in `audio` Storage bucket with MD5 hash keys
- Voice Activity Detection using Web Audio API RMS calculation

## Critical Implementation Details

### Audio Cache Service (`lib/services/audio-cache.ts`)
- MD5 hashing for cache keys based on text + voice settings
- Automatic cleanup of expired cache entries
- Signed URL generation for secure audio playbook

### Voice Streaming Service (`lib/services/supabase-voice-streaming.ts`)
- WebRTC MediaRecorder for audio capture
- VAD with configurable RMS thresholds
- Chunked audio processing (1500ms intervals) with 50ms restart gaps
- Background caching using EdgeRuntime.waitUntil
- **Authentication**: Dual support - anon key (Microsoft OAuth) and user tokens (Supabase auth)

### Edge Function Architecture
- **voice-stream**: Primary STT handler with dual authentication support
  - Accepts both user JWT tokens and anon key for Microsoft OAuth compatibility
  - OpenAI Whisper API integration with fallback API key handling
  - Comprehensive error logging and CORS support
- **elevenlabs-tts**: Dedicated TTS synthesis with audio caching
- **websocket-relay**: Real-time communication bridge  
- **agent-orchestrator**: A2A coordination and tool execution
- All functions use optimal Deno runtime configuration

### Voice Streaming Authentication Fix
**Problem**: Microsoft OAuth users couldn't access voice streaming due to authentication mismatch
**Solution**: Modified voice-stream function to accept both authentication methods:
```typescript
// Check if it's the anon key (for Microsoft OAuth users)
if (token === anonKey) {
  console.log('Voice stream: Using anon key authentication');
} else {
  // Verify the user token for regular Supabase auth users
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
}
```

**Client-side**: Updated `getAccessToken()` to prioritize anon key over session tokens for compatibility

### Database Schema
- `voice_sessions`: Session metadata and analytics
- `agent_executions`: A2A workflow tracking  
- `error_logs`: Centralized error reporting
- `chat_uploads`: File attachment metadata
- RLS policies enforce user isolation on all tables

### Storage Buckets
- `audio`: Audio cache files (private, 50MB limit)
- `voice-history`: Session JSON files (private)
- `chat-uploads`: User file attachments (private)
- All use signed URLs for secure access

## Environment Configuration

### Required API Keys
- `OPENAI_API_KEY`: Whisper transcription (stored in Supabase secrets with fallback hardcoded)
- `ELEVENLABS_API_KEY`: Text-to-speech synthesis
- `GOOGLE_GENERATIVE_AI_API_KEY`: Gemini AI models (Pro 2.5/Flash 2.5)
- `NEXT_PUBLIC_FIRECRAWL_API_KEY`: Advanced web search and scraping capabilities

### Supabase Configuration
- Project ID: `ztakznzshlvqobzbuewb`
- Service role key required for edge functions
- Anon key for client-side operations

### Microsoft OAuth Setup
- Uses SPA app registration (no client secret in frontend)
- PKCE flow for secure authentication
- Redirect URI: `https://eva.thewell.solutions/auth/microsoft/callback`

## File Structure Highlights

### Core Voice Components
- `app/dashboard/talk-to-eva/` - Main voice interface
- `app/dashboard/voice-history/` - Session management UI
- `components/voice/` - Reusable voice UI components
- `hooks/useVoiceSession.ts` - Session state management

### AI Services
- `lib/services/eva-brain.ts` - Primary AI orchestration
- `lib/agents/eva-agent.ts` - A2A agent registration
- `supabase/functions/` - All edge functions

### Data Layer
- `lib/supabase/` - Database clients and schemas
- `supabase/migrations/` - Database version control
- `supabase/config.toml` - Infrastructure configuration

## Testing & Validation
- Edge functions validated via `validate-edge-functions.js`
- Test scripts verify CORS, authentication, and error handling
- Voice streaming tested with real audio data flows
- **Voice Stream Function**: Version 6 deployed with Microsoft OAuth compatibility
- All critical paths include automated validation

## Recent Fixes (Voice Streaming)
- **Issue**: "Failed to fetch" error in `processAudioChunk` for Microsoft OAuth users
- **Root Cause**: Authentication mismatch between Microsoft OAuth sessions and Supabase edge functions
- **Resolution**: 
  - Modified voice-stream edge function to accept both user tokens and anon key
  - Updated client-side authentication to use anon key for Microsoft OAuth users
  - Added OpenAI API key fallback handling in edge function
- **Status**: ✅ Fixed in voice-stream function version 6

## Eva Brain Capabilities (July 2025)

### Master Orchestrator Features
- **Universal Web Search**: Search ANY topic using Firecrawl API with advanced scraping
- **Multi-Tool Orchestration**: Coordinate multiple tools in parallel for complex tasks
- **Deep Thinking**: Analyze complex problems with multi-agent reasoning
- **Email Management**: Read/write emails via Microsoft Graph API
- **Task Management**: Create, update, and track tasks with full lifecycle control
- **Real-time Monitoring**: Set up monitors for any topic with continuous updates
- **Document Analysis**: Process PDFs, images, and documents with vision capabilities
- **Smart Navigation**: Navigate dashboard and execute workflows via voice

### Tool Calling System (9 Tools)
1. **search_web**: Universal search with Firecrawl API (markdown, links, HTML extraction)
2. **navigate_dashboard**: Voice-controlled navigation
3. **execute_workflow**: Master orchestration for specialized agents
4. **query_data**: Database queries across all tables
5. **create_task**: Task creation with full details
6. **update_task**: Task updates and status management
7. **read_emails**: Email retrieval from any folder
8. **write_email**: Email composition and drafts
9. **monitor_updates**: Real-time monitoring setup

### Advanced Search Implementation
- **Firecrawl Integration**: Full API with search, scrape, crawl, map, and extract
- **Fallback Strategies**: Alternative search when API unavailable
- **Targeted Scraping**: Specialized handling for crypto, news, financial data
- **Smart Content Extraction**: Intelligent formatting and relevance filtering

### Testing Resources
- **Interactive Search Test**: `src/test/eva-search-test.html`
- **Full Test Suite**: `src/test/eva-full-test.js`
- **Quick Start Guide**: `src/test/eva-quickstart.md`
- **Live Testing Guide**: `src/test/eva-live-test.md`

## Production Considerations
- Voice sessions auto-cleanup after 30 days
- Audio cache uses LRU eviction policy
- Error logging centralized in Supabase
- Real-time metrics via Supabase Realtime
- Microsoft Graph API respects user M365 license limits
- Firecrawl API rate limits apply for web search
- Multi-modal processing ready for vision and document analysis