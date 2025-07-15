'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionRecovery } from '@/hooks/useSessionRecovery';
import { AlertCircle, RefreshCw, LogIn } from 'lucide-react';

interface AuthErrorRecoveryProps {
  error: Error;
  onRetry?: () => void;
  children?: React.ReactNode;
}

export default function AuthErrorRecovery({ 
  error, 
  onRetry, 
  children 
}: AuthErrorRecoveryProps) {
  const [isRecovering, setIsRecovering] = useState(false);
  const router = useRouter();

  const { attemptRecovery } = useSessionRecovery({
    onRecoverySuccess: () => {
      setIsRecovering(false);
      onRetry?.();
    },
    onRecoveryFailure: (error: Error) => {
      setIsRecovering(false);
      console.error('Session recovery failed:', error);
    },
  });

  const handleRecovery = async () => {
    setIsRecovering(true);
    await attemptRecovery();
  };

  const isAuthError = error.message.toLowerCase().includes('not authenticated') ||
                      error.message.toLowerCase().includes('unauthorized') ||
                      error.message.toLowerCase().includes('jwt');

  if (!isAuthError && children) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              Authentication Required
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Your session has expired or you need to sign in to continue.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRecovery}
                disabled={isRecovering}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRecovering ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Recovering Session...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Retry Authentication
                  </>
                )}
              </button>
              
              <button
                onClick={() => router.push('/login')}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Go to Login
              </button>
            </div>
            
            {error.message && (
              <details className="mt-4">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-gray-500 bg-gray-900 p-2 rounded overflow-x-auto">
                  {error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}