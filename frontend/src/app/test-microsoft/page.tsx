'use client';

import { useState, useEffect } from 'react';
import { authHelpers } from '@/lib/supabase/auth';
import { Loader2, CheckCircle, XCircle, Mail, Calendar, Users } from 'lucide-react';

export default function TestMicrosoftPage() {
  const [user, setUser] = useState<any>(null);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndIntegration();
  }, []);

  const checkAuthAndIntegration = async () => {
    try {
      const currentUser = await authHelpers.getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        // TODO: Implement Microsoft integration check methods
        // const hasIntegration = await authHelpers.checkMicrosoftIntegration(currentUser.id);
        // if (hasIntegration) {
        //   const status = await authHelpers.getMicrosoftIntegrationStatus(currentUser.id);
        //   setIntegrationStatus(status);
        // }
        setIntegrationStatus('pending');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    setTestResults((prev: any) => ({ ...prev, [testName]: { loading: true } }));
    
    try {
      const result = await testFn();
      setTestResults((prev: any) => ({ 
        ...prev, 
        [testName]: { success: true, data: result, loading: false } 
      }));
    } catch (err: any) {
      setTestResults((prev: any) => ({ 
        ...prev, 
        [testName]: { success: false, error: err.message, loading: false } 
      }));
    }
  };

  const testEmails = () => runTest('emails', async () => {
    const response = await fetch('/api/microsoft/emails');
    if (!response.ok) throw new Error('Failed to fetch emails');
    return await response.json();
  });

  const testCalendar = () => runTest('calendar', async () => {
    const response = await fetch('/api/microsoft/calendar');
    if (!response.ok) throw new Error('Failed to fetch calendar');
    return await response.json();
  });

  const testContacts = () => runTest('contacts', async () => {
    const response = await fetch('/api/microsoft/contacts');
    if (!response.ok) throw new Error('Failed to fetch contacts');
    return await response.json();
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Microsoft Integration Test
        </h1>

        {/* User Info */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          {user ? (
            <div className="space-y-2">
              <p><strong>ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Name:</strong> {user.profile?.full_name || 'N/A'}</p>
            </div>
          ) : (
            <p className="text-gray-500">Not logged in</p>
          )}
        </div>

        {/* Integration Status */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Microsoft Integration Status</h2>
          {integrationStatus ? (
            <div className="space-y-2">
              <div className="flex items-center">
                {integrationStatus.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mr-2" />
                )}
                <span>Connected: {integrationStatus.connected ? 'Yes' : 'No'}</span>
              </div>
              {integrationStatus.connected && (
                <>
                  <p><strong>Expires:</strong> {new Date(integrationStatus.expiresAt).toLocaleString()}</p>
                  <p><strong>Expired:</strong> {integrationStatus.expired ? 'Yes' : 'No'}</p>
                  <p><strong>Last Updated:</strong> {new Date(integrationStatus.lastUpdated).toLocaleString()}</p>
                </>
              )}
            </div>
          ) : (
            <div>
              <p className="text-gray-500 mb-4">No Microsoft integration found</p>
              <button
                onClick={() => authHelpers.signInWithMicrosoft()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Connect Microsoft Account
              </button>
            </div>
          )}
        </div>

        {/* API Tests */}
        {integrationStatus?.connected && !integrationStatus.expired && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">API Tests</h2>
            <div className="space-y-4">
              {/* Email Test */}
              <div className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 mr-2" />
                    <h3 className="font-medium">Email API</h3>
                  </div>
                  <button
                    onClick={testEmails}
                    disabled={testResults.emails?.loading}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {testResults.emails?.loading ? 'Testing...' : 'Test'}
                  </button>
                </div>
                {testResults.emails && (
                  <div className="mt-2 text-sm">
                    {testResults.emails.success ? (
                      <pre className="bg-green-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(testResults.emails.data, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-red-600">{testResults.emails.error}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Calendar Test */}
              <div className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    <h3 className="font-medium">Calendar API</h3>
                  </div>
                  <button
                    onClick={testCalendar}
                    disabled={testResults.calendar?.loading}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {testResults.calendar?.loading ? 'Testing...' : 'Test'}
                  </button>
                </div>
                {testResults.calendar && (
                  <div className="mt-2 text-sm">
                    {testResults.calendar.success ? (
                      <pre className="bg-green-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(testResults.calendar.data, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-red-600">{testResults.calendar.error}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Contacts Test */}
              <div className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    <h3 className="font-medium">Contacts API</h3>
                  </div>
                  <button
                    onClick={testContacts}
                    disabled={testResults.contacts?.loading}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {testResults.contacts?.loading ? 'Testing...' : 'Test'}
                  </button>
                </div>
                {testResults.contacts && (
                  <div className="mt-2 text-sm">
                    {testResults.contacts.success ? (
                      <pre className="bg-green-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(testResults.contacts.data, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-red-600">{testResults.contacts.error}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mt-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
