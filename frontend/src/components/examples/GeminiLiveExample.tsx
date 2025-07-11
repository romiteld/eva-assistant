'use client';

import React, { useState } from 'react';
import { useGeminiWebSocket } from '@/lib/gemini/websocket-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function GeminiLiveExample() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  const { client, isConnected, sendSetup, sendMessage } = useGeminiWebSocket({
    onOpen: () => {
      console.log('Connected to Gemini Live');
      // Send setup message when connected
      sendSetup('models/gemini-2.0-flash-exp');
    },
    onMessage: (data) => {
      console.log('Received message:', data);
      setMessages((prev) => [...prev, data]);

      // Handle different message types
      switch (data.type) {
        case 'setupComplete':
          setIsSetupComplete(true);
          break;
        case 'serverContent':
          // Handle server content (AI responses)
          break;
        case 'toolCall':
          // Handle tool/function calls
          break;
        case 'toolCallCancellation':
          // Handle tool call cancellations
          break;
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
    onClose: (code, reason) => {
      console.log(`WebSocket closed: ${code} - ${reason}`);
      setIsSetupComplete(false);
    },
  });

  const handleSendMessage = () => {
    if (input.trim() && isSetupComplete) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Gemini Live API Example</h2>
      
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            {isConnected ? 'Connected' : 'Disconnected'}
            {isConnected && !isSetupComplete && ' (Setting up...)'}
            {isConnected && isSetupComplete && ' (Ready)'}
          </span>
        </div>
      </div>

      <div className="mb-4 h-96 overflow-y-auto border rounded p-4 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-gray-500">No messages yet...</p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="mb-2 p-2 bg-white rounded shadow-sm">
              <div className="text-xs text-gray-500 mb-1">Type: {msg.type}</div>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(msg, null, 2)}
              </pre>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={!isConnected || !isSetupComplete}
          className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button
          onClick={handleSendMessage}
          disabled={!isConnected || !isSetupComplete || !input.trim()}
        >
          Send
        </Button>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>Instructions:</p>
        <ul className="list-disc list-inside mt-1">
          <li>The WebSocket will automatically connect when the component mounts</li>
          <li>Wait for the setup to complete before sending messages</li>
          <li>Messages are sent in Gemini&apos;s expected format</li>
          <li>The proxy handles authentication and API key management securely</li>
        </ul>
      </div>
    </Card>
  );
}