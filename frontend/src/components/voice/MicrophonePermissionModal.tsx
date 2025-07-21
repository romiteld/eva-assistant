'use client';

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  MicOff, 
  Shield, 
  AlertCircle, 
  CheckCircle2,
  HelpCircle,
  Chrome,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MicrophonePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

type PermissionState = 'prompt' | 'granted' | 'denied' | 'checking' | 'error';
type Browser = 'chrome' | 'firefox' | 'safari' | 'edge' | 'other';

export function MicrophonePermissionModal({
  isOpen,
  onClose,
  onPermissionGranted,
  onPermissionDenied
}: MicrophonePermissionModalProps) {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [browser, setBrowser] = useState<Browser>('other');
  const [showInstructions, setShowInstructions] = useState(false);

  // Detect browser
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') && !userAgent.includes('edge')) {
      setBrowser('chrome');
    } else if (userAgent.includes('firefox')) {
      setBrowser('firefox');
    } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      setBrowser('safari');
    } else if (userAgent.includes('edge')) {
      setBrowser('edge');
    }
  }, []);

  // Check current permission state
  useEffect(() => {
    if (!isOpen) return;

    const checkPermission = async () => {
      try {
        // Check if permissions API is available
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setPermissionState(result.state as PermissionState);
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            setPermissionState(result.state as PermissionState);
            if (result.state === 'granted') {
              onPermissionGranted();
            } else if (result.state === 'denied') {
              onPermissionDenied();
            }
          });
        } else {
          // Fallback for browsers without permissions API
          setPermissionState('prompt');
        }
      } catch (error) {
        console.error('Permission check error:', error);
        setPermissionState('prompt');
      }
    };

    checkPermission();
  }, [isOpen, onPermissionGranted, onPermissionDenied]);

  const requestPermission = async () => {
    try {
      setPermissionState('checking');
      setErrorMessage('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Permission granted - clean up the stream
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
      onPermissionGranted();
    } catch (error: any) {
      console.error('Microphone permission error:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMessage('Microphone permission was denied. Please check your browser settings.');
        setShowInstructions(true);
        onPermissionDenied();
      } else if (error.name === 'NotFoundError') {
        setPermissionState('error');
        setErrorMessage('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        setPermissionState('error');
        setErrorMessage('Your microphone is being used by another application. Please close other apps and try again.');
      } else {
        setPermissionState('error');
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    }
  };

  const getBrowserIcon = () => {
    switch (browser) {
      case 'chrome':
        return <Chrome className="w-5 h-5" />;
      case 'firefox':
        return <Globe className="w-5 h-5" />;
      case 'safari':
        return <Globe className="w-5 h-5" />;
      default:
        return <Globe className="w-5 h-5" />;
    }
  };

  const getBrowserInstructions = () => {
    const baseInstructions = {
      chrome: [
        'Click the lock/info icon in the address bar',
        'Find "Microphone" in the permissions list',
        'Change it to "Allow"',
        'Refresh the page'
      ],
      firefox: [
        'Click the lock icon in the address bar',
        'Click "Connection secure" > "More information"',
        'Go to the "Permissions" tab',
        'Find "Use the Microphone" and uncheck "Use default"',
        'Select "Allow" and refresh the page'
      ],
      safari: [
        'Go to Safari > Preferences > Websites',
        'Click on "Microphone" in the sidebar',
        'Find this website in the list',
        'Change the setting to "Allow"',
        'Refresh the page'
      ],
      edge: [
        'Click the lock icon in the address bar',
        'Click "Permissions for this site"',
        'Find "Microphone" and set to "Allow"',
        'Refresh the page'
      ],
      other: [
        'Open your browser settings',
        'Find privacy or site permissions',
        'Allow microphone access for this site',
        'Refresh the page'
      ]
    };

    return baseInstructions[browser] || baseInstructions.other;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-500" />
            Microphone Permission Required
          </DialogTitle>
          <DialogDescription>
            EVA Voice Assistant needs access to your microphone to enable voice interactions
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Permission Status */}
          <div className="flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
            {permissionState === 'checking' && (
              <div className="text-center space-y-2">
                <div className="animate-pulse">
                  <Mic className="w-12 h-12 text-gray-400 mx-auto" />
                </div>
                <p className="text-sm text-gray-500">Checking microphone permission...</p>
              </div>
            )}
            
            {permissionState === 'prompt' && (
              <div className="text-center space-y-2">
                <Mic className="w-12 h-12 text-purple-500 mx-auto" />
                <p className="text-sm text-gray-600">
                  Click &quot;Allow Microphone&quot; to enable voice features
                </p>
              </div>
            )}
            
            {permissionState === 'granted' && (
              <div className="text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                <p className="text-sm text-green-600 font-medium">
                  Microphone permission granted!
                </p>
              </div>
            )}
            
            {permissionState === 'denied' && (
              <div className="text-center space-y-2">
                <MicOff className="w-12 h-12 text-red-500 mx-auto" />
                <p className="text-sm text-red-600 font-medium">
                  Microphone permission denied
                </p>
              </div>
            )}
            
            {permissionState === 'error' && (
              <div className="text-center space-y-2">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto" />
                <p className="text-sm text-yellow-600 font-medium">
                  Microphone error detected
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <Alert variant={permissionState === 'denied' ? 'destructive' : 'default'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Browser Instructions */}
          {showInstructions && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {getBrowserIcon()}
                <h4 className="text-sm font-medium">
                  How to enable microphone in {browser === 'other' ? 'your browser' : browser}:
                </h4>
              </div>
              <ol className="space-y-1 text-sm text-gray-600">
                {getBrowserInstructions().map((step, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-purple-500 font-medium">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Additional Help */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5" />
            <div className="text-xs text-blue-600 dark:text-blue-400">
              <p className="font-medium mb-1">Why do we need microphone access?</p>
              <p>
                EVA uses your microphone to listen to your voice commands and provide 
                hands-free assistance. Your audio is processed securely and never stored.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={permissionState === 'checking'}
          >
            Cancel
          </Button>
          {permissionState === 'prompt' && (
            <Button
              onClick={requestPermission}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Mic className="w-4 h-4 mr-2" />
              Allow Microphone
            </Button>
          )}
          {permissionState === 'denied' && (
            <Button
              variant="outline"
              onClick={() => setShowInstructions(!showInstructions)}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              {showInstructions ? 'Hide' : 'Show'} Instructions
            </Button>
          )}
          {permissionState === 'granted' && (
            <Button
              onClick={onClose}
              className="bg-green-600 hover:bg-green-700"
            >
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}