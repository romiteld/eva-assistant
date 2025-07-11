import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSuccessResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  
  // Get session
  const { data: { session }, error } = await supabase.auth.getSession()
  
  // Get all cookies
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()
  
  // Check for auth cookies
  const authCookies = allCookies.filter((c: { name: string; value?: string }) => 
    c.name.includes('auth-token') || 
    c.name.includes('refresh-token') ||
    c.name.includes('sb-')
  )
  
  return createSuccessResponse({
    hasSession: !!session,
    sessionError: error?.message || null,
    user: session?.user?.email || null,
    userId: session?.user?.id || null,
    expiresAt: session?.expires_at || null,
    cookieCount: allCookies.length,
    authCookies: authCookies.map((c: { name: string; value?: string }) => ({ name: c.name, hasValue: !!c.value })),
    timestamp: new Date().toISOString()
  })
}