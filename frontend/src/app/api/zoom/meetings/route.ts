import { NextRequest, NextResponse } from 'next/server'

const ZOOM_API_BASE = 'https://api.zoom.us/v2'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')
    
    // Get user ID first
    const userResponse = await fetch(`${ZOOM_API_BASE}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get user info' },
        { status: userResponse.status }
      )
    }

    const userInfo = await userResponse.json()
    const userId = userInfo.id

    // Build query parameters
    const params = new URLSearchParams()
    const type = searchParams.get('type') || 'scheduled'
    const pageSize = searchParams.get('page_size') || '30'
    const pageNumber = searchParams.get('page_number') || '1'
    const nextPageToken = searchParams.get('next_page_token')

    params.append('type', type)
    params.append('page_size', pageSize)
    params.append('page_number', pageNumber)
    if (nextPageToken) params.append('next_page_token', nextPageToken)

    // Get meetings
    const meetingsResponse = await fetch(`${ZOOM_API_BASE}/users/${userId}/meetings?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!meetingsResponse.ok) {
      const error = await meetingsResponse.json()
      return NextResponse.json(
        { error: error.message || 'Failed to get meetings' },
        { status: meetingsResponse.status }
      )
    }

    const meetings = await meetingsResponse.json()
    return NextResponse.json(meetings)
  } catch (error) {
    console.error('Zoom meetings API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')
    const meetingData = await request.json()

    // Get user ID first
    const userResponse = await fetch(`${ZOOM_API_BASE}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get user info' },
        { status: userResponse.status }
      )
    }

    const userInfo = await userResponse.json()
    const userId = userInfo.id

    // Create meeting
    const meetingResponse = await fetch(`${ZOOM_API_BASE}/users/${userId}/meetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(meetingData),
    })

    if (!meetingResponse.ok) {
      const error = await meetingResponse.json()
      return NextResponse.json(
        { error: error.message || 'Failed to create meeting' },
        { status: meetingResponse.status }
      )
    }

    const meeting = await meetingResponse.json()
    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Zoom create meeting error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}