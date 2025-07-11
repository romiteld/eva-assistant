'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/browser';

interface UseSessionRecoveryOptions {
  onRecoverySuccess?: () => void;
  onRecoveryFailure?: (error: Error) => void;
  maxRetries?: number;
  retryDelay?: number;
}

export function useSessionRecovery({
  onRecoverySuccess,
  onRecoveryFailure,
  maxRetries = 3,
  retryDelay = 1000
}: UseSessionRecoveryOptions = {}) {
  const { user, refreshSession } = useAuth();
  const retryCountRef = useRef(0);
  const isRecoveringRef = useRef(false);

  const attemptRecovery = useCallback(async () => {
    if (isRecoveringRef.current || user) return;

    isRecoveringRef.current = true;
    
    try {
      // First try to get existing session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        retryCountRef.current = 0;
        isRecoveringRef.current = false;
        onRecoverySuccess?.();
        return;
      }

      // If no session, try to refresh
      await refreshSession();
      
      // Check if refresh worked
      const { data: { session: newSession } } = await supabase.auth.getSession();
      
      if (newSession) {
        retryCountRef.current = 0;
        isRecoveringRef.current = false;
        onRecoverySuccess?.();
      } else {
        throw new Error('Failed to recover session');
      }
    } catch (error) {
      retryCountRef.current++;
      
      if (retryCountRef.current >= maxRetries) {
        isRecoveringRef.current = false;
        onRecoveryFailure?.(error as Error);
      } else {
        // Schedule retry
        setTimeout(() => {
          isRecoveringRef.current = false;
          attemptRecovery();
        }, retryDelay * retryCountRef.current);
      }
    }
  }, [user, refreshSession, onRecoverySuccess, onRecoveryFailure, maxRetries, retryDelay]);

  // Monitor auth errors
  useEffect(() => {
    const handleAuthError = (error: any) => {
      if (error?.message?.includes('not authenticated') || error?.status === 401) {
        attemptRecovery();
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        retryCountRef.current = 0;
      } else if (event === 'SIGNED_OUT') {
        retryCountRef.current = 0;
        isRecoveringRef.current = false;
      }
    });

    // Add global error handler for auth errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (response.status === 401) {
          handleAuthError({ status: 401 });
        }
        
        return response;
      } catch (error) {
        throw error;
      }
    };

    return () => {
      subscription.unsubscribe();
      window.fetch = originalFetch;
    };
  }, [attemptRecovery]);

  return {
    attemptRecovery,
    isRecovering: isRecoveringRef.current,
    retryCount: retryCountRef.current
  };
}