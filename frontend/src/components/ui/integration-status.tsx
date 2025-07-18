'use client';

import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Wifi,
  WifiOff,
  Link2,
  Link2Off,
  Settings,
  ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'checking';

export interface Integration {
  id: string;
  name: string;
  status: ConnectionStatus;
  message?: string;
  lastChecked?: Date;
  icon?: React.ReactNode;
  color?: string;
  actionUrl?: string;
  onReconnect?: () => Promise<void>;
  metadata?: {
    [key: string]: any;
  };
}

interface IntegrationStatusProps {
  integration: Integration;
  showDetails?: boolean;
  onAction?: () => void;
  className?: string;
}

export function IntegrationStatus({ 
  integration, 
  showDetails = true,
  onAction,
  className 
}: IntegrationStatusProps) {
  const [isReconnecting, setIsReconnecting] = useState(false);

  const statusConfig = {
    connected: {
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      label: 'Connected'
    },
    disconnected: {
      icon: XCircle,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/20',
      label: 'Disconnected'
    },
    connecting: {
      icon: Loader2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      label: 'Connecting',
      animate: 'animate-spin'
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      label: 'Error'
    },
    checking: {
      icon: Loader2,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      label: 'Checking',
      animate: 'animate-spin'
    }
  };

  const config = statusConfig[integration.status];
  const StatusIcon = config.icon;

  const handleReconnect = async () => {
    if (integration.onReconnect && !isReconnecting) {
      setIsReconnecting(true);
      try {
        await integration.onReconnect();
      } finally {
        setIsReconnecting(false);
      }
    }
  };

  return (
    <div className={cn(
      'flex items-center justify-between p-4 rounded-lg border',
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="flex items-center gap-3">
        {integration.icon && (
          <div className="text-gray-600 dark:text-gray-400">
            {integration.icon}
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <StatusIcon 
            className={cn(
              'w-5 h-5',
              config.color,
              config.animate
            )} 
          />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {integration.name}
            </p>
            {showDetails && integration.message && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {integration.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {integration.status === 'connected' && integration.metadata && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs">
                  <Wifi className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  {Object.entries(integration.metadata).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-medium">{key}:</span> {value}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {integration.status === 'error' && integration.onReconnect && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="text-xs"
          >
            {isReconnecting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span className="ml-1">Reconnect</span>
          </Button>
        )}

        {integration.status === 'disconnected' && integration.actionUrl && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.()}
            className="text-xs"
          >
            <Link2 className="w-3 h-3 mr-1" />
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

interface IntegrationGridProps {
  integrations: Integration[];
  className?: string;
}

export function IntegrationGrid({ integrations, className }: IntegrationGridProps) {
  return (
    <div className={cn('grid gap-3 md:grid-cols-2 lg:grid-cols-3', className)}>
      {integrations.map((integration) => (
        <IntegrationStatus
          key={integration.id}
          integration={integration}
          showDetails={false}
        />
      ))}
    </div>
  );
}

interface IntegrationSummaryProps {
  integrations: Integration[];
  className?: string;
}

export function IntegrationSummary({ integrations, className }: IntegrationSummaryProps) {
  const connected = integrations.filter(i => i.status === 'connected').length;
  const total = integrations.length;
  const hasErrors = integrations.some(i => i.status === 'error');

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-2 h-2 rounded-full',
          hasErrors ? 'bg-red-500' : connected === total ? 'bg-green-500' : 'bg-yellow-500'
        )} />
        <span className="text-sm font-medium">
          {connected}/{total} Connected
        </span>
      </div>
      
      {hasErrors && (
        <Badge variant="destructive" className="text-xs">
          {integrations.filter(i => i.status === 'error').length} Error(s)
        </Badge>
      )}
    </div>
  );
}

interface IntegrationAlertProps {
  integrations: Integration[];
  className?: string;
}

export function IntegrationAlert({ integrations, className }: IntegrationAlertProps) {
  const disconnected = integrations.filter(
    i => i.status === 'disconnected' || i.status === 'error'
  );

  if (disconnected.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={className}
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Integration Issues</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              {disconnected.length} integration{disconnected.length > 1 ? 's' : ''} need attention:
            </p>
            <ul className="list-disc list-inside space-y-1">
              {disconnected.map(integration => (
                <li key={integration.id} className="text-sm">
                  <span className="font-medium">{integration.name}</span>
                  {integration.message && `: ${integration.message}`}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook to check integration status
export function useIntegrationStatus(
  checkFunction: () => Promise<ConnectionStatus>,
  interval: number = 30000
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('checking');

  useEffect(() => {
    const check = async () => {
      try {
        const newStatus = await checkFunction();
        setStatus(newStatus);
      } catch (error) {
        setStatus('error');
      }
    };

    check();
    const timer = setInterval(check, interval);

    return () => clearInterval(timer);
  }, [checkFunction, interval]);

  return status;
}