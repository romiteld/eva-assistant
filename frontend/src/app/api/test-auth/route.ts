import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSuccessResponse, createErrorResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Test if we can get the session
    const { data: { session }, error } = await supabase.auth.getSession()
    
    return createSuccessResponse({
      hasSession: !!session,
      sessionError: error?.message || null,
      user: session?.user?.email || null,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      callbackUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return createErrorResponse(
      'Failed to test auth',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}