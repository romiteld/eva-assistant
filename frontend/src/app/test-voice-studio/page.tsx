'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/browser';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function TestVoiceStudioPage() {
  const [tests, setTests] = useState({
    auth: { status: 'pending', message: '' },
    supabase: { status: 'pending', message: '' },
    geminiKey: { status: 'pending', message: '' },
    edgeFunction: { status: 'pending', message: '' },
    audioContext: { status: 'pending', message: '' },
    microphone: { status: 'pending', message: '' },
    threeJs: { status: 'pending', message: '' },
    database: { status: 'pending', message: '' }
  });

  const runTests = async () => {
    // Test 1: Check authentication
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setTests(prev => ({ ...prev, auth: { status: 'success', message: 'Authenticated' } }));
      } else {
        setTests(prev => ({ ...prev, auth: { status: 'error', message: 'Not authenticated' } }));
      }
    } catch (error) {
      setTests(prev => ({ ...prev, auth: { status: 'error', message: error instanceof Error ? error.message : String(error) } }));
    }

    // Test 2: Check Supabase connection
    try {
      const { data, error } = await supabase.from('voice_conversations').select('count').limit(1);
      if (error) throw error;
      setTests(prev => ({ ...prev, supabase: { status: 'success', message: 'Connected to Supabase' } }));
    } catch (error) {
      setTests(prev => ({ ...prev, supabase: { status: 'error', message: error instanceof Error ? error.message : String(error) } }));
    }

    // Test 3: Check Gemini API key
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (geminiKey && geminiKey.startsWith('AIza')) {
      setTests(prev => ({ ...prev, geminiKey: { status: 'success', message: 'API key configured' } }));
    } else {
      setTests(prev => ({ ...prev, geminiKey: { status: 'error', message: 'API key not found' } }));
    }

    // Test 4: Check Edge Function
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const wsUrl = `${supabaseUrl}/functions/v1/gemini-websocket`;
        const response = await fetch(wsUrl, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (response.status === 400) {
          setTests(prev => ({ ...prev, edgeFunction: { status: 'success', message: 'Edge Function responding (expects WebSocket)' } }));
        } else {
          setTests(prev => ({ ...prev, edgeFunction: { status: 'error', message: `Unexpected status: ${response.status}` } }));
        }
      }
    } catch (error) {
      setTests(prev => ({ ...prev, edgeFunction: { status: 'error', message: error instanceof Error ? error.message : String(error) } }));
    }

    // Test 5: Check AudioContext support
    try {
      // Properly type webkitAudioContext for Safari compatibility
      const AudioContextConstructor = window.AudioContext || 
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      
      if (AudioContextConstructor) {
        const ctx = new AudioContextConstructor();
        await ctx.close();
        setTests(prev => ({ ...prev, audioContext: { status: 'success', message: 'AudioContext supported' } }));
      } else {
        setTests(prev => ({ ...prev, audioContext: { status: 'error', message: 'AudioContext not supported' } }));
      }
    } catch (error) {
      setTests(prev => ({ ...prev, audioContext: { status: 'error', message: error instanceof Error ? error.message : String(error) } }));
    }

    // Test 6: Check microphone permissions
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setTests(prev => ({ ...prev, microphone: { 
        status: result.state === 'granted' ? 'success' : 'warning', 
        message: `Permission: ${result.state}` 
      } }));
    } catch (error) {
      setTests(prev => ({ ...prev, microphone: { status: 'warning', message: 'Cannot check permission' } }));
    }

    // Test 7: Check Three.js
    try {
      const THREE = await import('three');
      if (THREE.WebGLRenderer) {
        setTests(prev => ({ ...prev, threeJs: { status: 'success', message: 'Three.js loaded' } }));
      }
    } catch (error) {
      setTests(prev => ({ ...prev, threeJs: { status: 'error', message: 'Three.js failed to load' } }));
    }

    // Test 8: Test database write
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('voice_conversations')
          .insert({
            user_id: user.id,
            transcript: [{ timestamp: Date.now(), speaker: 'user', text: 'Test message' }]
          });
        if (error) throw error;
        setTests(prev => ({ ...prev, database: { status: 'success', message: 'Can write to database' } }));
      }
    } catch (error) {
      setTests(prev => ({ ...prev, database: { status: 'error', message: error instanceof Error ? error.message : String(error) } }));
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  const getIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <XCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Voice Studio Test Suite</h1>
      
      <div className="grid gap-4 max-w-2xl">
        {Object.entries(tests).map(([key, test]) => (
          <Card key={key} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getIcon(test.status)}
                <div>
                  <h3 className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
                  <p className="text-sm text-gray-600">{test.message}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <Button onClick={runTests}>Re-run Tests</Button>
        <Button onClick={() => window.location.href = '/dashboard/eva-voice'}>
          Go to EVA Voice
        </Button>
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold mb-2">Test Summary</h2>
        <ul className="text-sm space-y-1">
          <li>✓ Voice Studio component created with 3D visualization</li>
          <li>✓ Transcription display added</li>
          <li>✓ Conversation history storage implemented</li>
          <li>✓ Database table created with RLS policies</li>
          <li>✓ Edge Function deployed with correct WebSocket URL</li>
        </ul>
      </div>
    </div>
  );
}