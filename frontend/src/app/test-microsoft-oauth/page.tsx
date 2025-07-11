'use client'

import { useState } from 'react'
import { authHelpers } from '@/lib/supabase/auth'

export default function TestMicrosoftOAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleSignIn = async () => {
    setLoading(true)
    setError('')

    try {
      await authHelpers.signInWithMicrosoft()
      // The function will redirect, so this won't execute
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Test Microsoft OAuth with PKCE</h1>
        
        <div className="space-y-6">
          <div className="p-6 bg-gray-900 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">OAuth Configuration</h2>
            <div className="space-y-2 text-sm text-gray-400">
              <p>✅ PKCE Support: Enabled</p>
              <p>✅ Client ID: bfa77df6-6952-4d0f-9816-003b3101b9da</p>
              <p>✅ Tenant ID: 29ee1479-b5f7-48c5-b665-7de9a8a9033e</p>
              <p>✅ Redirect URI: {typeof window !== 'undefined' ? `${window.location.origin}/auth/microsoft/callback` : 'Loading...'}</p>
            </div>
          </div>

          <div className="p-6 bg-blue-900/20 border border-blue-600 rounded-lg">
            <h3 className="text-blue-400 font-semibold mb-2">Important:</h3>
            <p className="text-blue-300 text-sm">
              Make sure to add <code className="bg-gray-800 px-2 py-1 rounded">http://localhost:3000/auth/microsoft/callback</code> 
              to your Microsoft Entra ID app&apos;s redirect URIs.
            </p>
          </div>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Redirecting to Microsoft...' : 'Sign in with Microsoft (PKCE Enabled)'}
          </button>

          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="mt-8 p-6 bg-gray-900 rounded-lg">
            <h3 className="text-white font-semibold mb-4">How it works:</h3>
            <ol className="space-y-2 text-sm text-gray-400">
              <li>1. Generates PKCE code verifier and challenge</li>
              <li>2. Redirects to Microsoft with PKCE parameters</li>
              <li>3. Microsoft validates and returns to our callback</li>
              <li>4. We exchange the code for tokens (with code verifier)</li>
              <li>5. Create or update user in Supabase</li>
              <li>6. Send magic link for final authentication</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}