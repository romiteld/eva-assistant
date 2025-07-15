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

    // Get meeting participants from Zoom
    const response = await fetch(`${ZOOM_API_BASE}/past_meetings/${params.meetingId}/participants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      // If it's a live meeting, try the live endpoint
      if (response.status === 404) {
        const liveResponse = await fetch(`${ZOOM_API_BASE}/metrics/meetings/${params.meetingId}/participants`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (!liveResponse.ok) {
          const error = await liveResponse.json()
          return NextResponse.json(
            { error: error.message || 'Failed to get participants' },
            { status: liveResponse.status }
          )
        }

        const participants = await liveResponse.json()
        return NextResponse.json(participants)
      }

      const error = await response.json()
      return NextResponse.json(
        { error: error.message || 'Failed to get participants' },
        { status: response.status }
      )
    }

    const participants = await response.json()
    return NextResponse.json(participants)
  } catch (error) {
    console.error('Get participants error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}