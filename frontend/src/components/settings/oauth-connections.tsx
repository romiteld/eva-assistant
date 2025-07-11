'use client';

import React from 'react';
import { useTokenManager } from '@/hooks/useTokenManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Link2, 
  AlertTriangle,
  Building2,
  Linkedin,
  Video,
  CreditCard,
  Mail,
  FileText
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface OAuthProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  scopes: string[];
  color: string;
}

const providers: OAuthProvider[] = [
  {
    id: 'microsoft',
    name: 'Microsoft',
    icon: <Building2 className="h-5 w-5" />,
    description: 'Access Outlook, Calendar, and SharePoint',
    scopes: ['User.Read', 'Mail.Read', 'Calendar.ReadWrite', 'Files.ReadWrite'],
    color: 'bg-blue-500'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: <Linkedin className="h-5 w-5" />,
    description: 'Access LinkedIn profiles and connections',
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
    color: 'bg-blue-700'
  },
  {
    id: 'zoom',
    name: 'Zoom',
    icon: <Video className="h-5 w-5" />,
    description: 'Create and manage Zoom meetings',
    scopes: ['meeting:write', 'meeting:read', 'user:read'],
    color: 'bg-blue-600'
  },
  {
    id: 'zoho',
    name: 'Zoho CRM',
    icon: <CreditCard className="h-5 w-5" />,
    description: 'Sync leads and manage CRM data',
    scopes: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL'],
    color: 'bg-red-600'
  }
];

export function OAuthConnections() {
  const { 
    tokenStatuses, 
    loading, 
    initializeOAuth, 
    revokeTokens, 
    isTokenExpiringSoon,
    refreshStatuses 
  } = useTokenManager();

  const handleConnect = (providerId: string) => {
    initializeOAuth(providerId);
  };

  const handleDisconnect = async (providerId: string) => {
    if (confirm(`Are you sure you want to disconnect ${providerId}?`)) {
      await revokeTokens(providerId);
    }
  };

  const getStatusBadge = (providerId: string) => {
    const status = tokenStatuses[providerId];
    
    if (!status?.hasToken) {
      return <Badge variant="outline">Not Connected</Badge>;
    }
    
    if (!status.isValid) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    if (isTokenExpiringSoon(providerId)) {
      return <Badge variant="secondary">Expiring Soon</Badge>;
    }
    
    return <Badge variant="default">Connected</Badge>;
  };

  const getProviderCard = (provider: OAuthProvider) => {
    const status = tokenStatuses[provider.id];
    const isConnected = status?.hasToken;
    const isValid = status?.isValid;
    
    return (
      <Card key={provider.id} className={cn(
        "relative overflow-hidden transition-all",
        isConnected && "border-green-500/20"
      )}>
        <div className={cn(
          "absolute top-0 left-0 w-1 h-full",
          provider.color
        )} />
        
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg text-white",
                provider.color
              )}>
                {provider.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{provider.name}</CardTitle>
                <CardDescription>{provider.description}</CardDescription>
              </div>
            </div>
            {getStatusBadge(provider.id)}
          </div>
        </CardHeader>
        
        <CardContent>
          {isConnected && status ? (
            <div className="space-y-3">
              <div className="text-sm space-y-1">
                {status.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span className={cn(
                      "font-medium",
                      isTokenExpiringSoon(provider.id) && "text-orange-500"
                    )}>
                      {formatDistanceToNow(new Date(status.expiresAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
                
                {status.lastRefreshed && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last refreshed:</span>
                    <span className="text-sm">
                      {format(new Date(status.lastRefreshed), 'MMM d, h:mm a')}
                    </span>
                  </div>
                )}
                
                {status.refreshCount !== undefined && status.refreshCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Auto-refreshed:</span>
                    <span className="text-sm">{status.refreshCount} times</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshStatuses()}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
                
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDisconnect(provider.id)}
                >
                  Disconnect
                </Button>
              </div>
              
              {!isValid && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This connection has expired. Please reconnect to continue using {provider.name}.
                  </AlertDescription>
                </Alert>
              )}
              
              {isTokenExpiringSoon(provider.id) && isValid && (
                <Alert variant="default">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This token will expire soon and will be automatically refreshed.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Required permissions:</p>
                <div className="flex flex-wrap gap-1">
                  {provider.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-xs">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <Button
                onClick={() => handleConnect(provider.id)}
                className="w-full"
                disabled={loading}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Connect {provider.name}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">OAuth Connections</h2>
        <p className="text-muted-foreground">
          Connect your accounts to enable integrations and automation
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {providers.map(provider => getProviderCard(provider))}
      </div>
      
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          <strong>Secure token management:</strong> All tokens are encrypted and automatically 
          refreshed before expiration. Your credentials are never exposed.
        </AlertDescription>
      </Alert>
    </div>
  );
}