'use client'

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function MicrosoftWelcome() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get email from session token
    const sessionToken = searchParams.get('session');
    if (sessionToken) {
      try {
        const sessionData = JSON.parse(atob(sessionToken));
        setEmail(sessionData.email || '');
        
        // Store Microsoft auth data
        sessionStorage.setItem('microsoft_auth', JSON.stringify({
          email: sessionData.email,
          name: sessionData.full_name,
          microsoftId: sessionData.microsoft_id,
          authenticated: true,
          timestamp: Date.now(),
        }));
      } catch (error) {
        console.error('Error parsing session token:', error);
      }
    }
  }, [searchParams]);

  const handleCreateAccount = () => {
    const redirectTo = searchParams.get('redirect') || '/dashboard';
    router.push(`/signup?email=${encodeURIComponent(email)}&provider=microsoft&redirect=${encodeURIComponent(redirectTo)}`);
  };

  const handleSignIn = () => {
    router.push(`/login?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome!</h2>
          <p className="text-gray-600 mb-8">
            You&apos;ve successfully authenticated with Microsoft.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Microsoft Account:</strong> {email}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-amber-900 mb-2">Account Setup Required</h3>
            <p className="text-sm text-amber-800">
              To use this application with your Microsoft account, you need to create a new account or sign in with an existing one.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleCreateAccount}
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create New Account
            </button>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign In with Existing Account
            </button>
          </div>

          <div className="mt-6">
            <p className="text-xs text-gray-500 text-center">
              Due to security constraints, Microsoft OAuth requires an existing account in our system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}