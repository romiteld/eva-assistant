'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/browser'

export default function OAuthDiagnostics() {
  const [loading, setLoading] = useState(false)
  const [oauthUrl, setOauthUrl] = useState<string>('')
  const [error, setError] = useState<string>('')

  const generateOAuthUrl = async () => {
    setLoading(true)
    setError('')
    setOauthUrl('')

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          skipBrowserRedirect: true, // Don't redirect, just get the URL
        }
      })

      if (error) {
        setError(error.message)
      } else if (data?.url) {
        setOauthUrl(data.url)
        
        // Parse and display the URL components
        try {
          const url = new URL(data.url)
          console.log('OAuth URL breakdown:', {
            host: url.host,
            pathname: url.pathname,
            params: Object.fromEntries(url.searchParams)
          })
        } catch (e) {
          console.error('Invalid URL:', data.url)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">OAuth Diagnostics</h1>
        
        <button
          onClick={generateOAuthUrl}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50 mb-6"
        >
          {loading ? 'Generating...' : 'Generate OAuth URL (without redirect)'}
        </button>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {oauthUrl && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-900 rounded">
              <h2 className="text-lg font-semibold text-white mb-2">Generated OAuth URL:</h2>
              <p className="text-gray-300 text-sm break-all">{oauthUrl}</p>
            </div>

            <div className="p-4 bg-gray-900 rounded">
              <h2 className="text-lg font-semibold text-white mb-2">URL Analysis:</h2>
              <pre className="text-gray-300 text-sm overflow-auto">
                {JSON.stringify((() => {
                  try {
                    const url = new URL(oauthUrl)
                    return {
                      protocol: url.protocol,
                      host: url.host,
                      pathname: url.pathname,
                      searchParams: Object.fromEntries(url.searchParams)
                    }
                  } catch {
                    return { error: 'Invalid URL format' }
                  }
                })(), null, 2)}
              </pre>
            </div>

            <div className="p-4 bg-yellow-900/20 border border-yellow-600 rounded">
              <p className="text-yellow-400">
                Check if the host is &quot;login.microsoftonline.com&quot; and not your Supabase URL with the secret in the path.
              </p>
            </div>

            <button
              onClick={() => window.open(oauthUrl, '_blank')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Open URL in New Tab (to test)
            </button>
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-900 rounded">
          <h2 className="text-lg font-semibold text-white mb-2">Expected URL Format:</h2>
          <p className="text-gray-400 text-sm">
            https://login.microsoftonline.com/[tenant-id]/oauth2/v2.0/authorize?client_id=[client-id]&redirect_uri={typeof window !== 'undefined' ? window.location.origin : ''}/auth/microsoft/callback&...
          </p>
        </div>
      </div>
    </div>
  )
}