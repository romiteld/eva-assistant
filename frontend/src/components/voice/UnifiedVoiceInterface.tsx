'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Play,
  Pause,
  Settings,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useElevenLabs } from '@/hooks/useElevenLabs';
import { ElevenLabsPlayer } from './ElevenLabsPlayer';
import { ELEVENLABS_VOICES, ELEVENLABS_MODELS } from '@/lib/elevenlabs/client';
import { VoiceProvider, VoiceType, UnifiedVoiceConfig } from '@/types/voice';
import { cn } from '@/lib/utils';

interface UnifiedVoiceInterfaceProps {
  defaultProvider?: VoiceProvider;
  onProviderChange?: (provider: VoiceProvider) => void;
  className?: string;
}

export function UnifiedVoiceInterface({
  defaultProvider = VoiceProvider.ELEVENLABS,
  onProviderChange,
  className
}: UnifiedVoiceInterfaceProps) {
  const [provider, setProvider] = useState<VoiceProvider>(defaultProvider);
  const [isRealtime, setIsRealtime] = useState(false);
  const [text, setText] = useState('');
  
  // ElevenLabs hook
  const elevenLabs = useElevenLabs({
    defaultVoiceId: ELEVENLABS_VOICES.ADAM,
    defaultModelId: ELEVENLABS_MODELS.ELEVEN_TURBO_V2_5,
    streamingEnabled: true,
  });

  const handleProviderChange = (newProvider: VoiceProvider) => {
    setProvider(newProvider);
    onProviderChange?.(newProvider);
    
    // Stop any ongoing playback when switching providers
    if (provider === VoiceProvider.ELEVENLABS) {
      elevenLabs.stop();
    }
  };

  const getProviderFeatures = (provider: VoiceProvider) => {
    switch (provider) {
      case VoiceProvider.GEMINI:
        return {
          name: 'Gemini Live',
          description: 'Real-time conversational AI with low latency',
          features: ['Real-time conversation', 'Function calling', 'Multi-turn dialogue'],
          icon: <Sparkles className="h-4 w-4" />,
          color: 'text-blue-500',
        };
      case VoiceProvider.ELEVENLABS:
        return {
          name: 'ElevenLabs',
          description: 'High-quality text-to-speech with natural voices',
          features: ['High-quality TTS', 'Voice cloning', 'Streaming support'],
          icon: <Volume2 className="h-4 w-4" />,
          color: 'text-purple-500',
        };
    }
  };

  const providerInfo = getProviderFeatures(provider);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={provider} onValueChange={(v) => handleProviderChange(v as VoiceProvider)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value={VoiceProvider.ELEVENLABS}>
                <Volume2 className="mr-2 h-4 w-4" />
                ElevenLabs
              </TabsTrigger>
              <TabsTrigger value={VoiceProvider.GEMINI} disabled>
                <Sparkles className="mr-2 h-4 w-4" />
                Gemini (Coming Soon)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('flex items-center gap-2', providerInfo.color)}>
                {providerInfo.icon}
                <span className="font-medium">{providerInfo.name}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {providerInfo.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {providerInfo.features.map((feature, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider-specific Interface */}
      {provider === VoiceProvider.ELEVENLABS && (
        <Card>
          <CardHeader>
            <CardTitle>ElevenLabs TTS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Voice Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Voice</Label>
                <Select 
                  value={elevenLabs.voiceId} 
                  onValueChange={elevenLabs.setVoiceId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ELEVENLABS_VOICES).map(([name, id]) => (
                      <SelectItem key={id} value={id}>
                        {name.charAt(0) + name.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Model</Label>
                <Select 
                  value={elevenLabs.modelId} 
                  onValueChange={elevenLabs.setModelId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ELEVENLABS_MODELS.ELEVEN_TURBO_V2_5}>
                      Turbo v2.5
                    </SelectItem>
                    <SelectItem value={ELEVENLABS_MODELS.ELEVEN_MULTILINGUAL_V2}>
                      Multilingual v2
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Streaming Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Streaming Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Play audio as it&apos;s generated for lower latency
                </p>
              </div>
              <Switch
                checked={isRealtime}
                onCheckedChange={setIsRealtime}
              />
            </div>

            {/* ElevenLabs Player */}
            <ElevenLabsPlayer
              text={text}
              voiceId={elevenLabs.voiceId}
              modelId={elevenLabs.modelId}
              showVisualizer={true}
              showSettings={true}
              streamingEnabled={isRealtime}
              onStateChange={(state) => console.log('Player state:', state)}
            />
          </CardContent>
        </Card>
      )}

      {provider === VoiceProvider.GEMINI && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold">Gemini Live Coming Soon</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Real-time conversational AI with ultra-low latency voice interactions will be available soon.
              </p>
              <div className="flex justify-center gap-2">
                <Badge variant="outline">Real-time Streaming</Badge>
                <Badge variant="outline">Multi-turn Dialogue</Badge>
                <Badge variant="outline">Function Calling</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status and Error Display */}
      {elevenLabs.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{elevenLabs.error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}