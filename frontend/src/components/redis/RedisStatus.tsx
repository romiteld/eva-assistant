'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { initializeRedis, getRedisSetupInstructions } from '@/lib/services/redis-init';
import { getZohoQueue } from '@/lib/zoho/api-queue';
import { getZohoCache } from '@/lib/zoho/cache-manager';

interface RedisStatusData {
  connected: boolean;
  fallbackMode: boolean;
  error?: string;
  queueStatus?: {
    queueSize: number;
    rateLimit: {
      remaining: number;
      reset: number;
    };
    processing: boolean;
  };
  cacheStats?: {
    hits: number;
    misses: number;
    writes: number;
    evictions: number;
    memorySize: number;
    hitRate: number;
  };
}

export function RedisStatus() {
  const [status, setStatus] = useState<RedisStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const redisStatus = await initializeRedis();
      
      let queueStatus;
      let cacheStats;
      
      if (redisStatus.connected) {
        const queue = getZohoQueue();
        const cache = getZohoCache();
        
        queueStatus = await queue.getQueueStatus();
        cacheStats = cache.getStats();
      }
      
      setStatus({
        ...redisStatus,
        queueStatus,
        cacheStats,
      });
    } catch (error) {
      console.error('Error checking Redis status:', error);
      setStatus({
        connected: false,
        fallbackMode: true,
        error: 'Failed to check Redis status',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Checking Redis connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Redis Queue System</CardTitle>
              <CardDescription>
                API rate limiting and request queue management
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection Status</span>
              <div className="flex items-center gap-2">
                {status.connected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="success">Connected</Badge>
                  </>
                ) : status.fallbackMode ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <Badge variant="warning">Fallback Mode</Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">Disconnected</Badge>
                  </>
                )}
              </div>
            </div>

            {/* Queue Status */}
            {status.queueStatus && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Queue Size</span>
                  <Badge variant={status.queueStatus.queueSize > 50 ? 'warning' : 'secondary'}>
                    {status.queueStatus.queueSize} requests
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Rate Limit</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {status.queueStatus.rateLimit.remaining}/200 per minute
                    </span>
                    {status.queueStatus.rateLimit.remaining < 50 && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Processing</span>
                  <Badge variant={status.queueStatus.processing ? 'success' : 'secondary'}>
                    {status.queueStatus.processing ? 'Active' : 'Idle'}
                  </Badge>
                </div>
              </>
            )}

            {/* Cache Stats */}
            {status.cacheStats && (
              <>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Cache Performance</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hit Rate</span>
                      <span className="font-medium">
                        {(status.cacheStats.hitRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Memory Items</span>
                      <span className="font-medium">{status.cacheStats.memorySize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Hits</span>
                      <span className="font-medium">{status.cacheStats.hits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Misses</span>
                      <span className="font-medium">{status.cacheStats.misses}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Error Message */}
            {status.error && (
              <div className="border-t pt-4">
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-800">{status.error}</p>
                </div>
              </div>
            )}

            {/* Setup Instructions */}
            {status.fallbackMode && (
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInstructions(!showInstructions)}
                >
                  {showInstructions ? 'Hide' : 'Show'} Setup Instructions
                </Button>
                
                {showInstructions && (
                  <div className="mt-4 rounded-md bg-muted p-4">
                    <pre className="text-xs whitespace-pre-wrap">
                      {getRedisSetupInstructions()}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}