'use client'

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MicrosoftAuthComplete() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function completeAuth() {
      const sessionToken = searchParams.get('session');
      const redirectTo = searchParams.get('redirect') || '/dashboard';

      if (!sessionToken) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      try {
        // Create a session through our API
        const response = await fetch('/api/auth/microsoft/create-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionToken }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create session');
        }

        // Decode the session data for user info
        const sessionData = JSON.parse(atob(sessionToken));

        // Store Microsoft auth data in sessionStorage
        sessionStorage.setItem('microsoft_auth', JSON.stringify({
          email: sessionData.email,
          name: sessionData.full_name,
          microsoftId: sessionData.microsoft_id,
          authenticated: true,
          timestamp: Date.now(),
        }));

        if (result.requiresEmailVerification) {
          // New user - show a message about account creation
          router.push(`/auth/microsoft/welcome?email=${encodeURIComponent(sessionData.email)}&redirect=${encodeURIComponent(redirectTo)}`);
        } else {
          // Existing user - redirect to dashboard
          router.push(redirectTo);
        }
        
      } catch (error) {
        console.error('Error completing authentication:', error);
        setError(error instanceof Error ? error.message : 'Failed to complete authentication');
        setLoading(false);
      }
    }

    completeAuth();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Error</h2>
            <p className="text-red-600 mb-4">{error}</p>
            {error.includes('Database error') && (
              <p className="text-sm text-gray-600 mb-4">
                This might be due to existing account constraints. Please try logging in with your original method or contact support.
              </p>
            )}
            <button
              onClick={() => router.push('/login')}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
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
        <p className="text-gray-600">Completing Microsoft authentication...</p>
      </div>
    </div>
  );
}