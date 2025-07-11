'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/browser'

export default function DebugAuthPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [verifyInfo, setVerifyInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      setLoading(true)
      
      // Check client-side session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      setSessionInfo({
        session: {
          exists: !!session,
          error: sessionError?.message,
          userId: session?.user?.id,
          email: session?.user?.email,
          expiresAt: session?.expires_at,
        },
        user: {
          exists: !!user,
          error: userError?.message,
          id: user?.id,
          email: user?.email,
        },
        cookies: document.cookie.split(';').map(c => {
          const [name, value] = c.trim().split('=')
          return { name, hasValue: !!value, length: value?.length }
        })
      })
      
      // Verify server-side session
      const response = await fetch('/api/verify-session', {
        cache: 'no-store'
      })
      const data = await response.json()
      setVerifyInfo(data)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        alert(`Sign out error: ${error.message}`)
      } else {
        window.location.href = '/login'
      }
    } catch (err) {
      alert(`Sign out error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug Page</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          Error: {error}
        </div>
      )}
      
      <div className="space-y-6">
        <section className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Client-Side Session</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(sessionInfo, null, 2)}
          </pre>
        </section>
        
        <section className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Server-Side Session (API Verification)</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(verifyInfo, null, 2)}
          </pre>
        </section>
        
        <div className="flex gap-4">
          <button
            onClick={checkSession}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Refresh Session Info
          </button>
          
          <button
            onClick={signOut}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Sign Out
          </button>
          
          <a
            href="/login"
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 inline-block"
          >
            Go to Login
          </a>
          
          <a
            href="/dashboard"
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 inline-block"
          >
            Try Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}