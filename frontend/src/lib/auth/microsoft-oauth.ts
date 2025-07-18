// Microsoft OAuth with PKCE implementation

// PKCE helper functions
function base64URLEncode(str: ArrayBuffer) {
  // Use a more reliable method that won't cause stack overflow
  const bytes = new Uint8Array(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function sha256(plain: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return base64URLEncode(array.buffer);
}

function setCookie(name: string, value: string, maxAgeSeconds = 300) {
  // Use more permissive cookie settings for OAuth flow
  const isSecure = window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(
      "(?:^|; )" +
        name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") +
        "=([^;]*)",
    ),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

async function generateCodeChallenge(codeVerifier: string) {
  const hashed = await sha256(codeVerifier);
  return base64URLEncode(hashed);
}

export async function signInWithMicrosoftPKCE() {
  // Check if we're in a browser environment
  if (typeof window === "undefined") {
    throw new Error("Microsoft OAuth can only be used in the browser");
  }

  // Check if crypto.subtle is available
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API is not available in this browser");
  }

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Microsoft OAuth configuration - Use environment variables
  const clientId =
    process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID ||
    process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
  const tenantId =
    process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID ||
    process.env.NEXT_PUBLIC_ENTRA_TENANT_ID;

  if (!clientId || !tenantId) {
    throw new Error(
      "Microsoft OAuth configuration missing. Please set NEXT_PUBLIC_MICROSOFT_CLIENT_ID and NEXT_PUBLIC_MICROSOFT_TENANT_ID environment variables.",
    );
  }

  // Use environment variable for redirect URI, fallback to current origin for local development
  const redirectUri = process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI || `${window.location.origin}/auth/microsoft/callback`;
  const scope =
    "openid email profile offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/Contacts.ReadWrite https://graph.microsoft.com/Files.ReadWrite.All";

  // Create secure state parameter without sensitive data
  const state = {
    redirectTo: `${window.location.origin}/dashboard`,
    provider: "azure",
    timestamp: Date.now(),
    nonce: generateCodeVerifier(), // Add nonce for CSRF protection
  };

  const encodedState = btoa(JSON.stringify(state));

  // Store in multiple locations for better reliability
  // 1. sessionStorage (primary)
  sessionStorage.setItem("pkce_code_verifier", codeVerifier);
  sessionStorage.setItem("oauth_state", encodedState);
  
  // 2. localStorage (secondary fallback)
  try {
    localStorage.setItem("pkce_code_verifier", codeVerifier);
    localStorage.setItem("oauth_state", encodedState);
  } catch (e) {
    console.warn("Failed to store in localStorage:", e);
  }
  
  // 3. Cookies (tertiary fallback)
  setCookie("pkce_code_verifier", codeVerifier);
  setCookie("oauth_state", encodedState);

  // Construct the OAuth URL with PKCE
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: scope,
    state: encodedState,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account", // Allow user to select account
  });

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

  // Redirect to Microsoft login
  window.location.href = authUrl;
}

// Handle the OAuth callback
export async function handleMicrosoftCallback(code: string, state: string) {
  // Try to retrieve from multiple storage locations
  let codeVerifier = sessionStorage.getItem("pkce_code_verifier");
  let savedState = sessionStorage.getItem("oauth_state");

  // Fallback to localStorage
  if (!codeVerifier) {
    try {
      codeVerifier = localStorage.getItem("pkce_code_verifier");
    } catch (e) {
      console.warn("Failed to read from localStorage:", e);
    }
  }
  if (!savedState) {
    try {
      savedState = localStorage.getItem("oauth_state");
    } catch (e) {
      console.warn("Failed to read from localStorage:", e);
    }
  }

  // Fallback to cookies if storage was cleared
  if (!codeVerifier) {
    codeVerifier = getCookie("pkce_code_verifier");
  }
  if (!savedState) {
    savedState = getCookie("oauth_state");
  }

  if (!codeVerifier) {
    throw new Error("PKCE code verifier not found. Please ensure cookies and local storage are enabled and try again.");
  }

  if (state !== savedState) {
    const cookieState = getCookie("oauth_state");
    if (cookieState && state === cookieState) {
      savedState = cookieState;
    } else {
      throw new Error("State mismatch - possible CSRF attack");
    }
  }

  // Validate state timestamp (prevent replay attacks)
  try {
    const stateData = JSON.parse(atob(state));
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (stateData.timestamp < fiveMinutesAgo) {
      throw new Error("OAuth state has expired");
    }
  } catch (e) {
    throw new Error("Invalid OAuth state parameter");
  }

  // Clean up all storage locations
  sessionStorage.removeItem("pkce_code_verifier");
  sessionStorage.removeItem("oauth_state");
  
  try {
    localStorage.removeItem("pkce_code_verifier");
    localStorage.removeItem("oauth_state");
  } catch (e) {
    console.warn("Failed to clear localStorage:", e);
  }
  
  setCookie("pkce_code_verifier", "", 0);
  setCookie("oauth_state", "", 0);

  // Exchange code for tokens using our secure server-side endpoint
  const tokenResponse = await fetch("/api/auth/microsoft/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri: process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI || `${window.location.origin}/auth/microsoft/callback`,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    throw new Error(tokenData.error || "Token exchange failed");
  }

  return tokenData;
}
