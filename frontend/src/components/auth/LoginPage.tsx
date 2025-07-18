import React, { useState } from 'react';
import { Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { authHelpers } from '@/lib/supabase/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      await authHelpers.sendMagicLink(email);
      setStatus('sent');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            Welcome to EVA
          </h2>
          <p className="mt-2 text-gray-400">
            Your AI-powered Executive Virtual Assistant
          </p>
        </div>

        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
          {status === 'sent' ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-white">Check your email!</h3>
              <p className="text-gray-400">
                We&apos;ve sent a magic link to <span className="font-medium text-white">{email}</span>
              </p>
              <p className="text-sm text-gray-500">
                Click the link in your email to sign in. The link will expire in 1 hour.
              </p>
              <button
                onClick={() => {
                  setStatus('idle');
                  setEmail('');
                }}
                className="text-blue-500 hover:text-blue-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-md px-2 py-1"
                aria-label="Use a different email address"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
              </div>

              {status === 'error' && (
                <div 
                  className="rounded-lg bg-red-900/20 border border-red-800 p-4"
                  role="alert"
                  aria-live="polite"
                >
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
                    <div className="ml-3">
                      <p className="text-sm text-red-400">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" aria-hidden="true" />
                    Sending magic link...
                  </>
                ) : (
                  'Send magic link'
                )}
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-400">
                  No password needed. We&apos;ll email you a secure sign-in link.
                </p>
              </div>
            </form>
          )}
        </div>

        <div className="text-center text-sm text-gray-500">
          By signing in, you agree to our{' '}
          <a href="#" className="text-blue-500 hover:text-blue-400">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-blue-500 hover:text-blue-400">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}