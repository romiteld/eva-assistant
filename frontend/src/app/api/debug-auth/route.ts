import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { createSuccessResponse, createErrorResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const cookieStore = cookies()
    
    // Get all Supabase-related cookies
    const allCookies = cookieStore.getAll()
    const supabaseCookies = allCookies.filter(c => 
      c.name.includes('supabase') || 
      c.name.includes('auth-token') ||
      c.name.includes('sb-')
    )
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // Get user if session exists
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    return createSuccessResponse({
      debug: {
        hasSession: !!session,
        hasUser: !!user,
        sessionError: sessionError?.message || null,
        userError: userError?.message || null,
        supabaseCookies: supabaseCookies.map(c => ({
          name: c.name,
          hasValue: !!c.value,
          length: c.value?.length || 0
        })),
        allCookiesCount: allCookies.length,
        sessionDetails: session ? {
          userId: session.user.id,
          email: session.user.email,
          expiresAt: session.expires_at,
          tokenType: session.token_type,
          hasAccessToken: !!session.access_token,
          hasRefreshToken: !!session.refresh_token
        } : null,
        env: {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        },
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    return createErrorResponse(
      'Debug route error',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}