import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const upgrade = req.headers.get('upgrade') || ''
  
  if (upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket connection', { 
      status: 400,
      headers: corsHeaders 
    })
  }

  const { socket, response } = Deno.upgradeWebSocket(req)
  
  // Initialize Supabase client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Track active connections
  const connections = new Map<string, WebSocket>()
  const connectionId = crypto.randomUUID()

  socket.onopen = () => {
    console.log(`WebSocket connection opened: ${connectionId}`)
    connections.set(connectionId, socket)
  }

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data)
      
      // Handle different message types
      switch (data.type) {
        case 'stream-frame':
          await handleStreamFrame(data.payload, supabaseClient)
          break
          
        case 'join-room':
          await joinRoom(data.payload, connectionId, supabaseClient)
          break
          
        case 'leave-room':
          await leaveRoom(data.payload, connectionId, supabaseClient)
          break
          
        case 'signal':
          await relaySignal(data.payload, connections)
          break
          
        default:
          // Broadcast to other clients via Supabase Realtime
          await supabaseClient
            .channel('stream-relay')
            .send({
              type: 'broadcast',
              event: 'relay-data',
              payload: data
            })
      }
    } catch (error) {
      console.error('Error processing message:', error)
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }))
    }
  }

  socket.onclose = () => {
    console.log(`WebSocket connection closed: ${connectionId}`)
    connections.delete(connectionId)
  }

  socket.onerror = (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error)
  }

  return response
})

async function handleStreamFrame(frame: any, supabase: any) {
  // Process video/audio frame
  // This could include:
  // - Forwarding to AI services for analysis
  // - Compressing/optimizing the data
  // - Recording to storage if needed
  
  // For now, just log
  console.log('Processing stream frame:', frame.timestamp)
}

async function joinRoom(payload: any, connectionId: string, supabase: any) {
  const { roomId, userId, role } = payload
  
  try {
    // Record participant joining
    await supabase
      .from('stream_participants')
      .upsert({
        session_id: roomId,
        user_id: userId,
        peer_id: connectionId,
        role: role || 'participant',
        joined_at: new Date().toISOString(),
      })
      
    console.log(`User ${userId} joined room ${roomId}`)
  } catch (error) {
    console.error('Error joining room:', error)
  }
}

async function leaveRoom(payload: any, connectionId: string, supabase: any) {
  const { roomId, userId } = payload
  
  try {
    // Update participant left time
    await supabase
      .from('stream_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('session_id', roomId)
      .eq('peer_id', connectionId)
      
    console.log(`User ${userId} left room ${roomId}`)
  } catch (error) {
    console.error('Error leaving room:', error)
  }
}

async function relaySignal(payload: any, connections: Map<string, WebSocket>) {
  const { targetId, signal } = payload
  
  // Relay WebRTC signaling to specific peer
  const targetSocket = connections.get(targetId)
  if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
    targetSocket.send(JSON.stringify({
      type: 'signal',
      payload: signal
    }))
  }
}