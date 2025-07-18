'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, Power, PowerOff, AlertCircle, Settings, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AudioVisualizer } from '@/components/audio/AudioVisualizer';
import { AudioLevelIndicator, AudioMetricsDisplay } from '@/components/audio/AudioLevelIndicator';
import { Slider } from '@/components/ui/slider';

interface VoiceControlProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isConnected: boolean;
  onToggleListening: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  hasPermission: boolean;
  onRequestPermission: () => void;
  audioLevel?: number;
  
  // Enhanced WebRTC features
  frequencyData?: Uint8Array | null;
  waveformData?: Uint8Array | null;
  metrics?: {
    inputLevel: number;
    outputLevel: number;
    noiseLevel: number;
    voiceActivity: boolean;
    latency: number;
    packetsLost: number;
    jitter: number;
  };
  onInputGainChange?: (gain: number) => void;
  onOutputGainChange?: (gain: number) => void;
  onCalibrateNoise?: () => void;
  isCalibrating?: boolean;
}

export function VoiceControl({
  isListening,
  isSpeaking,
  isProcessing,
  isConnected,
  onToggleListening,
  onConnect,
  onDisconnect,
  onStartListening,
  onStopListening,
  hasPermission,
  onRequestPermission,
  audioLevel = 0,
  
  // Enhanced WebRTC features
  frequencyData,
  waveformData,
  metrics,
  onInputGainChange,
  onOutputGainChange,
  onCalibrateNoise,
  isCalibrating = false,
}: VoiceControlProps) {
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [inputGain, setInputGain] = useState(1.0);
  const [outputGain, setOutputGain] = useState(1.0);
  const getMicButtonState = () => {
    if (isProcessing) {
      return {
        icon: <Loader2 className="h-8 w-8 animate-spin" />,
        className: 'bg-orange-500 hover:bg-orange-600',
        disabled: true,
      };
    }
    
    if (isSpeaking) {
      return {
        icon: <Mic className="h-8 w-8" />,
        className: 'bg-blue-500 hover:bg-blue-600 animate-pulse',
        disabled: true,
      };
    }
    
    if (isListening) {
      return {
        icon: <Mic className="h-8 w-8" />,
        className: 'bg-red-500 hover:bg-red-600',
        disabled: false,
      };
    }
    
    return {
      icon: <MicOff className="h-8 w-8" />,
      className: 'bg-gray-500 hover:bg-gray-600',
      disabled: !isConnected,
    };
  };

  const micButtonState = getMicButtonState();

  const handleMicrophoneClick = async () => {
    console.log('Microphone button clicked', { isConnected, hasPermission });
    
    // If not connected, connect first
    if (!isConnected) {
      console.log('Not connected, attempting to connect...');
      await onConnect();
      return;
    }
    
    // If no permission, show permission dialog
    if (!hasPermission) {
      console.log('No permission, showing dialog...');
      setShowPermissionDialog(true);
      setPermissionError(null);
      return;
    }
    
    // Toggle listening state
    console.log('Toggling listening state');
    onToggleListening();
  };

  const handlePermissionRequest = async () => {
    try {
      setPermissionError(null);
      await onRequestPermission();
      setShowPermissionDialog(false);
    } catch (error) {
      console.error('Permission request failed:', error);
      setPermissionError(
        'Microphone access was denied. Please check your browser settings and ensure microphone permissions are allowed for this site.'
      );
    }
  };

  const handleInputGainChange = (value: number[]) => {
    const gain = value[0];
    setInputGain(gain);
    onInputGainChange?.(gain);
  };

  const handleOutputGainChange = (value: number[]) => {
    const gain = value[0];
    setOutputGain(gain);
    onOutputGainChange?.(gain);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Main Controls */}
        <div className="flex items-center gap-4">
          {/* Connection Toggle */}
          <Button
            size="icon"
            variant="outline"
            onClick={isConnected ? onDisconnect : onConnect}
            className="h-12 w-12"
            aria-label={isConnected ? 'Disconnect voice assistant' : 'Connect voice assistant'}
            aria-pressed={isConnected}
          >
            {isConnected ? (
              <Power className="h-5 w-5 text-green-500" aria-hidden="true" />
            ) : (
              <PowerOff className="h-5 w-5 text-gray-500" aria-hidden="true" />
            )}
          </Button>

          {/* Microphone Button with Enhanced Level Indicator */}
          <div className="relative">
            {/* Enhanced Audio Level Ring */}
            <AudioLevelIndicator
              level={metrics?.inputLevel || audioLevel}
              isActive={isListening}
              type="circular"
              size="lg"
              className="absolute inset-0"
            />
            
            {/* Microphone Button */}
            <Button
              size="icon"
              onClick={handleMicrophoneClick}
              disabled={micButtonState.disabled && isConnected}
              className={cn(
                'h-20 w-20 rounded-full transition-all duration-200 relative z-10',
                micButtonState.className,
                isListening && 'shadow-lg shadow-red-500/50',
                isConnected && !hasPermission && 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-black'
              )}
              aria-label={
                isProcessing ? 'Processing speech...' :
                isSpeaking ? 'AI is speaking' :
                isListening ? 'Stop listening' :
                !isConnected ? 'Connect to start voice conversation' :
                !hasPermission ? 'Grant microphone permission' :
                'Start listening'
              }
              aria-pressed={isListening}
              aria-describedby={isConnected && !hasPermission ? 'permission-status' : undefined}
            >
              {React.cloneElement(micButtonState.icon, { 'aria-hidden': true })}
            </Button>
            
            {/* Permission Badge */}
            {isConnected && !hasPermission && (
              <div 
                className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1 z-20"
                aria-hidden="true"
              >
                <AlertCircle className="w-4 h-4 text-black" />
              </div>
            )}
          </div>

          {/* Settings Button */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => setShowSettingsDialog(true)}
            className="h-12 w-12"
            disabled={!isConnected}
            aria-label="Open voice settings"
            aria-expanded={showSettingsDialog}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Status Text */}
          <div 
            className="text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
            id="permission-status"
          >
            {isCalibrating && <span className="text-blue-500">Calibrating...</span>}
            {isProcessing && <span>Processing...</span>}
            {isSpeaking && <span>Speaking...</span>}
            {isListening && <span>Listening...</span>}
            {!isConnected && <span>Disconnected</span>}
            {isConnected && !isListening && !isSpeaking && !isProcessing && !isCalibrating && <span>Ready</span>}
            {isConnected && !hasPermission && <span className="text-yellow-500">Microphone access needed</span>}
          </div>
        </div>

        {/* Audio Visualization */}
        {isConnected && (
          <div className="space-y-4">
            <AudioVisualizer
              frequencyData={frequencyData}
              waveformData={waveformData}
              isActive={isListening || isSpeaking}
              type="frequency"
              height={60}
              className="rounded-lg border bg-muted/50"
            />
            
            {metrics && (
              <AudioMetricsDisplay
                inputLevel={metrics.inputLevel}
                outputLevel={metrics.outputLevel}
                noiseLevel={metrics.noiseLevel}
                voiceActivity={metrics.voiceActivity}
                latency={metrics.latency}
              />
            )}
          </div>
        )}
      </div>

    {/* Microphone Permission Dialog */}
    <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Microphone Access Required
          </DialogTitle>
          <DialogDescription>
            EVA needs access to your microphone to enable voice conversations. This allows you to speak naturally with the AI assistant.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">How to enable microphone access:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Click &quot;Allow Microphone Access&quot; below</li>
              <li>When your browser asks, click &quot;Allow&quot;</li>
              <li>If you accidentally blocked access, click the lock icon in your browser&apos;s address bar</li>
            </ol>
          </div>
          
          {permissionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{permissionError}</AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPermissionDialog(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePermissionRequest}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Mic className="w-4 h-4 mr-2" />
            Allow Microphone Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Audio Settings Dialog */}
    <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Audio Settings
          </DialogTitle>
          <DialogDescription>
            Adjust audio levels and calibrate your microphone for optimal performance.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Input Gain */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="input-gain-slider" 
                className="text-sm font-medium"
              >
                Input Gain
              </label>
              <span 
                className="text-sm text-muted-foreground"
                aria-label={`Input gain level: ${Math.round(inputGain * 100)} percent`}
              >
                {Math.round(inputGain * 100)}%
              </span>
            </div>
            <Slider
              id="input-gain-slider"
              value={[inputGain]}
              onValueChange={handleInputGainChange}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
              aria-label="Adjust input gain level"
            />
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-muted-foreground" />
              <AudioLevelIndicator
                level={metrics?.inputLevel || 0}
                isActive={isListening}
                type="linear"
                size="sm"
                color="rgb(34, 197, 94)"
              />
            </div>
          </div>

          {/* Output Gain */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="output-gain-slider" 
                className="text-sm font-medium"
              >
                Output Gain
              </label>
              <span 
                className="text-sm text-muted-foreground"
                aria-label={`Output gain level: ${Math.round(outputGain * 100)} percent`}
              >
                {Math.round(outputGain * 100)}%
              </span>
            </div>
            <Slider
              id="output-gain-slider"
              value={[outputGain]}
              onValueChange={handleOutputGainChange}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
              aria-label="Adjust output gain level"
            />
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <AudioLevelIndicator
                level={metrics?.outputLevel || 0}
                isActive={isSpeaking}
                type="linear"
                size="sm"
                color="rgb(59, 130, 246)"
              />
            </div>
          </div>

          {/* Noise Calibration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Noise Calibration</label>
              {metrics && (
                <span className="text-sm text-muted-foreground">
                  {Math.round(metrics.noiseLevel * 100)}%
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Calibrate the noise floor for better voice detection. Stay quiet during calibration.
            </p>
            <Button
              onClick={onCalibrateNoise}
              disabled={isCalibrating || !isConnected}
              className="w-full"
              variant="outline"
            >
              {isCalibrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Calibrating...
                </>
              ) : (
                'Calibrate Noise Level'
              )}
            </Button>
          </div>

          {/* Real-time Metrics */}
          {metrics && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Real-time Metrics</label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="font-mono">{metrics.latency}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Packets Lost:</span>
                  <span className="font-mono">{metrics.packetsLost}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jitter:</span>
                  <span className="font-mono">{metrics.jitter}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Voice Active:</span>
                  <span className={metrics.voiceActivity ? 'text-green-500' : 'text-gray-500'}>
                    {metrics.voiceActivity ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowSettingsDialog(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}