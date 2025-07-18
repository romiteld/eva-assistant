# Supabase Edge Function Environment Setup

## Current Issue
The Edge Function currently has the Gemini API key hardcoded, which is not secure for production.

## Steps to Fix:

### 1. Add Secret in Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to Settings → Edge Functions
3. Add a new secret:
   - Name: `GEMINI_API_KEY`
   - Value: `[YOUR_GEMINI_API_KEY]`

### 2. Update the Edge Function
Replace the hardcoded API key with environment variable:

```typescript
// Change this:
const GEMINI_API_KEY = '[HARDCODED_KEY]'

// To this:
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
```

### 3. Redeploy the Edge Function
After adding the secret, redeploy the Edge Function for it to pick up the environment variable.

## Alternative: Use Supabase CLI
If you have Supabase CLI installed locally:

```bash
# Set the secret
supabase secrets set GEMINI_API_KEY=[YOUR_GEMINI_API_KEY]

# Deploy the function
supabase functions deploy gemini-websocket
```

## Security Note
Never commit API keys to your repository. Always use environment variables or secrets management.