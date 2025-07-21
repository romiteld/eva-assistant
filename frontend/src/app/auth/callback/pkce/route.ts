import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${requestUrl.origin}/login?error=${error}`)
  }

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/login?error=no_code`)
  }

  // For PKCE flow, we would need to exchange the code with the code_verifier
  // But since Supabase handles this internally, we'll pass it to Supabase
  
  try {
    const supabase = createClient()
    
    // This won't work directly because Supabase expects its own flow
    // But it shows the PKCE requirement
    
    // SECURITY WARNING: This endpoint should not be used in production
    // Client secrets must never be exposed in client-side code
    // Use the secure /api/auth/microsoft/token endpoint instead
    
    return NextResponse.json({ 
      error: 'This endpoint is deprecated for security reasons',
      message: 'Use /api/auth/microsoft/token for secure token exchange',
      redirect: `${requestUrl.origin}/login?error=deprecated_endpoint`
    }, { status: 410 }) // Gone
    
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(`${requestUrl.origin}/login?error=callback_error`)
  }
}