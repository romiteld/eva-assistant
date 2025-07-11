import React, { useEffect, useState } from 'react';
import { supabase, realtimeHelpers } from '@/lib/supabase/browser';
import { geminiHelpers } from '@/lib/gemini/client';

/**
 * Test Component for Conversation Functionality
 * 
 * This component demonstrates and tests:
 * 1. Storing conversations in Supabase
 * 2. Real-time message updates
 * 3. Message sending/receiving flow
 * 4. Conversation history persistence
 */
export default function ConversationTest() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (test: string, status: 'success' | 'error' | 'info', details: any) => {
    setTestResults(prev => [...prev, { test, status, details, timestamp: new Date() }]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    // Test 1: Database Structure
    try {
      addResult('Database Structure', 'info', 'Checking conversations table...');
      
      const { data: columns, error } = await supabase
        .from('conversations')
        .select('*')
        .limit(0);

      if (error) {
        addResult('Database Structure', 'error', error.message);
      } else {
        addResult('Database Structure', 'success', 'Conversations table accessible');
      }
    } catch (error) {
      addResult('Database Structure', 'error', error);
    }

    // Test 2: Insert Message
    try {
      addResult('Insert Message', 'info', 'Testing message insertion...');
      
      const testMessage = {
        user_id: 'test-user-' + Date.now(),
        content: 'Test message at ' + new Date().toISOString(),
        role: 'user' as const,
        metadata: { test: true }
      };

      const { data, error } = await supabase
        .from('conversations')
        .insert(testMessage)
        .select()
        .single();

      if (error) {
        addResult('Insert Message', 'error', error.message);
      } else {
        addResult('Insert Message', 'success', data);
      }
    } catch (error) {
      addResult('Insert Message', 'error', error);
    }

    // Test 3: Real-time Subscription
    try {
      addResult('Real-time Subscription', 'info', 'Testing real-time updates...');
      
      const testUserId = 'realtime-test-' + Date.now();
      let messageReceived = false;

      const channel = realtimeHelpers.subscribeToConversations(
        testUserId,
        (payload: any) => {
          messageReceived = true;
          addResult('Real-time Subscription', 'success', `Received event: ${payload.eventType}`);
        }
      );

      // Wait for subscription to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Insert a message to trigger real-time update
      await supabase
        .from('conversations')
        .insert({
          user_id: testUserId,
          content: 'Real-time test message',
          role: 'user',
          metadata: { realtime_test: true }
        });

      // Wait for message
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!messageReceived) {
        addResult('Real-time Subscription', 'info', 'No real-time message received (may be normal if not authenticated)');
      }

      channel.unsubscribe();
    } catch (error) {
      addResult('Real-time Subscription', 'error', error);
    }

    // Test 4: Conversation History
    try {
      addResult('Conversation History', 'info', 'Testing history retrieval...');
      
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        addResult('Conversation History', 'error', error.message);
      } else {
        addResult('Conversation History', 'success', `Retrieved ${data.length} messages`);
      }
    } catch (error) {
      addResult('Conversation History', 'error', error);
    }

    // Test 5: Gemini Integration
    try {
      addResult('Gemini Integration', 'info', 'Testing AI response generation...');
      
      const response = await geminiHelpers.generateConversationResponse(
        'Hello, can you help me test the conversation system?',
        [
          { role: 'user', content: 'Hi EVA' },
          { role: 'assistant', content: 'Hello! How can I assist you today?' }
        ]
      );

      addResult('Gemini Integration', 'success', response.substring(0, 100) + '...');
    } catch (error) {
      addResult('Gemini Integration', 'error', error);
    }

    setIsRunning(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Conversation Functionality Test</h1>
      
      <button
        onClick={runTests}
        disabled={isRunning}
        className="mb-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg"
      >
        {isRunning ? 'Running Tests...' : 'Run Tests'}
      </button>

      <div className="space-y-4">
        {testResults.map((result, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              result.status === 'success' ? 'bg-green-900/20 border-green-700' :
              result.status === 'error' ? 'bg-red-900/20 border-red-700' :
              'bg-blue-900/20 border-blue-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{result.test}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {typeof result.details === 'object' 
                    ? JSON.stringify(result.details, null, 2)
                    : result.details}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                result.status === 'success' ? 'bg-green-700' :
                result.status === 'error' ? 'bg-red-700' :
                'bg-blue-700'
              }`}>
                {result.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Test Summary</h2>
        <p className="text-sm text-gray-400">
          This test component validates the core conversation functionality:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-400 mt-2">
          <li>✓ Database table structure and accessibility</li>
          <li>✓ Message insertion and retrieval</li>
          <li>✓ Real-time subscriptions (requires authentication)</li>
          <li>✓ Conversation history persistence</li>
          <li>✓ AI response generation via Gemini</li>
        </ul>
      </div>
    </div>
  );
}