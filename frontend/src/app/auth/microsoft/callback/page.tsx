"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// Microsoft OAuth configuration from environment
const TENANT_ID = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || process.env.NEXT_PUBLIC_ENTRA_TENANT_ID || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID || '';

// Helper function to get cookie value
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

export default function MicrosoftCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        setError(`OAuth error: ${errorDescription || error}`);
        setLoading(false);
        return;
      }

      if (!code) {
        setError("No authorization code received");
        setLoading(false);
        return;
      }

      try {
        // Parse state and validate
        const stateData = state ? JSON.parse(atob(state)) : {};
        
        // Try to retrieve PKCE verifier from multiple storage locations
        console.log("[OAuth Callback] Starting PKCE retrieval...");
        console.log("[OAuth Callback] Current cookies:", document.cookie);
        
        let codeVerifier = sessionStorage.getItem("pkce_code_verifier");
        let savedState = sessionStorage.getItem("oauth_state");
        console.log("[OAuth Callback] SessionStorage - verifier:", !!codeVerifier, "state:", !!savedState);

        // Fallback to localStorage
        if (!codeVerifier) {
          try {
            codeVerifier = localStorage.getItem("pkce_code_verifier");
            console.log("[OAuth Callback] Retrieved verifier from localStorage");
          } catch (e) {
            console.warn("[OAuth Callback] Failed to read verifier from localStorage:", e);
          }
        }
        if (!savedState) {
          try {
            savedState = localStorage.getItem("oauth_state");
            console.log("[OAuth Callback] Retrieved state from localStorage");
          } catch (e) {
            console.warn("[OAuth Callback] Failed to read state from localStorage:", e);
          }
        }

        // Fallback to cookies
        if (!codeVerifier) {
          const match = document.cookie.match(
            /(?:^|; )pkce_code_verifier=([^;]*)/,
          );
          codeVerifier = match ? decodeURIComponent(match[1]) : null;
          if (codeVerifier) {
            console.log("[OAuth Callback] Retrieved verifier from cookies");
          }
        }
        if (!savedState) {
          const match = document.cookie.match(/(?:^|; )oauth_state=([^;]*)/);
          savedState = match ? decodeURIComponent(match[1]) : null;
          if (savedState) {
            console.log("[OAuth Callback] Retrieved state from cookies");
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
                console.log("[OAuth Callback] Retrieved from window storage");
              }
            }
          } catch (e) {
            console.warn("[OAuth Callback] Failed to read from window storage:", e);
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
                console.log("[OAuth Callback] Retrieved from timestamped keys");
              }
            }
          } catch (e) {
            console.warn("[OAuth Callback] Failed to read timestamped keys:", e);
          }
        }

        // 6. Final fallback: try to get PKCE from state parameter itself
        if (!codeVerifier && stateData.pkce) {
          codeVerifier = stateData.pkce;
          console.log("[OAuth Callback] Retrieved verifier from state parameter (ultimate fallback)");
        }

        console.log("[OAuth Callback] Final retrieval status - verifier:", !!codeVerifier, "state:", !!savedState);

        if (!codeVerifier) {
          // Log all available storage for debugging
          console.error("[OAuth Callback] PKCE verifier not found in any storage!");
          console.error("[OAuth Callback] SessionStorage keys:", Object.keys(sessionStorage));
          console.error("[OAuth Callback] LocalStorage keys:", Object.keys(localStorage));
          console.error("[OAuth Callback] All cookies:", document.cookie);
          console.error("[OAuth Callback] State data:", stateData);
          console.error("[OAuth Callback] Window storage:", typeof window !== 'undefined' ? (window as any).__oauthStorage : null);
          throw new Error("PKCE code verifier not found. Please ensure cookies and local storage are enabled and try again.");
        }

        if (state !== savedState) {
          const match = document.cookie.match(/(?:^|; )oauth_state=([^;]*)/);
          const cookieState = match ? decodeURIComponent(match[1]) : null;
          if (!cookieState || state !== cookieState) {
            throw new Error("State mismatch - possible CSRF attack");
          }
        }

        // Validate state timestamp (prevent replay attacks)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (stateData.timestamp < fiveMinutesAgo) {
          throw new Error("OAuth state has expired");
        }

        // For SPAs, exchange token directly with Microsoft (cross-origin)
        const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
        const tokenParams = new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${window.location.origin}/auth/microsoft/callback`,
          code_verifier: codeVerifier,
        });

        // Direct cross-origin request to Microsoft
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenParams.toString(),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
          throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
        }
        
        // Get user info
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        const userData = await userResponse.json();

        if (!userResponse.ok) {
          throw new Error('Failed to get user information');
        }
        
        // Store tokens server-side
        const storeResponse = await fetch("/api/auth/microsoft/store-tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...tokenData,
            user: userData,
          }),
        });
        
        if (!storeResponse.ok) {
          console.error('Failed to store tokens');
        }

        // Create session using the user data returned from token exchange
        const sessionResponse = await fetch("/api/auth/microsoft/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userData: {
              email: userData.mail || userData.userPrincipalName,
              name: userData.displayName,
              microsoftId: userData.id,
            },
            redirectTo: stateData.redirectTo || "/dashboard",
          }),
        });

        const sessionData = await sessionResponse.json();

        if (sessionData.error) {
          throw new Error(sessionData.error);
        }

        // Clear all storage locations including enhanced storage
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
        document.cookie = "pkce_code_verifier=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "oauth_state=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "oauth_storage_timestamp=; path=/; max-age=0; SameSite=Lax";
        
        // Clear window storage
        if (typeof window !== 'undefined') {
          try {
            delete (window as any).__oauthStorage;
          } catch (e) {
            console.warn("Failed to clear window storage:", e);
          }
        }

        // Redirect to success page
        router.push(sessionData.redirectUrl);
      } catch (error) {
        console.error("Error during OAuth callback:", error);
        setError(
          error instanceof Error ? error.message : "Authentication failed",
        );
        setLoading(false);
      }
    }

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Authentication Error
            </h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
