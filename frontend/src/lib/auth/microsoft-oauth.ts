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

function setCookie(name: string, value: string, maxAgeSeconds = 900) {
  // Use more permissive cookie settings for OAuth flow
  const isSecure = window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  // Use None for SameSite in production to allow cross-site OAuth flow
  const sameSite = isSecure ? 'None' : 'Lax';
  
  // Set cookie with domain to ensure cross-subdomain availability
  let domain = '';
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // For production domains, set domain to allow cross-subdomain access
    if (hostname.includes('.') && !hostname.includes('localhost')) {
      domain = `; Domain=.${hostname.split('.').slice(-2).join('.')}`;
    }
  }
  
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=${sameSite}${secureFlag}${domain}`;
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

  // Create secure state parameter that includes PKCE verifier as fallback
  const state = {
    redirectTo: `${window.location.origin}/dashboard`,
    provider: "azure",
    timestamp: Date.now(),
    nonce: generateCodeVerifier(), // Add nonce for CSRF protection
    pkce: codeVerifier, // Include PKCE verifier in state as ultimate fallback
  };

  const encodedState = btoa(JSON.stringify(state));

  // Store in multiple locations for better reliability
  console.log("[Microsoft OAuth] Storing PKCE verifier and state...");
  
  // Enhanced storage with unique timestamp-based keys to prevent conflicts
  const storageTimestamp = Date.now();
  const timestampedVerifierKey = `pkce_code_verifier_${storageTimestamp}`;
  const timestampedStateKey = `oauth_state_${storageTimestamp}`;
  
  // 1. sessionStorage (primary)
  try {
    sessionStorage.setItem("pkce_code_verifier", codeVerifier);
    sessionStorage.setItem("oauth_state", encodedState);
    // Also store with timestamped keys as backup
    sessionStorage.setItem(timestampedVerifierKey, codeVerifier);
    sessionStorage.setItem(timestampedStateKey, encodedState);
    sessionStorage.setItem("oauth_storage_timestamp", storageTimestamp.toString());
    console.log("[Microsoft OAuth] Stored in sessionStorage successfully");
  } catch (e) {
    console.error("[Microsoft OAuth] Failed to store in sessionStorage:", e);
  }
  
  // 2. localStorage (secondary fallback)
  try {
    localStorage.setItem("pkce_code_verifier", codeVerifier);
    localStorage.setItem("oauth_state", encodedState);
    // Also store with timestamped keys as backup
    localStorage.setItem(timestampedVerifierKey, codeVerifier);
    localStorage.setItem(timestampedStateKey, encodedState);
    localStorage.setItem("oauth_storage_timestamp", storageTimestamp.toString());
    console.log("[Microsoft OAuth] Stored in localStorage successfully");
  } catch (e) {
    console.warn("[Microsoft OAuth] Failed to store in localStorage:", e);
  }
  
  // 3. Cookies (tertiary fallback)
  setCookie("pkce_code_verifier", codeVerifier);
  setCookie("oauth_state", encodedState);
  setCookie("oauth_storage_timestamp", storageTimestamp.toString());
  console.log("[Microsoft OAuth] Stored in cookies");
  
  // 4. Enhanced in-memory fallback using window object
  try {
    if (typeof window !== 'undefined') {
      (window as any).__oauthStorage = {
        pkce_code_verifier: codeVerifier,
        oauth_state: encodedState,
        timestamp: storageTimestamp
      };
    }
  } catch (e) {
    console.warn("[Microsoft OAuth] Failed to store in window object:", e);
  }
  
  // Verify storage
  const verifyStorage = {
    sessionStorage: sessionStorage.getItem("pkce_code_verifier") !== null,
    localStorage: localStorage.getItem("pkce_code_verifier") !== null,
    cookie: getCookie("pkce_code_verifier") !== null,
    window: typeof window !== 'undefined' && (window as any).__oauthStorage !== undefined
  };
  console.log("[Microsoft OAuth] Storage verification:", verifyStorage);

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
  console.log("[Microsoft OAuth Callback] Starting enhanced PKCE retrieval...");
  
  // Try to retrieve from multiple storage locations with enhanced fallback
  let codeVerifier: string | null = null;
  let savedState: string | null = null;
  
  // 1. Try sessionStorage (primary)
  try {
    codeVerifier = sessionStorage.getItem("pkce_code_verifier");
    savedState = sessionStorage.getItem("oauth_state");
    if (codeVerifier) {
      console.log("[Microsoft OAuth Callback] Retrieved from sessionStorage");
    }
  } catch (e) {
    console.warn("[Microsoft OAuth Callback] Failed to read from sessionStorage:", e);
  }

  // 2. Try localStorage (secondary)
  if (!codeVerifier) {
    try {
      codeVerifier = localStorage.getItem("pkce_code_verifier");
      savedState = localStorage.getItem("oauth_state");
      if (codeVerifier) {
        console.log("[Microsoft OAuth Callback] Retrieved from localStorage");
      }
    } catch (e) {
      console.warn("[Microsoft OAuth Callback] Failed to read from localStorage:", e);
    }
  }

  // 3. Try cookies (tertiary)
  if (!codeVerifier) {
    codeVerifier = getCookie("pkce_code_verifier");
    savedState = getCookie("oauth_state");
    if (codeVerifier) {
      console.log("[Microsoft OAuth Callback] Retrieved from cookies");
    }
  }

  // 4. Try window object (quaternary)
  if (!codeVerifier && typeof window !== 'undefined') {
    try {
      const windowStorage = (window as any).__oauthStorage;
      if (windowStorage) {
        codeVerifier = windowStorage.pkce_code_verifier;
        savedState = windowStorage.oauth_state;
        if (codeVerifier) {
          console.log("[Microsoft OAuth Callback] Retrieved from window storage");
        }
      }
    } catch (e) {
      console.warn("[Microsoft OAuth Callback] Failed to read from window storage:", e);
    }
  }

  // 5. Try timestamped keys if available
  if (!codeVerifier) {
    try {
      const timestamp = sessionStorage.getItem("oauth_storage_timestamp") || 
                       localStorage.getItem("oauth_storage_timestamp") || 
                       getCookie("oauth_storage_timestamp");
      
      if (timestamp) {
        const timestampedVerifierKey = `pkce_code_verifier_${timestamp}`;
        const timestampedStateKey = `oauth_state_${timestamp}`;
        
        codeVerifier = sessionStorage.getItem(timestampedVerifierKey) || 
                      localStorage.getItem(timestampedVerifierKey);
        savedState = sessionStorage.getItem(timestampedStateKey) || 
                    localStorage.getItem(timestampedStateKey);
        
        if (codeVerifier) {
          console.log("[Microsoft OAuth Callback] Retrieved from timestamped keys");
        }
      }
    } catch (e) {
      console.warn("[Microsoft OAuth Callback] Failed to read timestamped keys:", e);
    }
  }

  // 6. Final fallback: try to extract from state parameter
  if (!codeVerifier) {
    try {
      const stateData = JSON.parse(atob(state));
      if (stateData.pkce) {
        codeVerifier = stateData.pkce;
        console.log("[Microsoft OAuth Callback] Retrieved from state parameter (ultimate fallback)");
      }
    } catch (e) {
      console.warn("[Microsoft OAuth Callback] Failed to parse state parameter:", e);
    }
  }

  // Log comprehensive debugging information
  console.log("[Microsoft OAuth Callback] Final status:", {
    codeVerifierFound: !!codeVerifier,
    savedStateFound: !!savedState,
    sessionStorageKeys: Object.keys(sessionStorage),
    localStorageKeys: Object.keys(localStorage),
    cookies: document.cookie,
    windowStorage: typeof window !== 'undefined' ? (window as any).__oauthStorage : null
  });

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

  // Clean up all storage locations including enhanced storage
  const timestamp = sessionStorage.getItem("oauth_storage_timestamp") || 
                   localStorage.getItem("oauth_storage_timestamp") || 
                   getCookie("oauth_storage_timestamp");
  
  // Clear standard keys
  sessionStorage.removeItem("pkce_code_verifier");
  sessionStorage.removeItem("oauth_state");
  sessionStorage.removeItem("oauth_storage_timestamp");
  
  // Clear timestamped keys if available
  if (timestamp) {
    sessionStorage.removeItem(`pkce_code_verifier_${timestamp}`);
    sessionStorage.removeItem(`oauth_state_${timestamp}`);
  }
  
  try {
    localStorage.removeItem("pkce_code_verifier");
    localStorage.removeItem("oauth_state");
    localStorage.removeItem("oauth_storage_timestamp");
    
    // Clear timestamped keys if available
    if (timestamp) {
      localStorage.removeItem(`pkce_code_verifier_${timestamp}`);
      localStorage.removeItem(`oauth_state_${timestamp}`);
    }
  } catch (e) {
    console.warn("Failed to clear localStorage:", e);
  }
  
  // Clear cookies
  setCookie("pkce_code_verifier", "", 0);
  setCookie("oauth_state", "", 0);
  setCookie("oauth_storage_timestamp", "", 0);
  
  // Clear window storage
  if (typeof window !== 'undefined') {
    try {
      delete (window as any).__oauthStorage;
    } catch (e) {
      console.warn("Failed to clear window storage:", e);
    }
  }

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
