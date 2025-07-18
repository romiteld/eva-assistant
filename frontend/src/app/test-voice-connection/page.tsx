'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/browser';

export default function TestVoiceConnection() {
  const [status, setStatus] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const addStatus = (message: string) => {
    setStatus(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testConnection = async () => {
    setStatus([]);
    setError(null);
    
    try {
      // Step 1: Check authentication
      addStatus('Checking authentication...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in first.');
      }
      addStatus('✓ Authenticated successfully');
      
      // Step 2: Test Supabase connection
      addStatus('Testing Supabase connection...');
      const { data, error: pingError } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (pingError) {
        throw new Error(`Supabase connection failed: ${pingError.message}`);
      }
      addStatus('✓ Supabase connection successful');
      
      // Step 3: Check Gemini API key
      addStatus('Checking Gemini API key...');
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not found in environment variables');
      }
      addStatus('✓ Gemini API key found');
      
      // Step 4: Test direct Gemini API
      addStatus('Testing Gemini API directly...');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!response.ok) {
        throw new Error(`Gemini API test failed: ${response.status} ${response.statusText}`);
      }
      addStatus('✓ Gemini API accessible');
      
      // Step 5: Test WebSocket Edge Function
      addStatus('Testing WebSocket Edge Function...');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const wsBaseUrl = supabaseUrl.replace('https://', 'wss://');
      const wsUrl = `${wsBaseUrl}/functions/v1/gemini-websocket?model=gemini-2.0-flash-exp&token=${encodeURIComponent(session.access_token)}`;
      
      addStatus(`Connecting to: ${wsUrl.split('?')[0]}...`);
      
      const ws = new WebSocket(wsUrl);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout (10s)'));
        }, 10000);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          addStatus('✓ WebSocket connected successfully');
          ws.close();
          resolve(true);
        };
        
        ws.onerror = (event) => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection error'));
        };
        
        ws.onclose = (event) => {
          if (!event.wasClean) {
            addStatus(`WebSocket closed: code=${event.code}, reason=${event.reason || 'No reason provided'}`);
          }
        };
      });
      
      addStatus('✅ All tests passed! Voice agent should work.');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      addStatus(`❌ Error: ${errorMessage}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Voice Agent Connection Test</h1>
        
        <button
          onClick={testConnection}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg mb-8 transition-colors"
        >
          Run Connection Test
        </button>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-8">
            <h3 className="font-bold mb-2">Error:</h3>
            <p>{error}</p>
          </div>
        )}
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Test Results:</h2>
          <div className="space-y-2 font-mono text-sm">
            {status.length === 0 ? (
              <p className="text-gray-500">Click &quot;Run Connection Test&quot; to start</p>
            ) : (
              status.map((line, i) => (
                <div key={i} className={line.includes('✓') ? 'text-green-400' : line.includes('❌') ? 'text-red-400' : 'text-gray-300'}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Troubleshooting Tips:</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Make sure you&apos;re logged in to the application</li>
            <li>Check that the Gemini API key is set in environment variables</li>
            <li>Ensure the Supabase Edge Function is deployed</li>
            <li>Check browser console for additional error details</li>
            <li>Try using Chrome or Edge for best WebRTC support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}