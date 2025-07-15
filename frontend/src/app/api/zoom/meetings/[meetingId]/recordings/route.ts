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

    // Get meeting recordings from Zoom
    const response = await fetch(`${ZOOM_API_BASE}/meetings/${params.meetingId}/recordings`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.message || 'Failed to get recordings' },
        { status: response.status }
      )
    }

    const recordings = await response.json()
    return NextResponse.json(recordings)
  } catch (error) {
    console.error('Get recordings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/zoom/meetings/[meetingId]/recordings - Delete all recordings
export async function DELETE(
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

    // Delete meeting recordings from Zoom
    const response = await fetch(`${ZOOM_API_BASE}/meetings/${params.meetingId}/recordings`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.message || 'Failed to delete recordings' },
        { status: response.status }
      )
    }

    // Zoom API returns 204 No Content on successful delete
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete recordings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}