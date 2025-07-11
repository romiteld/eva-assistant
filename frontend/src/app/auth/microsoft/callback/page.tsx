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
        // Parse state to get code verifier
        const stateData = state ? JSON.parse(atob(state)) : {};
        const codeVerifier = stateData.codeVerifier;

        if (!codeVerifier) {
          // Try to get from sessionStorage as backup
          const storedVerifier = sessionStorage.getItem('pkce_code_verifier');
          if (!storedVerifier) {
            throw new Error('PKCE code verifier not found');
          }
          stateData.codeVerifier = storedVerifier;
        }

        // Exchange code for tokens (client-side for SPA)
        const tokenUrl = `https://login.microsoftonline.com/29ee1479-b5f7-48c5-b665-7de9a8a9033e/oauth2/v2.0/token`;
        
        const tokenParams = new URLSearchParams({
          client_id: 'bfa77df6-6952-4d0f-9816-003b3101b9da',
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${window.location.origin}/auth/microsoft/callback`,
          code_verifier: stateData.codeVerifier,
          scope: 'openid email profile offline_access',
        });

        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenParams.toString(),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          throw new Error(tokenData.error_description || 'Token exchange failed');
        }

        // Get user info from Microsoft
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        const userData = await userResponse.json();

        // Send user data to our API to create Supabase session
        const sessionResponse = await fetch('/api/auth/microsoft/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userData: {
              email: userData.mail || userData.userPrincipalName,
              name: userData.displayName || userData.givenName || 'User',
              microsoftId: userData.id,
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