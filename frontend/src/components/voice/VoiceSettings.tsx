'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { VoiceType } from '@/types/voice';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

interface VoiceSettingsProps {
  selectedVoice: VoiceType;
  onVoiceChange: (voice: VoiceType) => void;
  isConnected: boolean;
}

// Only show Gemini voices for selection
const geminiVoices = [
  VoiceType.PUCK,
  VoiceType.CHARON,
  VoiceType.KORE,
  VoiceType.FENRIR,
  VoiceType.AOEDE,
];

const voiceDescriptions: Record<string, { description: string; personality: string }> = {
  [VoiceType.PUCK]: {
    description: 'A warm, friendly voice with a slight British accent',
    personality: 'Professional, helpful, and approachable',
  },
  [VoiceType.CHARON]: {
    description: 'A deep, authoritative voice with clear pronunciation',
    personality: 'Confident, knowledgeable, and trustworthy',
  },
  [VoiceType.KORE]: {
    description: 'A bright, energetic voice with a modern feel',
    personality: 'Enthusiastic, dynamic, and engaging',
  },
  [VoiceType.FENRIR]: {
    description: 'A strong, masculine voice with gravitas',
    personality: 'Powerful, commanding, and decisive',
  },
  [VoiceType.AOEDE]: {
    description: 'A melodic, soothing voice with gentle tones',
    personality: 'Calm, patient, and nurturing',
  },
};

export function VoiceSettings({ selectedVoice, onVoiceChange, isConnected }: VoiceSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Voice changes will take effect on the next connection
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Label>Select Voice</Label>
          <RadioGroup value={selectedVoice} onValueChange={(value) => onVoiceChange(value as VoiceType)}>
            {geminiVoices.map((voice) => (
              <div key={voice} className="mb-4">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value={voice} id={voice} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={voice} className="cursor-pointer">
                      <div className="font-semibold">{voice}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {voiceDescriptions[voice].description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Personality:</span> {voiceDescriptions[voice].personality}
                      </div>
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-2">Audio Settings</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Echo cancellation: Enabled</p>
            <p>• Noise suppression: Enabled</p>
            <p>• Auto gain control: Enabled</p>
            <p>• Sample rate: 16kHz</p>
            <p>• Channels: Mono</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}