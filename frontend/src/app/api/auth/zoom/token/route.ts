import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { code, redirect_uri } = await request.json()

    if (!code || !redirect_uri) {
      return NextResponse.json(
        { error: 'Missing code or redirect_uri' },
        { status: 400 }
      )
    }

    const clientId = process.env.ZOOM_CLIENT_ID
    const clientSecret = process.env.ZOOM_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('Zoom OAuth environment variables missing:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret
      })
      return NextResponse.json(
        { 
          error: 'Zoom OAuth not configured',
          details: 'Server environment variables ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET are required'
        },
        { status: 500 }
      )
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('Zoom token exchange failed:', error)
      return NextResponse.json(
        { error: 'Failed to exchange code for token' },
        { status: 400 }
      )
    }

    const tokens = await tokenResponse.json()

    return NextResponse.json(tokens)
  } catch (error) {
    console.error('Zoom token exchange error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}