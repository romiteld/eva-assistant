'use client';

import dynamic from 'next/dynamic';
import { useRequireAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

// Voice interface temporarily disabled - Gemini components removed
// const EVAVoiceInterface = dynamic(
//   () => import('@/components/voice/GeminiLiveStudio').then(mod => ({ default: mod.EVAVoiceInterface })),
//   { 
//     ssr: false,
//     loading: () => (
//       <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
//         <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
//       </div>
//     )
//   }
// );

export default function EVAVoicePage() {
  const { user, loading: authLoading } = useRequireAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
      <div className="text-center">
        <h1 className="text-2xl text-gray-200 mb-4">EVA Voice Interface</h1>
        <p className="text-gray-400">Voice interface temporarily unavailable</p>
        <p className="text-gray-500 text-sm mt-2">Gemini components have been removed</p>
      </div>
    </div>
  );
}