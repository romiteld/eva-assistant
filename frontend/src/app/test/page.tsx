'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { authTestUtils } from '@/lib/supabase/auth-test';
import { dbTestUtils } from '@/lib/supabase/db-test';
import { CheckCircle, XCircle, Loader2, Play } from 'lucide-react';
import FirecrawlTest from '@/components/FirecrawlTest';

export default function TestPage() {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    setLoading(prev => ({ ...prev, [testName]: true }));
    try {
      const result = await testFn();
      setTestResults(prev => ({ ...prev, [testName]: result }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, [testName]: { success: false, error } }));
    }
    setLoading(prev => ({ ...prev, [testName]: false }));
  };

  const tests = [
    { name: 'Database Connection', fn: dbTestUtils.testConnection },
    { name: 'CRUD Operations', fn: dbTestUtils.testCrudOperations },
    { name: 'Storage Bucket', fn: dbTestUtils.testStorage },
    { name: 'Real-time Subscriptions', fn: dbTestUtils.testRealtimeSubscriptions },
    { name: 'Presence Tracking', fn: dbTestUtils.testPresence },
    { name: 'Auth Session', fn: authTestUtils.testSession },
    { name: 'Profile Operations', fn: authTestUtils.testProfile },
  ];

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">EVA System Tests</h1>
        
        {user ? (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <p className="text-sm text-gray-400">Logged in as:</p>
              <p className="text-white font-mono">{user.email}</p>
            </div>

            <div className="grid gap-4">
              {tests.map((test: { name: string; fn: () => Promise<any> }) => (
                <div
                  key={test.name}
                  className="bg-gray-900 rounded-lg p-4 border border-gray-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-white">{test.name}</h3>
                      {testResults[test.name] && (
                        testResults[test.name].success ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )
                      )}
                    </div>
                    <button
                      onClick={() => runTest(test.name, test.fn)}
                      disabled={loading[test.name]}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading[test.name] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Run Test
                    </button>
                  </div>

                  {testResults[test.name] && (
                    <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                      <pre className="text-xs text-gray-300 overflow-x-auto">
                        {JSON.stringify(testResults[test.name], null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8">
              <button
                onClick={async () => {
                  for (const test of tests) {
                    await runTest(test.name, test.fn);
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700"
              >
                Run All Tests
              </button>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Open browser console for detailed test output
              </p>
            </div>

            {/* Firecrawl Testing Section */}
            <div className="mt-12 p-6 bg-gray-900 rounded-lg border border-gray-800">
              <FirecrawlTest />
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 text-center">
            <p className="text-gray-400 mb-4">Please log in to run tests</p>
            <a
              href="/login"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Login
            </a>
          </div>
        )}
      </div>
    </div>
  );
}