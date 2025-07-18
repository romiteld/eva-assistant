'use client'

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MicrosoftCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setError(`OAuth error: ${errorDescription || error}`);
        setLoading(false);
        return;
      }

      if (!code) {
        setError('No authorization code received');
        setLoading(false);
        return;
      }

      try {
        // Parse state and validate
        const stateData = state ? JSON.parse(atob(state)) : {};
        const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
        const savedState = sessionStorage.getItem('oauth_state');

        if (!codeVerifier) {
          throw new Error('PKCE code verifier not found');
        }

        if (state !== savedState) {
          throw new Error('State mismatch - possible CSRF attack');
        }

        // Validate state timestamp (prevent replay attacks)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        if (stateData.timestamp < fiveMinutesAgo) {
          throw new Error('OAuth state has expired');
        }

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

        // Create session using the user data returned from token exchange
        const sessionResponse = await fetch('/api/auth/microsoft/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userData: {
              email: tokenData.user.email,
              name: tokenData.user.name,
              microsoftId: tokenData.user.id,
            },
            redirectTo: stateData.redirectTo || '/dashboard',
          }),
        });

        const sessionData = await sessionResponse.json();

        if (sessionData.error) {
          throw new Error(sessionData.error);
        }

        // Clear storage
        sessionStorage.removeItem('pkce_code_verifier');
        sessionStorage.removeItem('oauth_state');

        // Redirect to success page
        router.push(sessionData.redirectUrl);
        
      } catch (error) {
        console.error('Error during OAuth callback:', error);
        setError(error instanceof Error ? error.message : 'Authentication failed');
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Error</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/login')}
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