'use client';

import { useEffect } from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import { ServiceProvider } from '@/components/providers/ServiceProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/browser';

export default function DashboardClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Set up session recovery on mount
    const recoverSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session recovery error:', error);
        return;
      }

      if (!session) {
        // Try to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = 
          await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Session refresh error:', refreshError);
        } else if (refreshedSession) {
          console.log('Session refreshed successfully');
        }
      }
    };

    recoverSession();
  }, []);

  return (
    <AuthProvider>
      <AuthGuard>
        <ServiceProvider>
          {children}
        </ServiceProvider>
      </AuthGuard>
    </AuthProvider>
  );
}