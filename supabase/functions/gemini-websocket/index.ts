import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req: Request) => {
  try {
    // Extract model and token from query params
    const url = new URL(req.url)
    const model = url.searchParams.get('model') || 'gemini-2.0-flash-exp'
    const token = url.searchParams.get('token')
    
    if (!token) {
      return new Response('Missing authentication token', { status: 401 })
    }

    // Create Supabase client to verify JWT
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return new Response('Invalid authentication token', { status: 401 })
    }


    // Check if this is a WebSocket upgrade request
    if (req.headers.get('upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 400 })
    }

    // Create WebSocket upgrade
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req)
    
    // Connect to Gemini WebSocket using the correct endpoint for Live API
    // Use v1alpha endpoint with proper streaming format for Gemini Live
    const geminiUrl = `wss://generativelanguage.googleapis.com/v1alpha/models/${model}:streamGenerateContent?key=${GEMINI_API_KEY}`
    const geminiSocket = new WebSocket(geminiUrl)
    
    let geminiConnected = false

    // Handle Gemini connection
    geminiSocket.onopen = () => {
      console.log('Connected to Gemini WebSocket')
      geminiConnected = true
      // Don't send any setup message here - let the client send its own
    }

    // Relay messages from client to Gemini
    clientSocket.onmessage = (event) => {
      if (geminiConnected && geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(event.data)
      }
    }

    // Relay messages from Gemini to client
    geminiSocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data)
      }
    }

    // Handle client disconnect
    clientSocket.onclose = () => {
      console.log('Client disconnected')
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.close()
      }
    }

    // Handle Gemini disconnect
    geminiSocket.onclose = () => {
      console.log('Gemini disconnected')
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close()
      }
    }

    // Handle errors
    clientSocket.onerror = (error) => {
      console.error('Client WebSocket error:', error)
      geminiSocket.close()
    }

    geminiSocket.onerror = (error) => {
      console.error('Gemini WebSocket error:', error)
      clientSocket.close()
    }

    return response
  } catch (error) {
    console.error('WebSocket proxy error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})