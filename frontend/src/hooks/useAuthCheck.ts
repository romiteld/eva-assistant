'use client';

import { useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/browser';
import { authRateLimiter } from '@/lib/utils/rate-limiter';

interface AuthCheckResult {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

// Singleton promise to prevent multiple simultaneous auth checks
let authCheckPromise: Promise<User | null> | null = null;

export function useAuthCheck(): AuthCheckResult {
  const [state, setState] = useState<AuthCheckResult>({
    user: null,
    loading: true,
    error: null
  });
  const checkInProgress = useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Prevent multiple simultaneous checks
      if (checkInProgress.current) return;
      
      // Check rate limit
      const canProceed = await authRateLimiter.checkLimit('auth-check');
      if (!canProceed) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: new Error('Too many authentication requests. Please wait.')
        }));
        return;
      }

      checkInProgress.current = true;

      try {
        // Use singleton promise to prevent duplicate requests
        if (!authCheckPromise) {
          authCheckPromise = supabase.auth.getUser().then(({ data, error }) => {
            if (error) throw error;
            return data.user;
          });
        }

        const user = await authCheckPromise;
        
        setState({
          user,
          loading: false,
          error: null
        });
      } catch (error) {
        setState({
          user: null,
          loading: false,
          error: error as Error
        });
      } finally {
        checkInProgress.current = false;
        // Clear the promise after a delay to allow for some caching
        setTimeout(() => {
          authCheckPromise = null;
        }, 5000);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setState({
          user: session?.user ?? null,
          loading: false,
          error: null
        });
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          loading: false,
          error: null
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
}