'use client';

import { UnifiedVoiceInterface } from '@/components/voice/UnifiedVoiceInterface';
import { VoiceProvider } from '@/types/voice';
import { useState } from 'react';

export default function VoicePage() {
  const [currentProvider, setCurrentProvider] = useState<VoiceProvider>(VoiceProvider.ELEVENLABS);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Voice Interface</h1>
          <p className="text-muted-foreground">
            Choose between different voice providers for text-to-speech and conversational AI
          </p>
        </div>

        <UnifiedVoiceInterface
          defaultProvider={currentProvider}
          onProviderChange={setCurrentProvider}
        />
      </div>
    </div>
  );
}