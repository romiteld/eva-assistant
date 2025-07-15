import { NextRequest, NextResponse } from 'next/server'

const ZOOM_API_BASE = 'https://api.zoom.us/v2'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const meetingId = params.id

    // Get meeting details
    const meetingResponse = await fetch(`${ZOOM_API_BASE}/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!meetingResponse.ok) {
      const error = await meetingResponse.json()
      return NextResponse.json(
        { error: error.message || 'Failed to get meeting' },
        { status: meetingResponse.status }
      )
    }

    const meeting = await meetingResponse.json()
    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Zoom get meeting error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const meetingId = params.id
    const updates = await request.json()

    // Update meeting
    const meetingResponse = await fetch(`${ZOOM_API_BASE}/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!meetingResponse.ok) {
      const error = await meetingResponse.json()
      return NextResponse.json(
        { error: error.message || 'Failed to update meeting' },
        { status: meetingResponse.status }
      )
    }

    // Return success response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Zoom update meeting error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const meetingId = params.id

    // Delete meeting
    const meetingResponse = await fetch(`${ZOOM_API_BASE}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!meetingResponse.ok) {
      const error = await meetingResponse.json()
      return NextResponse.json(
        { error: error.message || 'Failed to delete meeting' },
        { status: meetingResponse.status }
      )
    }

    // Return success response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Zoom delete meeting error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}