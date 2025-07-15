import { NextRequest, NextResponse } from 'next/server'

const ZOOM_API_BASE = 'https://api.zoom.us/v2'

export async function POST(
  request: NextRequest,
  { params }: { params: { meetingId: string; participantId: string } }
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

    // Deny/remove participant from waiting room
    const response = await fetch(
      `${ZOOM_API_BASE}/meetings/${params.meetingId}/participants/${params.participantId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.message || 'Failed to deny participant' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Deny participant error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}