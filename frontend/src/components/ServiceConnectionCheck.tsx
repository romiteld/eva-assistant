'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Loader2, Settings, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export interface ServiceConnectionCheckProps {
  serviceName: string;
  checkEndpoint: string;
  settingsPath?: string;
  documentationUrl?: string;
  onConnectionConfirmed?: () => void;
  children: React.ReactNode;
}

export function ServiceConnectionCheck({
  serviceName,
  checkEndpoint,
  settingsPath = '/dashboard/settings',
  documentationUrl,
  onConnectionConfirmed,
  children
}: ServiceConnectionCheckProps) {
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
    // checkConnection is defined locally and depends on props that are passed to it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkEndpoint]);

  const checkConnection = async () => {
    try {
      setChecking(true);
      setError(null);
      
      const response = await fetch(checkEndpoint);
      const data = await response.json();
      
      if (response.ok && data.configured) {
        setConnected(true);
        onConnectionConfirmed?.();
      } else {
        setConnected(false);
        setError(data.error || `${serviceName} is not configured`);
      }
    } catch (err) {
      setConnected(false);
      setError(`Failed to check ${serviceName} connection`);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Checking {serviceName} connection...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <CardTitle>{serviceName} Not Connected</CardTitle>
            </div>
            <CardDescription>
              You need to configure {serviceName} before you can use this feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-yellow-500/10 border-yellow-500/20">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                {error}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h3 className="font-medium text-white">Setup Instructions:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-400">
                <li>Go to your {serviceName} account to get API credentials</li>
                <li>Navigate to Settings → Integrations</li>
                <li>Enter your {serviceName} credentials</li>
                <li>Save and verify the connection</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Link href={settingsPath}>
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Go to Settings
                </Button>
              </Link>
              
              {documentationUrl && (
                <a href={documentationUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Documentation
                  </Button>
                </a>
              )}
              
              <Button variant="outline" onClick={checkConnection}>
                <Loader2 className="h-4 w-4 mr-2" />
                Retry Check
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}