'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionRecovery } from '@/hooks/useSessionRecovery';

interface AuthErrorRecoveryProps {
  error: Error;
  onRetry?: () => void;
  showSignOut?: boolean;
}

export function AuthErrorRecovery({ 
  error, 
  onRetry,
  showSignOut = true 
}: AuthErrorRecoveryProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const { attemptRecovery } = useSessionRecovery({
    onRecoverySuccess: () => {
      setIsRecovering(false);
      setRecoveryError(null);
      onRetry?.();
    },
    onRecoveryFailure: (err) => {
      setIsRecovering(false);
      setRecoveryError(err.message);
    }
  });

  const handleRecovery = async () => {
    setIsRecovering(true);
    setRecoveryError(null);
    await attemptRecovery();
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  const isAuthError = error.message?.toLowerCase().includes('auth') || 
                     error.message?.toLowerCase().includes('authenticated');

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="bg-card border rounded-lg shadow-lg p-6 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold mb-2">
            {isAuthError ? 'Authentication Required' : 'Something went wrong'}
          </h2>
          
          <p className="text-sm text-muted-foreground mb-4">
            {error.message || 'An unexpected error occurred'}
          </p>

          {recoveryError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded p-3 mb-4">
              <p className="text-sm text-destructive">{recoveryError}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {isAuthError && (
            <button
              onClick={handleRecovery}
              disabled={isRecovering}
              className="w-full bg-primary text-primary-foreground rounded-md py-2 px-4 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRecovering ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Recovering Session...
                </span>
              ) : (
                'Recover Session'
              )}
            </button>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isRecovering}
              className="w-full bg-secondary text-secondary-foreground rounded-md py-2 px-4 hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Try Again
            </button>
          )}

          {showSignOut && (
            <button
              onClick={handleSignOut}
              disabled={isRecovering}
              className="w-full border border-border text-foreground rounded-md py-2 px-4 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            If this problem persists, please contact support
          </p>
        </div>
      </div>
    </div>
  );
}