import { NextRequest, NextResponse } from 'next/server'

const ZOOM_API_BASE = 'https://api.zoom.us/v2'

// GET /api/zoom/meetings/[meetingId] - Get meeting details
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

    // Get meeting details from Zoom
    const response = await fetch(`${ZOOM_API_BASE}/meetings/${params.meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.message || 'Failed to get meeting' },
        { status: response.status }
      )
    }

    const meeting = await response.json()
    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Get meeting error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/zoom/meetings/[meetingId] - Update meeting
export async function PATCH(
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
    const updates = await request.json()

    // Update meeting in Zoom
    const response = await fetch(`${ZOOM_API_BASE}/meetings/${params.meetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.message || 'Failed to update meeting' },
        { status: response.status }
      )
    }

    // Zoom API returns 204 No Content on successful update
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update meeting error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/zoom/meetings/[meetingId] - Delete meeting
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

    // Delete meeting in Zoom
    const response = await fetch(`${ZOOM_API_BASE}/meetings/${params.meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.message || 'Failed to delete meeting' },
        { status: response.status }
      )
    }

    // Zoom API returns 204 No Content on successful delete
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete meeting error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}