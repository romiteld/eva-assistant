import { NextRequest, NextResponse } from 'next/server'

const ZOOM_API_BASE = 'https://api.zoom.us/v2'

export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')

    // Get waiting room participants
    const response = await fetch(`${ZOOM_API_BASE}/meetings/${params.meetingId}/participants/waiting_room`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.message || 'Failed to get waiting room participants' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Calculate waiting time for each participant
    const now = Date.now()
    const participants = (data.participants || []).map((p: any) => ({
      ...p,
      waiting_time: Math.floor((now - new Date(p.join_time).getTime()) / 1000)
    }))

    return NextResponse.json({ participants })
  } catch (error) {
    console.error('Get waiting room error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}