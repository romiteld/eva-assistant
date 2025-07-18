import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@/types/api'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Test database connection with a simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single()
    
    if (error) {
      // If the table doesn't exist, try a different approach
      const { data: testData, error: testError } = await supabase
        .rpc('version')
        .single()
      
      if (testError) {
        return createErrorResponse(testError.message, 500)
      }
      
      return createSuccessResponse({
        connected: true,
        version: testData || 'Unknown',
        timestamp: new Date().toISOString()
      })
    }
    
    return createSuccessResponse({
      connected: true,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Database health check error:', error)
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown database error',
      500
    )
  }
}