import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { account_id, client_id, client_secret } = await request.json()

    if (!account_id || !client_id || !client_secret) {
      return NextResponse.json(
        { error: 'Missing required parameters: account_id, client_id, client_secret' },
        { status: 400 }
      )
    }

    // Exchange for Server-to-Server OAuth token
    const tokenResponse = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${account_id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('Zoom Server-to-Server token exchange failed:', error)
      return NextResponse.json(
        { error: 'Failed to get Server-to-Server token' },
        { status: 400 }
      )
    }

    const tokens = await tokenResponse.json()

    return NextResponse.json(tokens)
  } catch (error) {
    console.error('Zoom Server-to-Server token exchange error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}