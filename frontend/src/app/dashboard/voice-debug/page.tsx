'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/browser';

export default function VoiceDebugPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📝';
    setLogs(prev => [...prev, `${timestamp} ${prefix} ${message}`]);
  }, []);

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    if (session) {
      addLog('Authenticated as: ' + session.user.email, 'success');
    } else {
      addLog('Not authenticated', 'error');
    }
  }, [addLog]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const testDirectGeminiAPI = async () => {
    addLog('Testing direct Gemini API...');
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      addLog('No Gemini API key found', 'error');
      return;
    }
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (response.ok) {
        const data = await response.json();
        addLog(`Gemini API works! Found ${data.models?.length || 0} models`, 'success');
      } else {
        addLog(`Gemini API error: ${response.status} ${response.statusText}`, 'error');
      }
    } catch (error) {
      addLog(`Gemini API error: ${error}`, 'error');
    }
  };

  const testWebSocketConnection = async () => {
    addLog('Starting WebSocket test...');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      addLog('Please login first', 'error');
      return;
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const wsUrl = `${supabaseUrl.replace('https://', 'wss://')}/functions/v1/gemini-websocket?model=gemini-2.0-flash-exp&token=${encodeURIComponent(session.access_token)}`;
    
    addLog(`Connecting to: ${wsUrl.split('?')[0]}...`);
    
    try {
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        addLog('WebSocket connected!', 'success');
        setWs(websocket);
        
        // Send setup message
        const setupMessage = {
          setup: {
            model: 'models/gemini-2.0-flash-exp',
            generationConfig: {
              responseModalities: ['AUDIO', 'TEXT'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck'
                  }
                }
              }
            }
          }
        };
        
        websocket.send(JSON.stringify(setupMessage));
        addLog('Sent setup message', 'info');
      };
      
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`Received: ${JSON.stringify(data).substring(0, 100)}...`, 'info');
        } catch (e) {
          addLog(`Received non-JSON: ${event.data.substring(0, 100)}...`, 'info');
        }
      };
      
      websocket.onerror = (error) => {
        addLog(`WebSocket error: ${error}`, 'error');
      };
      
      websocket.onclose = (event) => {
        addLog(`WebSocket closed: code=${event.code}, reason=${event.reason || 'Unknown'}`, event.wasClean ? 'info' : 'error');
        setWs(null);
      };
      
    } catch (error) {
      addLog(`Failed to create WebSocket: ${error}`, 'error');
    }
  };

  const sendTestMessage = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      addLog('WebSocket not connected', 'error');
      return;
    }
    
    const message = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: 'Hello, can you hear me?' }]
        }],
        turnComplete: true
      }
    };
    
    ws.send(JSON.stringify(message));
    addLog('Sent test message', 'info');
  };

  const closeWebSocket = () => {
    if (ws) {
      ws.close();
      setWs(null);
      addLog('Closed WebSocket connection', 'info');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Voice Agent Debug Console</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Connection Tests</h2>
            <div className="space-y-4">
              <button
                onClick={testDirectGeminiAPI}
                className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
              >
                Test Gemini API
              </button>
              
              <button
                onClick={testWebSocketConnection}
                className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors"
                disabled={!isAuthenticated}
              >
                Connect WebSocket
              </button>
              
              <button
                onClick={sendTestMessage}
                className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded transition-colors"
                disabled={!ws}
              >
                Send Test Message
              </button>
              
              <button
                onClick={closeWebSocket}
                className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
                disabled={!ws}
              >
                Close Connection
              </button>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Status</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Authentication:</span>
                <span className={isAuthenticated ? 'text-green-400' : 'text-red-400'}>
                  {isAuthenticated ? 'Logged In' : 'Not Logged In'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>WebSocket:</span>
                <span className={ws ? 'text-green-400' : 'text-gray-400'}>
                  {ws ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Gemini API Key:</span>
                <span className={process.env.NEXT_PUBLIC_GEMINI_API_KEY ? 'text-green-400' : 'text-red-400'}>
                  {process.env.NEXT_PUBLIC_GEMINI_API_KEY ? 'Present' : 'Missing'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Debug Logs</h2>
          <div className="bg-black rounded p-4 h-96 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Run a test to see output.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}