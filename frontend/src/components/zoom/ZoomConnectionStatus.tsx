'use client';

import React, { useState, useEffect } from 'react';
import { zoomService } from '@/lib/services/zoom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Video,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ZoomConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [credentials, setCredentials] = useState<any>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const creds = await zoomService.getCredentials();
      setCredentials(creds);
      setIsConnected(!!creds && creds.is_active);
    } catch (error) {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const connectZoom = () => {
    window.location.href = '/api/auth/zoom';
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Checking Zoom connection...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <XCircle className="h-3 w-3 text-destructive" />
          Zoom Not Connected
        </Badge>
        <Button size="sm" variant="outline" onClick={connectZoom}>
          <Link2 className="h-3 w-3 mr-1" />
          Connect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1">
        <CheckCircle2 className="h-3 w-3 text-green-500" />
        Zoom Connected
      </Badge>
      {credentials?.zoom_email && (
        <span className="text-xs text-muted-foreground">
          ({credentials.zoom_email})
        </span>
      )}
    </div>
  );
}