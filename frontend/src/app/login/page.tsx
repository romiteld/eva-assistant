'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authHelpers } from '@/lib/supabase/auth';
import { Mail, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check for OAuth errors in URL parameters
    const urlError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const message = searchParams.get('message');
    
    if (urlError) {
      let errorMessage = 'Authentication failed';
      
      if (urlError === 'no_code') {
        errorMessage = 'No authorization code received';
      } else if (urlError === 'state_mismatch') {
        errorMessage = 'Security verification failed. Please try again.';
      } else if (urlError === 'auth_failed') {
        errorMessage = message || 'Authentication failed. Please try again.';
      } else if (urlError === 'no_session') {
        errorMessage = 'Failed to create session. Please try again.';
      } else if (urlError === 'callback_error') {
        errorMessage = 'An unexpected error occurred during sign in.';
      } else if (urlError === 'exchange_failed') {
        errorMessage = 'Failed to complete authentication. Please try again.';
      } else if (urlError === 'invalid_request' && errorDescription?.includes('AADSTS9002325')) {
        errorMessage = 'Microsoft requires additional security verification. Please ensure your account is properly configured.';
      } else if (errorDescription) {
        errorMessage = errorDescription;
      }
      
      setError(errorMessage);
    }
  }, [searchParams]);

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await authHelpers.sendMagicLink(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setIsMicrosoftLoading(true);
    setError(null);

    try {
      await authHelpers.signInWithMicrosoft();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Microsoft');
      setIsMicrosoftLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to EVA Assistant
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access your executive virtual assistant
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success ? (
            <div className="rounded-md bg-green-50 p-4">
              <div className="text-center">
                <Mail className="mx-auto h-12 w-12 text-green-400" />
                <h3 className="mt-2 text-lg font-medium text-green-900">
                  Check your email
                </h3>
                <p className="mt-2 text-sm text-green-700">
                  We&apos;ve sent a magic link to {email}. Click the link in the email to sign in.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Microsoft Sign In */}
              <div>
                <button
                  onClick={handleMicrosoftLogin}
                  disabled={isMicrosoftLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMicrosoftLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="0.5" y="0.5" width="9" height="9" fill="#F25022"/>
                        <rect x="11.5" y="0.5" width="9" height="9" fill="#7FBA00"/>
                        <rect x="0.5" y="11.5" width="9" height="9" fill="#00A4EF"/>
                        <rect x="11.5" y="11.5" width="9" height="9" fill="#FFB900"/>
                      </svg>
                      Sign in with Microsoft
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">Or continue with email</span>
                </div>
              </div>

              {/* Magic Link Form */}
              <form onSubmit={handleMagicLinkLogin} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading || !email}
                    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Mail className="h-5 w-5 mr-2" />
                        Send magic link
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Development Only - Test Login */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4">
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      setError(null);
                      try {
                        const res = await fetch('/api/auth/dev-login', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                          router.push(data.redirectUrl);
                        } else {
                          setError(data.error || 'Dev login failed');
                        }
                      } catch (err) {
                        setError('Dev login error');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Development Test Login
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
