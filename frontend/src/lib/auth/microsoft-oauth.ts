// Microsoft OAuth with PKCE implementation

// PKCE helper functions
function base64URLEncode(str: ArrayBuffer) {
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(str))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(plain: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return base64URLEncode(array.buffer);
}

async function generateCodeChallenge(codeVerifier: string) {
  const hashed = await sha256(codeVerifier);
  return base64URLEncode(hashed);
}

export async function signInWithMicrosoftPKCE() {
  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Microsoft OAuth configuration
  const clientId = 'bfa77df6-6952-4d0f-9816-003b3101b9da';
  const tenantId = '29ee1479-b5f7-48c5-b665-7de9a8a9033e';
  const redirectUri = `${window.location.origin}/auth/microsoft/callback`;
  const scope = 'openid email profile offline_access';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  
  // Create state parameter that includes the code verifier
  const state = {
    redirectTo: `${window.location.origin}/dashboard`,
    provider: 'azure',
    supabaseUrl: supabaseUrl,
    timestamp: Date.now(),
    codeVerifier: codeVerifier  // Include code verifier in state
  };
  
  const encodedState = btoa(JSON.stringify(state));
  
  // Store in sessionStorage for client-side callback
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', encodedState);
  
  // Construct the OAuth URL with PKCE
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scope,
    state: encodedState,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account', // Allow user to select account
  });
  
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  
  // Redirect to Microsoft login
  window.location.href = authUrl;
}

// Handle the OAuth callback
export async function handleMicrosoftCallback(code: string, state: string) {
  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
  const savedState = sessionStorage.getItem('oauth_state');
  
  if (!codeVerifier) {
    throw new Error('PKCE code verifier not found');
  }
  
  if (state !== savedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }
  
  // Clean up session storage
  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('oauth_state');
  
  // Exchange code for tokens using our secure server-side endpoint
  const tokenResponse = await fetch('/api/auth/microsoft/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri: `${window.location.origin}/auth/microsoft/callback`,
    }),
  });
  
  const tokenData = await tokenResponse.json();
  
  if (!tokenResponse.ok) {
    throw new Error(tokenData.error || 'Token exchange failed');
  }
  
  return tokenData;
}