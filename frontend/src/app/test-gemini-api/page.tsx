'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestGeminiAPIPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testGeminiAPI = async () => {
    setLoading(true);
    setResult('Testing Gemini API...');
    
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not found in environment');
      }

      // First, list available models
      const modelsResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      
      if (!modelsResponse.ok) {
        const error = await modelsResponse.text();
        throw new Error(`Models API Error (${modelsResponse.status}): ${error}`);
      }

      const modelsData = await modelsResponse.json();
      const availableModels = modelsData.models?.map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        supportedMethods: m.supportedGenerationMethods
      }));
      
      setResult(`Available Models:\n${JSON.stringify(availableModels, null, 2)}`);

      // Find a model that supports generateContent
      const testModel = modelsData.models?.find((m: any) => 
        m.supportedGenerationMethods?.includes('generateContent') &&
        (m.name.includes('gemini-1.5') || m.name.includes('gemini-2'))
      );

      if (testModel) {
        // Test the API with an available model
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${testModel.name}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: 'Hello, this is a test. Please respond with "API test successful"'
                }]
              }]
            })
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API Error (${response.status}): ${error}`);
        }

        const data = await response.json();
        setResult(prev => prev + `\n\nAPI Test with ${testModel.name}: SUCCESS\n\nResponse: ${JSON.stringify(data, null, 2)}`);
      }
      
      // Filter for Live API models
      const liveModels = modelsData.models?.filter((m: any) => 
        m.name.includes('flash') || 
        m.name.includes('live') || 
        m.name.includes('audio') ||
        m.name.includes('exp') ||
        m.supportedGenerationMethods?.includes('streamGenerateContent')
      ).map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        supportedMethods: m.supportedGenerationMethods
      }));
      
      setResult(prev => prev + `\n\nPotential Live/Streaming Models:\n${JSON.stringify(liveModels, null, 2)}`);

    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Gemini API Test</h1>
      
      <Card className="p-6">
        <Button onClick={testGeminiAPI} disabled={loading}>
          {loading ? 'Testing...' : 'Test Gemini API'}
        </Button>
        
        <pre className="mt-4 p-4 bg-gray-100 rounded overflow-auto max-h-96 text-sm">
          {result || 'Click the button to test the API'}
        </pre>
      </Card>

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h2 className="font-semibold mb-2">Test Information</h2>
        <ul className="text-sm space-y-1">
          <li>• This tests if the Gemini API key is valid</li>
          <li>• Checks which models are available for your API key</li>
          <li>• Helps identify if the issue is with the API key or the WebSocket connection</li>
        </ul>
      </div>
    </div>
  );
}