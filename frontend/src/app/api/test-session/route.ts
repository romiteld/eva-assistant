import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Test 1: Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // Test 2: Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // Test 3: Check if we can make authenticated requests
    let profileData = null
    let profileError = null
    
    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      profileData = data
      profileError = error
    }
    
    return createSuccessResponse({
      tests: {
        session: {
          success: !!session && !sessionError,
          data: session ? {
            email: session.user.email,
            id: session.user.id,
            expiresAt: session.expires_at,
            provider: session.user.app_metadata?.provider
          } : null,
          error: sessionError?.message
        },
        user: {
          success: !!user && !userError,
          data: user ? {
            email: user.email,
            id: user.id,
            lastSignIn: user.last_sign_in_at
          } : null,
          error: userError?.message
        },
        profile: {
          success: !!profileData && !profileError,
          data: profileData,
          error: profileError?.message
        }
      },
      summary: {
        authenticated: !!session,
        canAccessDatabase: !!profileData || profileError?.code === 'PGRST116', // PGRST116 = no rows
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    return createErrorResponse(
      'Test failed',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}