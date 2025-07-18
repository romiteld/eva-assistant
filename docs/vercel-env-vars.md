# Required Environment Variables for Vercel

## Gemini API Configuration
Add these environment variables in your Vercel project settings:

```
NEXT_PUBLIC_GEMINI_API_KEY=[YOUR_GEMINI_API_KEY]
GOOGLE_GENERATIVE_AI_API_KEY=[YOUR_GEMINI_API_KEY]
```

## Why Both?
- `NEXT_PUBLIC_GEMINI_API_KEY` - Used by the frontend Voice Agent components
- `GOOGLE_GENERATIVE_AI_API_KEY` - Used by the @ai-sdk/google package in API routes

## To Add in Vercel:
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add both variables with the same API key value
4. Make sure they're available for all environments (Production, Preview, Development)
5. Redeploy your application for changes to take effect

## Note on Edge Functions
The Supabase Edge Function for the WebSocket proxy currently has the API key hardcoded. In production, you should:
1. Set up the GEMINI_API_KEY secret in Supabase Dashboard
2. Update the Edge Function to use `Deno.env.get('GEMINI_API_KEY')` instead of the hardcoded value