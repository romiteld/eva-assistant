// WebSocket Handler for Real-time Communication
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebSocketMessage {
  type: 'audio' | 'video' | 'screen' | 'text' | 'command'
  data: any
  timestamp: string
  userId?: string
  sessionId?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req)
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Extract auth token
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    // Verify user
    let userId: string | null = null
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        userId = user.id
      }
    }

    const sessionId = crypto.randomUUID()
    const connectedAt = new Date().toISOString()

    // WebSocket event handlers
    socket.onopen = () => {
      console.log('WebSocket connection opened', { userId, sessionId })
      
      // Send connection confirmation
      socket.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        sessionId,
        timestamp: connectedAt
      }))

      // Log connection in database
      supabase
        .from('websocket_connections')
        .insert({
          user_id: userId,
          session_id: sessionId,
          connected_at: connectedAt,
          status: 'connected'
        })
        .then(({ error }) => {
          if (error) console.error('Error logging connection:', error)
        })
    }

    socket.onmessage = async (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        message.userId = userId
        message.sessionId = sessionId

        console.log('Received message:', message.type)

        // Handle different message types
        switch (message.type) {
          case 'audio':
            await handleAudioStream(message, socket, supabase)
            break
          
          case 'video':
          case 'screen':
            await handleVideoStream(message, socket, supabase)
            break
          
          case 'text':
            await handleTextMessage(message, socket, supabase)
            break
          
          case 'command':
            await handleCommand(message, socket, supabase)
            break
          
          default:
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Unknown message type',
              timestamp: new Date().toISOString()
            }))
        }

        // Log message in database
        await supabase
          .from('websocket_messages')
          .insert({
            session_id: sessionId,
            user_id: userId,
            message_type: message.type,
            timestamp: message.timestamp,
            metadata: message.data
          })

      } catch (error) {
        console.error('Error processing message:', error)
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          error: error.message,
          timestamp: new Date().toISOString()
        }))
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    socket.onclose = async () => {
      console.log('WebSocket connection closed', { userId, sessionId })
      
      // Update connection status
      await supabase
        .from('websocket_connections')
        .update({
          status: 'disconnected',
          disconnected_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
    }

    return response

  } catch (error) {
    console.error('WebSocket upgrade error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to upgrade to WebSocket' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Handle audio streaming (for Gemini Live API)
async function handleAudioStream(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  try {
    // Forward audio to Gemini Live API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!
    
    // Process audio with Gemini Live
    // This would connect to Gemini's WebSocket endpoint
    const geminiResponse = await processWithGeminiLive(message.data, geminiApiKey)
    
    // Send response back
    socket.send(JSON.stringify({
      type: 'audio_response',
      data: geminiResponse,
      timestamp: new Date().toISOString()
    }))

    // Store transcript if available
    if (geminiResponse.transcript) {
      await supabase
        .from('conversations')
        .insert({
          user_id: message.userId,
          content: geminiResponse.transcript,
          role: 'user',
          metadata: { sessionId: message.sessionId }
        })
    }

  } catch (error) {
    console.error('Audio processing error:', error)
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process audio',
      timestamp: new Date().toISOString()
    }))
  }
}

// Handle video/screen sharing
async function handleVideoStream(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  try {
    // Process video frame with Gemini Vision
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!
    
    // Analyze frame
    const analysis = await analyzeVideoFrame(message.data, geminiApiKey)
    
    // Send analysis back
    socket.send(JSON.stringify({
      type: 'video_analysis',
      data: analysis,
      timestamp: new Date().toISOString()
    }))

    // Store significant findings
    if (analysis.significant) {
      await supabase
        .from('video_analyses')
        .insert({
          session_id: message.sessionId,
          user_id: message.userId,
          analysis_type: message.type,
          findings: analysis.findings,
          timestamp: message.timestamp
        })
    }

  } catch (error) {
    console.error('Video processing error:', error)
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process video',
      timestamp: new Date().toISOString()
    }))
  }
}

// Handle text messages
async function handleTextMessage(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  try {
    // Store message
    await supabase
      .from('conversations')
      .insert({
        user_id: message.userId,
        content: message.data.text,
        role: 'user',
        metadata: { sessionId: message.sessionId }
      })

    // Process with appropriate agent
    const response = await processWithAgent(message.data, message.userId, supabase)
    
    // Send response
    socket.send(JSON.stringify({
      type: 'text_response',
      data: response,
      timestamp: new Date().toISOString()
    }))

    // Store assistant response
    await supabase
      .from('conversations')
      .insert({
        user_id: message.userId,
        content: response.text,
        role: 'assistant',
        metadata: { 
          sessionId: message.sessionId,
          agent: response.agent
        }
      })

  } catch (error) {
    console.error('Text processing error:', error)
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process text',
      timestamp: new Date().toISOString()
    }))
  }
}

// Handle commands (actions)
async function handleCommand(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  try {
    const { command, params } = message.data
    
    let result: any
    
    switch (command) {
      case 'schedule_meeting':
        result = await scheduleMeeting(params, message.userId, supabase)
        break
      
      case 'send_email':
        result = await sendEmail(params, message.userId, supabase)
        break
      
      case 'search_candidates':
        result = await searchCandidates(params, message.userId, supabase)
        break
      
      case 'update_crm':
        result = await updateCRM(params, message.userId, supabase)
        break
      
      default:
        throw new Error(`Unknown command: ${command}`)
    }

    socket.send(JSON.stringify({
      type: 'command_result',
      command,
      result,
      timestamp: new Date().toISOString()
    }))

    // Log command execution
    await supabase
      .from('command_logs')
      .insert({
        user_id: message.userId,
        session_id: message.sessionId,
        command,
        params,
        result,
        executed_at: new Date().toISOString()
      })

  } catch (error) {
    console.error('Command execution error:', error)
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to execute command',
      error: error.message,
      timestamp: new Date().toISOString()
    }))
  }
}

// Helper functions (stubs for actual implementations)
async function processWithGeminiLive(audioData: any, apiKey: string) {
  // Implement Gemini Live API integration
  return {
    transcript: 'Transcribed text...',
    response: 'AI response...',
    confidence: 0.95
  }
}

async function analyzeVideoFrame(frameData: any, apiKey: string) {
  // Implement Gemini Vision API integration
  return {
    significant: true,
    findings: {
      objects: [],
      text: [],
      activities: []
    }
  }
}

async function processWithAgent(data: any, userId: string, supabase: any) {
  // Route to appropriate agent based on intent
  return {
    text: 'Agent response...',
    agent: 'general',
    actions: []
  }
}

async function scheduleMeeting(params: any, userId: string, supabase: any) {
  // Implement Zoom integration
  return { success: true, meetingId: 'zoom-123' }
}

async function sendEmail(params: any, userId: string, supabase: any) {
  // Implement Outlook integration
  return { success: true, messageId: 'email-123' }
}

async function searchCandidates(params: any, userId: string, supabase: any) {
  // Implement candidate search
  return { candidates: [] }
}

async function updateCRM(params: any, userId: string, supabase: any) {
  // Implement Zoho CRM update
  return { success: true, recordId: 'crm-123' }
}