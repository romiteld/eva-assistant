'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { authService } from '@/lib/auth/auth-service';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const { session, error } = await authService.refreshSession();
      if (error) throw error;
      
      setSession(session);
      setUser(session?.user ?? null);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Session refresh error:', err);
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      const { session, error } = await authService.getSession();
      
      if (error) {
        setError(error);
        setSession(null);
        setUser(null);
      } else if (session) {
        setSession(session);
        setUser(session.user);
        setError(null);
        
        // Check if session needs refresh (expires in less than 5 minutes)
        const expiresAt = new Date(session.expires_at! * 1000);
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
        
        if (expiresAt <= fiveMinutesFromNow) {
          await refreshSession();
        }
      } else {
        setSession(null);
        setUser(null);
        setError(null);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [refreshSession]);

  useEffect(() => {
    loadSession();

    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          setSession(session);
          setUser(session?.user ?? null);
          setError(null);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setError(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
    // loadSession only needs to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Separate effect for session refresh interval
  useEffect(() => {
    if (!session) return;

    const refreshInterval = setInterval(async () => {
      const expiresAt = new Date(session.expires_at! * 1000);
      const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
      
      if (expiresAt <= tenMinutesFromNow) {
        await refreshSession();
      }
    }, 60000); // Check every minute

    return () => {
      clearInterval(refreshInterval);
    };
  }, [session, refreshSession]);

  const signOut = async () => {
    try {
      const { error } = await authService.signOut();
      if (error) throw error;
      
      setUser(null);
      setSession(null);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, error, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}