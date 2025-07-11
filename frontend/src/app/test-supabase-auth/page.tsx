'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/browser'

export default function TestSupabaseAuth() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testMicrosoftAuth = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (error) {
        setError(error.message)
        console.error('OAuth error:', error)
      } else {
        setResult(data)
        console.log('OAuth success:', data)
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error')
      console.error('Caught error:', err)
    } finally {
      setLoading(false)
    }
  }

  const checkSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      setError(error.message)
      setResult(null)
    } else {
      setResult(session)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Test Supabase Auth</h1>
        
        <div className="space-y-4">
          <button
            onClick={testMicrosoftAuth}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Test Microsoft OAuth'}
          </button>
          
          <button
            onClick={checkSession}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ml-4"
          >
            Check Session
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500 rounded">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-900/20 border border-green-500 rounded">
            <pre className="text-green-400 text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-8 text-gray-400">
          <h2 className="text-lg font-semibold mb-2">Debug Info:</h2>
          <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
          <p>Redirect URL: {window.location.origin}/auth/callback</p>
        </div>
      </div>
    </div>
  )
}