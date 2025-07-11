'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ServiceProviderContextValue {
  servicesReady: boolean;
}

const ServiceProviderContext = createContext<ServiceProviderContextValue>({
  servicesReady: false
});

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [servicesReady, setServicesReady] = useState(false);

  useEffect(() => {
    // Only mark services as ready when we have a user and are done loading
    if (!loading && user) {
      // Add a small delay to ensure all auth state is properly propagated
      const timer = setTimeout(() => {
        setServicesReady(true);
      }, 100);

      return () => clearTimeout(timer);
    } else {
      setServicesReady(false);
    }
  }, [user, loading]);

  return (
    <ServiceProviderContext.Provider value={{ servicesReady }}>
      {children}
    </ServiceProviderContext.Provider>
  );
}

export function useServiceProvider() {
  return useContext(ServiceProviderContext);
}

// HOC to wrap components that need services
export function withServices<P extends object>(
  Component: React.ComponentType<P>,
  LoadingComponent?: React.ComponentType
) {
  return function WrappedComponent(props: P) {
    const { servicesReady } = useServiceProvider();

    if (!servicesReady) {
      if (LoadingComponent) {
        return <LoadingComponent />;
      }
      
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Initializing services...</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}