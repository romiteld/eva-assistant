'use client';

import dynamic from 'next/dynamic';
import { useRequireAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

// Dynamic import to avoid SSR issues with Three.js
const EVAVoiceInterface = dynamic(
  () => import('@/components/voice/GeminiLiveStudio').then(mod => ({ default: mod.EVAVoiceInterface })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
);

export default function EVAVoicePage() {
  const { user, loading: authLoading } = useRequireAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return <EVAVoiceInterface />;
}