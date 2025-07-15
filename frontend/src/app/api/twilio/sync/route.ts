import { NextRequest, NextResponse } from 'next/server'
import { createTwilioService } from '@/lib/services/twilio'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Store active SSE connections
const activeConnections = new Map<string, ReadableStreamDefaultController>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    )
  }
  
  // Create a new ReadableStream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      // Store the connection
      const connectionId = `${userId}-${Date.now()}`
      activeConnections.set(connectionId, controller)
      
      // Send initial connection message
      const encoder = new TextEncoder()
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', connectionId })}\n\n`)
      )
      
      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`)
          )
        } catch (error) {
          // Connection closed, cleanup
          clearInterval(heartbeatInterval)
          activeConnections.delete(connectionId)
        }
      }, 30000)
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        activeConnections.delete(connectionId)
        controller.close()
      })
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

// Broadcast real-time updates to connected clients
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, data } = body
    
    if (!event || !data) {
      return NextResponse.json(
        { error: 'Event and data are required' },
        { status: 400 }
      )
    }
    
    // Broadcast to all active connections
    const encoder = new TextEncoder()
    const message = encoder.encode(`data: ${JSON.stringify({ type: event, data, timestamp: Date.now() })}\n\n`)
    
    let successCount = 0
    let failedCount = 0
    
    activeConnections.forEach((controller, connectionId) => {
      try {
        controller.enqueue(message)
        successCount++
      } catch (error) {
        // Connection is closed, remove it
        activeConnections.delete(connectionId)
        failedCount++
      }
    })
    
    return NextResponse.json({
      success: true,
      broadcast: {
        sent: successCount,
        failed: failedCount,
        active: activeConnections.size
      }
    })
    
  } catch (error) {
    console.error('Broadcast error:', error)
    return NextResponse.json(
      { error: 'Failed to broadcast update' },
      { status: 500 }
    )
  }
}

// Get sync status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    
    switch (action) {
      case 'status':
        return NextResponse.json({
          activeConnections: activeConnections.size,
          connections: Array.from(activeConnections.keys())
        })
        
      case 'clear':
        // Clear all connections
        activeConnections.forEach((controller) => {
          try {
            controller.close()
          } catch (error) {
            // Ignore errors
          }
        })
        activeConnections.clear()
        
        return NextResponse.json({
          success: true,
          message: 'All connections cleared'
        })
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Sync management error:', error)
    return NextResponse.json(
      { error: 'Failed to manage sync' },
      { status: 500 }
    )
  }
}