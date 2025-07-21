'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LoadingState, 
  PageLoading, 
  ContentLoading, 
  ButtonLoading,
  AILoadingState 
} from '@/components/ui/loading-states';
import { 
  IntegrationStatus, 
  IntegrationGrid, 
  IntegrationSummary,
  IntegrationAlert,
  ConnectionStatus,
  Integration
} from '@/components/ui/integration-status';
import { EnhancedErrorBoundary } from '@/components/error/EnhancedErrorBoundary';
import { useEnhancedToast, toastPatterns } from '@/components/ui/enhanced-toast';
import { 
  Briefcase, 
  MessageSquare, 
  Phone, 
  Video, 
  Share2, 
  Database,
  Cloud,
  Mail
} from 'lucide-react';

// Example integrations
const mockIntegrations: Integration[] = [
  {
    id: 'microsoft',
    name: 'Microsoft 365',
    status: 'connected',
    message: 'Authenticated via OAuth',
    icon: <Mail className="w-5 h-5" />,
    metadata: {
      'User': 'john.doe@company.com',
      'Last Sync': '2 mins ago'
    }
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    status: 'disconnected',
    message: 'Authentication required',
    icon: <Briefcase className="w-5 h-5" />,
    actionUrl: '/auth/linkedin'
  },
  {
    id: 'twilio',
    name: 'Twilio',
    status: 'error',
    message: 'Invalid API credentials',
    icon: <Phone className="w-5 h-5" />,
    onReconnect: async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Reconnecting to Twilio...');
    }
  },
  {
    id: 'zoom',
    name: 'Zoom',
    status: 'connecting',
    message: 'Establishing connection...',
    icon: <Video className="w-5 h-5" />
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    status: 'connected',
    message: 'API key valid',
    icon: <Cloud className="w-5 h-5" />,
    metadata: {
      'Credits': '4,850 / 5,000',
      'Rate Limit': '100 req/min'
    }
  },
  {
    id: 'supabase',
    name: 'Supabase',
    status: 'connected',
    message: 'Database connected',
    icon: <Database className="w-5 h-5" />,
    metadata: {
      'Project': 'eva-production',
      'Region': 'us-east-1'
    }
  }
];

