# Vercel Environment Variables Update Guide

## Overview
This guide explains how to update environment variables in Vercel for the ElevenLabs integration.

## Environment Variables to Add

### Required for ElevenLabs TTS
```bash
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

## Environment Variables to Keep

### Keep for Text Processing (Gemini)
```bash
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

These are still used for:
- AI content generation
- Post prediction analysis
- Agent-to-Agent (A2A) text processing
- Content analysis and optimization

## Environment Variables to Remove/Comment Out

### WebSocket Variables (No longer needed)
- `NEXT_PUBLIC_WS_URL` - WebSocket URL (if exists)
- `NEXT_PUBLIC_WEBSOCKET_URL` - WebSocket server URL (if exists)
- Any Gemini-specific WebSocket configuration variables

Note: The GEMINI_API_KEY variables should be kept as they're used for text processing, not voice/WebSocket functionality.

## Using Vercel CLI

### 1. Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Link to your project
```bash
vercel link
```

### 4. Add new environment variables
```bash
# Add ElevenLabs API key for all environments
vercel env add ELEVENLABS_API_KEY
```

### 5. List current environment variables
```bash
vercel env ls
```

### 6. Remove unused variables (if any exist)
```bash
# Example: Remove WebSocket-specific variables if they exist
# vercel env rm GEMINI_WS_URL
```

## Using Vercel Dashboard

1. Go to your project in the Vercel dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variable:
   - **Key**: `ELEVENLABS_API_KEY`
   - **Value**: Your ElevenLabs API key
   - **Environment**: Select all (Production, Preview, Development)
4. Ensure `GEMINI_API_KEY` exists for text processing
5. Remove any WebSocket-specific Gemini variables if present
6. Click "Save"

## Verification

After updating the environment variables:

1. Deploy your application:
   ```bash
   vercel --prod
   ```

2. Check that the TTS features work correctly
3. Verify that Gemini text processing (for agents) still functions

## Important Notes

- The `ELEVENLABS_API_KEY` is required for the TTS (Text-to-Speech) functionality
- Keep `GEMINI_API_KEY` as it's still used for AI text generation and analysis in the agent system
- WebSocket-related Gemini variables are no longer needed as voice functionality has been migrated to ElevenLabs
- Always use environment variables for API keys, never commit them to the repository