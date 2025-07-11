'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'

export default function TestOAuthFlow() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in
    checkUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session)
      if (event === 'SIGNED_IN' && session) {
        setSuccess(true)
        setUser(session.user)
        // Redirect to dashboard after successful sign in
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
    }
  }

  const handleMicrosoftSignIn = async () => {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          scopes: 'email openid profile',
        }
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        console.log('OAuth initiated:', data)
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error')
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSuccess(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Microsoft OAuth Flow Test</h1>

        {user ? (
          <div className="space-y-6">
            <div className="p-6 bg-green-900/20 border border-green-500 rounded">
              <h2 className="text-xl font-semibold text-green-400 mb-4">Signed In Successfully!</h2>
              <div className="space-y-2 text-gray-300">
                <p>Email: {user.email}</p>
                <p>ID: {user.id}</p>
                <p>Provider: {user.app_metadata?.provider || 'unknown'}</p>
                {user.user_metadata?.full_name && (
                  <p>Name: {user.user_metadata.full_name}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <button
              onClick={handleMicrosoftSignIn}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50 w-full"
            >
              {loading ? 'Redirecting to Microsoft...' : 'Sign in with Microsoft'}
            </button>

            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500 rounded">
                <p className="text-red-400">Error: {error}</p>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-900/20 border border-green-500 rounded">
                <p className="text-green-400">Sign in successful! Redirecting to dashboard...</p>
              </div>
            )}

            <div className="space-y-4 text-sm text-gray-400">
              <div className="p-4 bg-gray-900 rounded">
                <h3 className="font-semibold text-gray-300 mb-2">OAuth Configuration:</h3>
                <ul className="space-y-1">
                  <li>Provider: Azure (Microsoft Entra ID)</li>
                  <li>Client ID: bfa77df6-6952-4d0f-9816-003b3101b9da</li>
                  <li>Tenant ID: 29ee1479-b5f7-48c5-b665-7de9a8a9033e</li>
                  <li>Callback URL: https://[your-project].supabase.co/auth/v1/callback</li>
                </ul>
              </div>

              <div className="p-4 bg-yellow-900/20 border border-yellow-600 rounded">
                <h3 className="font-semibold text-yellow-400 mb-2">Important:</h3>
                <p className="text-yellow-300">
                  Make sure the Azure provider is properly configured in your Supabase dashboard
                  with the correct Client ID and Client Secret.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}