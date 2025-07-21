import { NextRequest, NextResponse } from 'next/server'

const ZOOM_REVOKE_URL = 'https://zoom.us/oauth/revoke'

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
    const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID
    const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET
    
    if (!ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
      console.error('Zoom OAuth environment variables missing:', {
        hasClientId: !!ZOOM_CLIENT_ID,
        hasClientSecret: !!ZOOM_CLIENT_SECRET
      })
      return NextResponse.json(
        { 
          error: 'Zoom OAuth not configured',
          details: 'Server environment variables ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET are required'
        },
        { status: 500 }
      )
    }
    const { token } = await request.json()
    
    if (!token) {
      return NextResponse.json(
        { error: 'token is required' },
        { status: 400 }
      )
    }

    // Revoke the token
    const response = await fetch(ZOOM_REVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        token: token,
      }).toString()
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Failed to revoke Zoom token:', error)
      return NextResponse.json(
        { error: 'Failed to revoke token' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error revoking Zoom token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}