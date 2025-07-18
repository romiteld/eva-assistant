'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Linkedin, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { handleLinkedInCallback } from '@/lib/auth/linkedin-oauth';

function LinkedInCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          throw new Error(errorDescription || `OAuth error: ${errorParam}`);
        }

        if (!code || !state) {
          throw new Error('Missing required OAuth parameters');
        }

        // Handle client-side callback validation
        const callbackResult = await handleLinkedInCallback(code, state);
        
        // Exchange code for tokens on the server
        const response = await fetch('/api/linkedin/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            state,
            redirectUri: `${window.location.origin}/auth/linkedin/callback`
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to exchange authorization code');
        }

        const data = await response.json();
        
        setStatus('success');
        toast.success('LinkedIn account connected successfully!');
        
        // Redirect to dashboard or original page
        setTimeout(() => {
          router.push(callbackResult.redirectTo || '/dashboard/linkedin');
        }, 2000);

      } catch (error) {
        console.error('LinkedIn OAuth callback error:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
        setStatus('error');
        toast.error('Failed to connect LinkedIn account');
      }
    };

    processCallback();
  }, [searchParams, router]);

  const handleRetry = () => {
    router.push('/dashboard/linkedin');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-black/40 backdrop-blur-xl border-zinc-800">
        <CardHeader className="text-center">
          <CardTitle className="text-white flex items-center justify-center gap-3">
            <Linkedin className="w-8 h-8 text-blue-500" />
            LinkedIn OAuth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            {status === 'processing' && (
              <div className="space-y-4">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                <div className="space-y-2">
                  <p className="text-white font-medium">Processing LinkedIn connection...</p>
                  <p className="text-zinc-400 text-sm">
                    Please wait while we complete the authentication process.
                  </p>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <div className="space-y-2">
                  <p className="text-white font-medium">LinkedIn Connected Successfully!</p>
                  <p className="text-zinc-400 text-sm">
                    You will be redirected to your LinkedIn dashboard shortly.
                  </p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <XCircle className="w-12 h-12 text-red-500 mx-auto" />
                <div className="space-y-2">
                  <p className="text-white font-medium">Connection Failed</p>
                  <p className="text-zinc-400 text-sm">
                    {error || 'An error occurred while connecting to LinkedIn.'}
                  </p>
                </div>
                <Button
                  onClick={handleRetry}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LinkedInCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-black/40 backdrop-blur-xl border-zinc-800">
          <CardContent className="p-6">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-white">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <LinkedInCallbackContent />
    </Suspense>
  );
}