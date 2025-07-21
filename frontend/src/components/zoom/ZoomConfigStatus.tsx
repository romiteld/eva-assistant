'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Settings, Webhook, Key, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ZoomConfigStatus {
  isConfigured: boolean;
  mode: 'server_to_server' | 'oauth' | 'unconfigured';
  isAuthenticated: boolean;
  issues: string[];
  recommendations: string[];
  webhookUrl: string;
  missingVariables: string[];
}

export function ZoomConfigStatus() {
  const [status, setStatus] = useState<ZoomConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkZoomStatus();
  }, []);

  const checkZoomStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/zoom/auth/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to check Zoom status:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      const response = await fetch('/api/auth/zoom/test');
      const result = await response.json();
      
      if (response.ok) {
        alert('✅ Connection test successful!');
      } else {
        alert(`❌ Connection test failed: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Connection test failed: ${error}`);
    } finally {
      setTesting(false);
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'server_to_server': return 'bg-green-100 text-green-800';
      case 'oauth': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'server_to_server': return <Key className="w-4 h-4" />;
      case 'oauth': return <User className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Zoom Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="w-5 h-5" />
            Configuration Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Failed to load Zoom configuration status.</p>
          <Button onClick={checkZoomStatus} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status.isConfigured ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            Zoom Integration Status
          </CardTitle>
          <CardDescription>
            Current configuration and authentication status for Zoom integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Configuration Mode */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Configuration Mode:</span>
            <Badge className={`${getModeColor(status.mode)} flex items-center gap-1`}>
              {getModeIcon(status.mode)}
              {status.mode.replace('_', '-to-').toUpperCase()}
            </Badge>
          </div>

          {/* Authentication Status */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Authentication:</span>
            <Badge variant={status.isAuthenticated ? "default" : "destructive"}>
              {status.isAuthenticated ? "Authenticated" : "Not Authenticated"}
            </Badge>
          </div>

          {/* Webhook URL */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Webhook URL:</span>
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-gray-500" />
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                {status.webhookUrl}
              </code>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={checkZoomStatus} variant="outline" size="sm">
              Refresh Status
            </Button>
            {status.isConfigured && (
              <Button onClick={testConnection} disabled={testing} size="sm">
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Issues Card */}
      {status.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Configuration Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {status.issues.map((issue, index) => (
                <li key={index} className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{issue}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Missing Variables Card */}
      {status.missingVariables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Settings className="w-5 h-5" />
              Missing Environment Variables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.missingVariables.map((variable, index) => (
                <code key={index} className="block text-sm bg-gray-100 px-3 py-2 rounded">
                  {variable}
                </code>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations Card */}
      {status.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <CheckCircle className="w-5 h-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {status.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Configuration Guide */}
      {!status.isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuration Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">
                🚀 Server-to-Server OAuth (Recommended)
              </h4>
              <p className="text-blue-800 text-sm mb-3">
                Best for production apps that don't require user authorization
              </p>
              <div className="space-y-1 text-sm">
                <code className="block bg-blue-100 px-2 py-1 rounded">ZOOM_API_KEY="your_api_key"</code>
                <code className="block bg-blue-100 px-2 py-1 rounded">ZOOM_ACCOUNT_ID="your_account_id"</code>
                <code className="block bg-blue-100 px-2 py-1 rounded">ZOOM_CLIENT_ID="your_client_id"</code>
                <code className="block bg-blue-100 px-2 py-1 rounded">ZOOM_CLIENT_SECRET="your_client_secret"</code>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">
                🔗 Traditional OAuth
              </h4>
              <p className="text-gray-700 text-sm mb-3">
                Requires user authorization for each account
              </p>
              <div className="space-y-1 text-sm">
                <code className="block bg-gray-100 px-2 py-1 rounded">ZOOM_CLIENT_ID="your_client_id"</code>
                <code className="block bg-gray-100 px-2 py-1 rounded">ZOOM_CLIENT_SECRET="your_client_secret"</code>
                <code className="block bg-gray-100 px-2 py-1 rounded">ZOOM_WEBHOOK_SECRET_TOKEN="required"</code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}