export function UIEnhancementsExample() {
  const { toast } = useEnhancedToast();
  const [isLoading, setIsLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [currentAiStage, setCurrentAiStage] = useState(0);
  const [integrations, setIntegrations] = useState(mockIntegrations);

  // Simulate AI processing stages
  const aiStages = [
    'Initializing AI agents...',
    'Analyzing data patterns...',
    'Generating insights...',
    'Optimizing results...',
    'Finalizing output...'
  ];

  const simulateAIProcess = async () => {
    setIsLoading(true);
    setAiProgress(0);
    setCurrentAiStage(0);

    for (let i = 0; i < aiStages.length; i++) {
      setCurrentAiStage(i);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setAiProgress((i + 1) * 20);
    }

    setIsLoading(false);
    toast.success({
      title: 'AI Process Complete',
      description: 'Your content has been generated successfully',
      actions: [
        {
          label: 'View Results',
          onClick: () => console.log('View results')
        }
      ]
    });
  };

  // Example error trigger
  const triggerError = () => {
    throw new Error('This is a test error to demonstrate the error boundary');
  };

  // Example toast demonstrations
  const showToastExamples = {
    success: () => toast.success({
      title: 'Changes Saved',
      description: 'Your profile has been updated successfully'
    }),
    
    error: () => toast.error({
      title: 'Upload Failed',
      description: 'The file size exceeds the 10MB limit',
      actions: [
        {
          label: 'Try Again',
          onClick: () => console.log('Retry upload')
        }
      ]
    }),
    
    warning: () => toast.warning({
      title: 'Low Credits',
      description: 'You have only 50 API credits remaining'
    }),
    
    info: () => toast.info({
      title: 'New Feature Available',
      description: 'Check out our new AI voice assistant'
    }),
    
    loading: () => {
      const toastId = toast.loading({
        title: 'Processing your request...',
        persistent: true
      });
      
      setTimeout(() => {
        toast.success({
          id: toastId as string,
          title: 'Request completed!'
        });
      }, 3000);
    },
    
    promise: async () => {
      await toast.promise(
        new Promise((resolve) => setTimeout(resolve, 2000)),
        {
          loading: 'Uploading file...',
          success: 'File uploaded successfully!',
          error: 'Upload failed. Please try again.'
        }
      );
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">UI/UX Enhancement Examples</h2>
        <p className="text-gray-600">
          Comprehensive examples of the new UI components for better user experience
        </p>
      </div>

      <Tabs defaultValue="loading" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="loading">Loading States</TabsTrigger>
          <TabsTrigger value="integrations">Integration Status</TabsTrigger>
          <TabsTrigger value="errors">Error Handling</TabsTrigger>
          <TabsTrigger value="toasts">Toast Notifications</TabsTrigger>
        </TabsList>

        {/* Loading States Tab */}
        <TabsContent value="loading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loading State Variations</CardTitle>
              <CardDescription>
                Different loading states for various contexts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default Loading */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Default Loading</h4>
                <div className="border rounded-lg p-8">
                  <LoadingState message="Loading data..." />
                </div>
              </div>

              {/* AI Loading */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">AI Processing</h4>
                <div className="border rounded-lg p-8">
                  <LoadingState 
                    variant="ai" 
                    message="AI is thinking..." 
                    submessage="This may take a few moments"
                    progress={75}
                  />
                </div>
              </div>

              {/* Content Loading */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Content Skeleton</h4>
                <div className="border rounded-lg p-4">
                  <ContentLoading lines={4} />
                </div>
              </div>

              {/* AI Multi-Stage Loading */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">AI Multi-Stage Process</h4>
                <Button onClick={simulateAIProcess} disabled={isLoading}>
                  Start AI Process
                </Button>
                {isLoading && (
                  <div className="border rounded-lg p-8">
                    <AILoadingState
                      stage={aiStages[currentAiStage]}
                      stages={aiStages}
                      currentStage={currentAiStage}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integration Status Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Management</CardTitle>
              <CardDescription>
                Monitor and manage your service integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <IntegrationSummary integrations={integrations} />

              {/* Alert for issues */}
              <IntegrationAlert integrations={integrations} />

              {/* Grid view */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">All Integrations</h4>
                <IntegrationGrid integrations={integrations} />
              </div>

              {/* Detailed view */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Detailed Status</h4>
                <div className="space-y-3">
                  {integrations.slice(0, 3).map((integration) => (
                    <IntegrationStatus 
                      key={integration.id} 
                      integration={integration}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Handling Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Boundary Demo</CardTitle>
              <CardDescription>
                Enhanced error handling with recovery options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  Click the button below to trigger a test error and see the enhanced error boundary in action.
                </p>
              </div>
              
              <EnhancedErrorBoundary
                onError={(error, errorInfo) => {
                  console.log('Error caught:', error, errorInfo);
                }}
              >
                <Button 
                  variant="destructive"
                  onClick={triggerError}
                >
                  Trigger Test Error
                </Button>
              </EnhancedErrorBoundary>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Error Boundary Features:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• User-friendly error messages</li>
                  <li>• Multiple recovery options</li>
                  <li>• Technical details toggle (dev mode)</li>
                  <li>• Error frequency tracking</li>
                  <li>• Copy error details functionality</li>
                  <li>• Automatic error reporting (production)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Toast Notifications Tab */}
        <TabsContent value="toasts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Toast Notifications</CardTitle>
              <CardDescription>
                Rich toast notifications with actions and better UX
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Button 
                  variant="outline"
                  onClick={showToastExamples.success}
                  className="text-green-600"
                >
                  Success Toast
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={showToastExamples.error}
                  className="text-red-600"
                >
                  Error Toast
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={showToastExamples.warning}
                  className="text-yellow-600"
                >
                  Warning Toast
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={showToastExamples.info}
                  className="text-blue-600"
                >
                  Info Toast
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={showToastExamples.loading}
                  className="text-purple-600"
                >
                  Loading Toast
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={showToastExamples.promise}
                  className="text-indigo-600"
                >
                  Promise Toast
                </Button>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Toast Features:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Multiple toast types with distinct styling</li>
                  <li>• Action buttons within toasts</li>
                  <li>• Promise-based toasts for async operations</li>
                  <li>• Persistent toasts for important messages</li>
                  <li>• Smooth animations and transitions</li>
                  <li>• Auto-dismiss with configurable duration</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}