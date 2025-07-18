import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSuccessResponse, createErrorResponse } from '@/types/api'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    
    console.log('[Verify Session] All cookies:', allCookies.map((c: { name: string; value?: string }) => ({ 
      name: c.name, 
      hasValue: !!c.value,
      length: c.value?.length 
    })))
    
    const supabase = createClient()
    
    // Get session
    const { data: { session }, error } = await supabase.auth.getSession()
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // Check auth cookies specifically
    const authCookies = allCookies.filter((c: { name: string; value?: string }) => 
      c.name.includes('auth') || 
      c.name.includes('session') || 
      c.name.includes('sb-')
    )
    
    const response = {
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        error: error?.message,
        userId: session?.user?.id,
        email: session?.user?.email,
        expiresAt: session?.expires_at,
        accessToken: session?.access_token ? 'present' : 'missing',
        refreshToken: session?.refresh_token ? 'present' : 'missing'
      },
      user: {
        exists: !!user,
        error: userError?.message,
        id: user?.id,
        email: user?.email
      },
      cookies: {
        total: allCookies.length,
        authCookies: authCookies.map((c: { name: string; value?: string }) => ({
          name: c.name,
          hasValue: !!c.value,
          length: c.value?.length
        }))
      },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      environment: process.env.NODE_ENV
    }
    
    console.log('[Verify Session] Response:', response)
    
    const resp = createSuccessResponse(response)
    resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    resp.headers.set('Pragma', 'no-cache')
    return resp
  } catch (error) {
    console.error('[Verify Session] Error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
}