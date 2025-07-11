'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  fallbackUrl?: string;
  loadingComponent?: React.ReactNode;
}

export function AuthGuard({ 
  children, 
  fallbackUrl = '/auth/login',
  loadingComponent
}: AuthGuardProps) {
  const { user, loading, error } = useAuth();
  const router = useRouter();

  // Allow access in development mode for testing
  const isDevelopment = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (!isDevelopment && !loading && !user) {
      router.push(fallbackUrl);
    }
  }, [user, loading, router, fallbackUrl, isDevelopment]);

  if (loading) {
    return loadingComponent || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-semibold text-destructive mb-2">Authentication Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <button
            onClick={() => router.push(fallbackUrl)}
            className="w-full bg-primary text-primary-foreground rounded-md py-2 px-4 hover:bg-primary/90 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!user && !isDevelopment) {
    return null;
  }

  return <>{children}</>;
}