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

  // Use environment variable for redirect URI, but override for local development
  let redirectUri = process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI || `${window.location.origin}/auth/microsoft/callback`;
  
  // If we're in local development but have a production redirect URI, use the local one
  if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && 
      redirectUri && !redirectUri.includes('localhost')) {
    redirectUri = `${window.location.origin}/auth/microsoft/callback`;
    console.log("[Microsoft OAuth] Using local redirect URI for development:", redirectUri);
  }
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
    window: typeof window !== 'undefined' && (window as any).__oauthStorage !== undefined,
    stateInSession: sessionStorage.getItem("oauth_state") !== null,
    stateInLocal: localStorage.getItem("oauth_state") !== null,
    stateInCookie: getCookie("oauth_state") !== null
  };
  console.log("[Microsoft OAuth] Storage verification:", verifyStorage);
  console.log("[Microsoft OAuth] Encoded state being sent:", encodedState);

  // Construct the OAuth URL with PKCE
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code", // Use authorization code flow only
    redirect_uri: redirectUri,
    response_mode: "query", // Use query for standard OAuth flow
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

  // Enhanced state validation with better debugging
  if (!savedState || state !== savedState) {
    console.warn("[Microsoft OAuth Callback] State mismatch detected");
    console.log("[Microsoft OAuth Callback] Received state:", state);
    console.log("[Microsoft OAuth Callback] Saved state:", savedState);
    
    // Try additional recovery methods
    const cookieState = getCookie("oauth_state");
    console.log("[Microsoft OAuth Callback] Cookie state:", cookieState);
    
    // Check window storage
    let windowState: string | null = null;
    if (typeof window !== 'undefined' && (window as any).__oauthStorage) {
      windowState = (window as any).__oauthStorage.oauth_state;
      console.log("[Microsoft OAuth Callback] Window state:", windowState);
    }
    
    // Try timestamped storage
    const timestamp = sessionStorage.getItem("oauth_storage_timestamp") || 
                     localStorage.getItem("oauth_storage_timestamp") || 
                     getCookie("oauth_storage_timestamp");
    let timestampedState: string | null = null;
    if (timestamp) {
      timestampedState = sessionStorage.getItem(`oauth_state_${timestamp}`) || 
                        localStorage.getItem(`oauth_state_${timestamp}`);
      console.log("[Microsoft OAuth Callback] Timestamped state:", timestampedState);
    }
    
    // Also check if state might be URL encoded
    const decodedState = decodeURIComponent(state);
    const decodedSavedState = savedState ? decodeURIComponent(savedState) : null;
    
    // Try to match with any of the stored states
    const validStates = [savedState, cookieState, windowState, timestampedState].filter(Boolean);
    const stateMatched = validStates.some(validState => 
      state === validState || decodedState === validState || 
      (validState && state === decodeURIComponent(validState))
    );
    
    if (stateMatched) {
      console.log("[Microsoft OAuth Callback] State matched with one of the stored values");
    } else {
      // Try to parse the state to check if it's valid even without matching
      try {
        const stateData = JSON.parse(atob(state));
        if (stateData.provider === "azure" && stateData.timestamp && stateData.nonce) {
          console.warn("[Microsoft OAuth Callback] State structure is valid but doesn't match saved state");
          console.warn("[Microsoft OAuth Callback] This might be due to storage being cleared or blocked");
          
          // Check if state is recent (within 10 minutes)
          const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
          if (stateData.timestamp > tenMinutesAgo) {
            console.warn("[Microsoft OAuth Callback] State is recent, likely a storage issue");
            // In development or if state is valid and recent, continue
            if (window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('vercel.app')) {
              console.warn("[Microsoft OAuth Callback] Non-production environment - continuing despite state mismatch");
            } else {
              // In production, if we have a valid recent state, it's likely a storage issue
              // Log detailed info for debugging
              console.error("[Microsoft OAuth Callback] Production state mismatch - storage details:");
              console.error("- SessionStorage keys:", Object.keys(sessionStorage));
              console.error("- LocalStorage keys:", Object.keys(localStorage));
              console.error("- Document cookies:", document.cookie);
              console.error("- Window storage exists:", !!(window as any).__oauthStorage);
              throw new Error("State mismatch - possible CSRF attack. Try clearing your browser storage and cookies, then login again.");
            }
          } else {
            throw new Error("OAuth state has expired - please try logging in again");
          }
        } else {
          throw new Error("Invalid state structure");
        }
      } catch (parseError) {
        console.error("[Microsoft OAuth Callback] Failed to parse state:", parseError);
        console.error("[Microsoft OAuth Callback] State validation failed completely");
        throw new Error("State mismatch - possible CSRF attack. Try clearing your browser storage and cookies, then login again.");
      }
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

  // Try server-side exchange first (more secure)
  try {
    const tokenResponse = await fetch("/api/auth/microsoft/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        codeVerifier,
        // CRITICAL: Use the EXACT same redirect URI that was used during authorization
        // This must match what was sent in signInWithMicrosoftPKCE
        redirectUri: `${window.location.origin}/auth/microsoft/callback`,
      }),
    });

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      return tokenData;
    }

    // If server-side fails, log the error
    const errorData = await tokenResponse.json();
    console.warn("[Microsoft OAuth] Server-side token exchange failed:", errorData.error);
  } catch (error) {
    console.warn("[Microsoft OAuth] Server-side token exchange error:", error);
  }

  // Fallback to client-side exchange for SPAs
  console.log("[Microsoft OAuth] Using client-side token exchange");
  
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
  const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || process.env.NEXT_PUBLIC_ENTRA_TENANT_ID;
  
  if (!clientId || !tenantId) {
    throw new Error("Microsoft OAuth configuration missing");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code: code,
    // CRITICAL: Use the EXACT same redirect URI that was used during authorization
    redirect_uri: `${window.location.origin}/auth/microsoft/callback`,
    code_verifier: codeVerifier,
  });

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      // Check for specific CORS error
      if (tokenData.error === 'invalid_request' && 
          tokenData.error_description?.includes('cross-origin token redemption')) {
        throw new Error(
          "CORS Error: Your redirect URI must be registered as a 'Single-Page Application' type in Azure AD. " +
          "Please update your app registration to use the SPA platform instead of Web platform."
        );
      }
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
    }

    return tokenData;
  } catch (error) {
    // Handle CORS errors specifically
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(
        "CORS Error: Unable to exchange authorization code. " +
        "Ensure your redirect URI is registered as a Single-Page Application (SPA) in Azure AD, " +
        "not as a Web application. This is required for client-side token exchange."
      );
    }
    throw error;
  }
}
