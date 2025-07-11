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
    
    const tokenUrl = `https://login.microsoftonline.com/29ee1479-b5f7-48c5-b665-7de9a8a9033e/oauth2/v2.0/token`
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: 'bfa77df6-6952-4d0f-9816-003b3101b9da',
        client_secret: 'z.z8Q~KRb~Qek1dewl8OC6wzqjdypY6Xh8hTeamA',
        code: code,
        redirect_uri: 'http://localhost:3000/auth/callback',
        grant_type: 'authorization_code',
        code_verifier: 'stored-in-session', // This would come from sessionStorage
      }),
    })

    const data = await response.json()
    
    if (data.error) {
      console.error('Token exchange error:', data)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=token_exchange_failed`)
    }

    // Now we have the tokens, but we need to create a Supabase session
    // This is where it gets complex because Supabase expects to handle the entire OAuth flow
    
    return NextResponse.json({ 
      message: 'PKCE OAuth successful!', 
      data,
      note: 'This proves Microsoft OAuth works, but Supabase needs to handle the flow'
    })
    
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(`${requestUrl.origin}/login?error=callback_error`)
  }
}