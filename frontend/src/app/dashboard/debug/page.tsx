import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export default async function DebugPage() {
  const supabase = createClient()
  
  // Get session
  const { data: { session }, error } = await supabase.auth.getSession()
  
  // Get all cookies
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()
  
  // Filter for auth-related cookies
  const authCookies = allCookies.filter(c => 
    c.name.includes('auth-token') || 
    c.name.includes('refresh-token') ||
    c.name.includes('sb-') ||
    c.name.includes('supabase')
  )
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Auth Debug Info</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold">Session Status</h2>
          <pre className="mt-2 text-sm">
            {JSON.stringify({
              hasSession: !!session,
              sessionError: error?.message || null,
              user: session?.user?.email || null,
              userId: session?.user?.id || null,
              expiresAt: session?.expires_at || null,
            }, null, 2)}
          </pre>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold">Auth Cookies ({authCookies.length})</h2>
          <pre className="mt-2 text-sm">
            {JSON.stringify(authCookies.map(c => ({
              name: c.name,
              value: c.value ? '***' : 'empty',
            })), null, 2)}
          </pre>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold">All Cookies ({allCookies.length})</h2>
          <pre className="mt-2 text-sm">
            {JSON.stringify(allCookies.map((c: any) => c.name), null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}