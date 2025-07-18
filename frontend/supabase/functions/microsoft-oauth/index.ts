import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Helper to generate secure random strings
function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Base64 URL encoding for PKCE
function base64URLEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

// Generate PKCE challenge
async function generateChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return base64URLEncode(hash)
}

// OAuth configuration
const config = {
  clientId: Deno.env.get('MICROSOFT_CLIENT_ID')!,
  clientSecret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
  tenantId: Deno.env.get('MICROSOFT_TENANT_ID') || 'common',
  redirectUri: Deno.env.get('MICROSOFT_REDIRECT_URI')!,
  scope: 'openid email profile offline_access User.Read'
}

serve(async (req: Request) => {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Handle different OAuth actions
    switch (action) {
      case 'login':
        return await handleLogin(supabase, url)
      
      case 'callback':
        return await handleCallback(supabase, url, req)
      
      case 'refresh':
        return await handleRefresh(supabase, req)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }), 
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
    }
  } catch (error) {
    console.error('OAuth error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Authentication failed',
        details: error.message 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

async function handleLogin(supabase: any, url: URL): Promise<Response> {
  // Generate OAuth session
  const state = generateSecureRandom()
  const codeVerifier = generateSecureRandom(43) // 43 chars for 256 bits
  const codeChallenge = await generateChallenge(codeVerifier)
  
  // Store session in database
  const { data: session, error } = await supabase
    .from('oauth_sessions')
    .insert({
      state,
      code_verifier: codeVerifier,
      provider: 'microsoft',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to create OAuth session: ${error.message}`)
  }
  
  // Build Microsoft OAuth URL
  const authParams = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: config.scope,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account'
  })
  
  const authUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${authParams}`
  
  // Redirect to Microsoft
  return Response.redirect(authUrl, 302)
}

async function handleCallback(supabase: any, url: URL, req: Request): Promise<Response> {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  
  // Handle OAuth errors
  if (error) {
    const errorDescription = url.searchParams.get('error_description')
    return Response.redirect(
      `${url.origin}/auth/error?error=${error}&description=${encodeURIComponent(errorDescription || '')}`,
      302
    )
  }
  
  if (!code || !state) {
    return Response.redirect(
      `${url.origin}/auth/error?error=missing_params`,
      302
    )
  }
  
  // Retrieve OAuth session
  const { data: session, error: sessionError } = await supabase
    .from('oauth_sessions')
    .select('code_verifier')
    .eq('state', state)
    .eq('provider', 'microsoft')
    .gte('expires_at', new Date().toISOString())
    .single()
  
  if (sessionError || !session) {
    return Response.redirect(
      `${url.origin}/auth/error?error=invalid_state`,
      302
    )
  }
  
  // Exchange code for tokens
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        redirect_uri: config.redirectUri,
        code_verifier: session.code_verifier
      })
    }
  )
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    console.error('Token exchange failed:', error)
    return Response.redirect(
      `${url.origin}/auth/error?error=token_exchange_failed`,
      302
    )
  }
  
  const tokens = await tokenResponse.json()
  
  // Get user info from Microsoft Graph
  const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`
    }
  })
  
  if (!userResponse.ok) {
    return Response.redirect(
      `${url.origin}/auth/error?error=user_info_failed`,
      302
    )
  }
  
  const userInfo = await userResponse.json()
  
  // Create or update Supabase user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: userInfo.mail || userInfo.userPrincipalName,
    email_confirm: true,
    user_metadata: {
      full_name: userInfo.displayName,
      avatar_url: null, // Microsoft Graph doesn't return avatar in basic scope
      provider: 'microsoft',
      provider_id: userInfo.id,
      preferred_username: userInfo.userPrincipalName
    },
    app_metadata: {
      provider: 'microsoft',
      providers: ['microsoft']
    }
  })
  
  if (authError && authError.message.includes('already exists')) {
    // User exists, update their metadata
    const { data: users } = await supabase.auth.admin.listUsers()
    const existingUser = users?.users.find(u => u.email === userInfo.mail || u.email === userInfo.userPrincipalName)
    
    if (existingUser) {
      await supabase.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...existingUser.user_metadata,
          full_name: userInfo.displayName,
          provider: 'microsoft',
          provider_id: userInfo.id
        }
      })
    }
  }
  
  // Store tokens securely (encrypted in production)
  const userId = authData?.user?.id || (await supabase.auth.admin.listUsers()).data?.users.find(
    u => u.email === userInfo.mail || u.email === userInfo.userPrincipalName
  )?.id
  
  if (userId) {
    await supabase
      .from('user_oauth_tokens')
      .upsert({
        user_id: userId,
        provider: 'microsoft',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
  }
  
  // Clean up OAuth session
  await supabase
    .from('oauth_sessions')
    .delete()
    .eq('state', state)
  
  // Create Supabase session
  const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: userInfo.mail || userInfo.userPrincipalName,
  })
  
  // Redirect to app with session
  return Response.redirect(
    `${url.origin}/auth/callback?token=${sessionData?.properties?.hashed_token}`,
    302
  )
}

async function handleRefresh(supabase: any, req: Request): Promise<Response> {
  // Get auth header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  
  const token = authHeader.substring(7)
  
  // Verify JWT and get user
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  
  // Get stored refresh token
  const { data: tokenData } = await supabase
    .from('user_oauth_tokens')
    .select('refresh_token')
    .eq('user_id', user.id)
    .eq('provider', 'microsoft')
    .single()
  
  if (!tokenData?.refresh_token) {
    return new Response(
      JSON.stringify({ error: 'No refresh token found' }),
      { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  
  // Refresh Microsoft tokens
  const refreshResponse = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: tokenData.refresh_token,
        scope: config.scope
      })
    }
  )
  
  if (!refreshResponse.ok) {
    return new Response(
      JSON.stringify({ error: 'Token refresh failed' }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  
  const newTokens = await refreshResponse.json()
  
  // Update stored tokens
  await supabase
    .from('user_oauth_tokens')
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokenData.refresh_token,
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)
    .eq('provider', 'microsoft')
  
  return new Response(
    JSON.stringify({
      access_token: newTokens.access_token,
      expires_in: newTokens.expires_in
    }),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}