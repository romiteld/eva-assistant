// Enhanced Real-time Stream Handler for WebSocket Communication
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.23.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)

// Rate limiting for WebSocket connections
const CONNECTION_LIMITS = {
  maxConnectionsPerUser: 5,
  maxMessagesPerMinute: 60,
  maxDataSizePerMessage: 5 * 1024 * 1024, // 5MB
}

// Active connections tracking
const activeConnections = new Map<string, Set<WebSocket>>()
const messageRateLimits = new Map<string, { count: number; resetTime: number }>()

// Connection pool for external services
const serviceConnections = {
  geminiLive: null as WebSocket | null,
}

// Message queue for reliability
const messageQueue = new Map<string, Array<any>>()

interface WebSocketMessage {
  type: 'audio' | 'video' | 'screen' | 'text' | 'command' | 'heartbeat'
  data: any
  timestamp: string
  userId?: string
  sessionId?: string
  messageId?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Check if request is WebSocket upgrade
  const upgrade = req.headers.get('upgrade')
  if (upgrade !== 'websocket') {
    return new Response('Expected WebSocket upgrade request', { 
      status: 426,
      headers: corsHeaders 
    })
  }

  const requestId = crypto.randomUUID()

  try {
    // Extract auth token
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return new Response('Authentication required', { 
        status: 401,
        headers: corsHeaders 
      })
    }

    // Initialize Supabase and verify user
    const supabase = await initializeSupabase()
    const { userId, error: authError } = await authenticateUser(supabase, token)
    
    if (authError || !userId) {
      return new Response('Invalid authentication token', { 
        status: 401,
        headers: corsHeaders 
      })
    }

    // Check connection limits
    if (!checkConnectionLimit(userId)) {
      return new Response('Connection limit exceeded', { 
        status: 429,
        headers: corsHeaders 
      })
    }

    // Upgrade to WebSocket
    const { socket, response } = Deno.upgradeWebSocket(req)
    
    // Initialize session
    const sessionId = crypto.randomUUID()
    const connectedAt = new Date().toISOString()

    // Set up WebSocket handlers
    setupWebSocketHandlers(socket, userId, sessionId, supabase)

    // Track connection
    trackConnection(userId, socket)

    // Log connection
    await logConnection(supabase, userId, sessionId, connectedAt)

    return response

  } catch (error) {
    console.error(`[${requestId}] WebSocket upgrade error:`, error)
    return new Response(
      JSON.stringify({ error: 'Failed to establish WebSocket connection' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Set up WebSocket event handlers
function setupWebSocketHandlers(
  socket: WebSocket,
  userId: string,
  sessionId: string,
  supabase: any
) {
  // Connection opened
  socket.onopen = () => {
    console.log(`WebSocket opened: ${sessionId}`)
    
    // Send connection confirmation
    sendMessage(socket, {
      type: 'connection',
      status: 'connected',
      sessionId,
      timestamp: new Date().toISOString(),
      capabilities: {
        audio: true,
        video: true,
        screen: true,
        commands: true,
        maxMessageSize: CONNECTION_LIMITS.maxDataSizePerMessage,
      }
    })

    // Start heartbeat
    startHeartbeat(socket, sessionId)
  }

  // Message received
  socket.onmessage = async (event) => {
    try {
      // Check rate limits
      if (!checkMessageRateLimit(userId)) {
        sendError(socket, 'Rate limit exceeded', 'RATE_LIMIT')
        return
      }

      // Parse and validate message
      const message = await parseAndValidateMessage(event.data, userId, sessionId)
      
      if (!message) {
        sendError(socket, 'Invalid message format', 'INVALID_MESSAGE')
        return
      }

      // Process message based on type
      await processMessage(message, socket, supabase)

      // Log message
      await logMessage(supabase, message)

    } catch (error) {
      console.error(`[${sessionId}] Message processing error:`, error)
      sendError(socket, 'Failed to process message', 'PROCESSING_ERROR', error)
    }
  }

  // Error occurred
  socket.onerror = (error) => {
    console.error(`[${sessionId}] WebSocket error:`, error)
  }

  // Connection closed
  socket.onclose = async (event) => {
    console.log(`WebSocket closed: ${sessionId}`, event.code, event.reason)
    
    // Clean up
    cleanupConnection(userId, socket, sessionId)
    
    // Update connection status
    await updateConnectionStatus(supabase, sessionId, 'disconnected')
  }
}

// Process different message types
async function processMessage(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  const handlers = {
    audio: handleAudioStream,
    video: handleVideoStream,
    screen: handleScreenShare,
    text: handleTextMessage,
    command: handleCommand,
    heartbeat: handleHeartbeat,
  }

  const handler = handlers[message.type]
  if (!handler) {
    throw new Error(`Unknown message type: ${message.type}`)
  }

  await handler(message, socket, supabase)
}

// Enhanced audio streaming handler
async function handleAudioStream(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  try {
    const { audioData, format, sampleRate } = message.data
    
    // Validate audio data
    if (!audioData || !format) {
      throw new Error('Invalid audio data')
    }

    // Process with Gemini Live API (when available)
    const response = await processAudioWithGemini(audioData, format, sampleRate)
    
    // Send response
    sendMessage(socket, {
      type: 'audio_response',
      messageId: message.messageId,
      data: response,
      timestamp: new Date().toISOString()
    })

    // Store transcript if available
    if (response.transcript) {
      await storeTranscript(supabase, message.userId!, message.sessionId!, response.transcript)
    }

  } catch (error) {
    console.error('Audio processing error:', error)
    sendError(socket, 'Failed to process audio', 'AUDIO_ERROR', error)
  }
}

// Enhanced video/screen sharing handler
async function handleVideoStream(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  try {
    const { frameData, format, resolution } = message.data
    
    // Validate video data
    if (!frameData || !format) {
      throw new Error('Invalid video data')
    }

    // Analyze frame with Gemini Vision
    const analysis = await analyzeVideoFrame(frameData, format, resolution)
    
    // Send analysis
    sendMessage(socket, {
      type: 'video_analysis',
      messageId: message.messageId,
      data: analysis,
      timestamp: new Date().toISOString()
    })

    // Store significant findings
    if (analysis.significant) {
      await storeVideoAnalysis(supabase, message.sessionId!, analysis)
    }

  } catch (error) {
    console.error('Video processing error:', error)
    sendError(socket, 'Failed to process video', 'VIDEO_ERROR', error)
  }
}

// Screen share handler
async function handleScreenShare(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  // Similar to video but with screen-specific processing
  return handleVideoStream(message, socket, supabase)
}

// Enhanced text message handler
async function handleTextMessage(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  try {
    const { text, conversationId, context } = message.data
    
    if (!text) {
      throw new Error('No text content provided')
    }

    // Store user message
    const userMessageId = await storeMessage(
      supabase,
      message.userId!,
      conversationId,
      'user',
      text
    )

    // Process with appropriate agent
    const agentResponse = await processWithAgent(text, context, message.userId!, supabase)
    
    // Send response
    sendMessage(socket, {
      type: 'text_response',
      messageId: message.messageId,
      data: agentResponse,
      timestamp: new Date().toISOString()
    })

    // Store assistant response
    await storeMessage(
      supabase,
      message.userId!,
      conversationId,
      'assistant',
      agentResponse.text,
      { agent: agentResponse.agent }
    )

    // Execute any actions
    if (agentResponse.actions && agentResponse.actions.length > 0) {
      await executeActions(agentResponse.actions, message.userId!, socket, supabase)
    }

  } catch (error) {
    console.error('Text processing error:', error)
    sendError(socket, 'Failed to process text', 'TEXT_ERROR', error)
  }
}

// Enhanced command handler
async function handleCommand(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  try {
    const { command, params } = message.data
    
    if (!command) {
      throw new Error('No command specified')
    }

    // Validate command
    const validCommands = [
      'schedule_meeting',
      'send_email',
      'search_candidates',
      'update_crm',
      'create_task',
      'generate_report',
      'analyze_data',
    ]

    if (!validCommands.includes(command)) {
      throw new Error(`Invalid command: ${command}`)
    }

    // Execute command with retry
    const result = await executeCommandWithRetry(command, params, message.userId!, supabase)
    
    // Send result
    sendMessage(socket, {
      type: 'command_result',
      messageId: message.messageId,
      command,
      result,
      timestamp: new Date().toISOString()
    })

    // Log command execution
    await logCommandExecution(supabase, message.userId!, message.sessionId!, command, result)

  } catch (error) {
    console.error('Command execution error:', error)
    sendError(socket, 'Failed to execute command', 'COMMAND_ERROR', error)
  }
}

// Heartbeat handler
async function handleHeartbeat(
  message: WebSocketMessage,
  socket: WebSocket,
  supabase: any
) {
  sendMessage(socket, {
    type: 'heartbeat',
    messageId: message.messageId,
    timestamp: new Date().toISOString()
  })
}

// Process audio with Gemini (placeholder for actual implementation)
async function processAudioWithGemini(
  audioData: ArrayBuffer,
  format: string,
  sampleRate: number
): Promise<any> {
  // When Gemini Live API is available, implement real-time audio processing
  // For now, return a simulated response
  return {
    transcript: 'Simulated transcript of audio input',
    response: 'Simulated AI response to audio',
    confidence: 0.95,
    language: 'en',
  }
}

// Analyze video frame with Gemini Vision
async function analyzeVideoFrame(
  frameData: string,
  format: string,
  resolution: string
): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
    
    const prompt = `Analyze this image and identify:
1. Main objects and their positions
2. Any text visible in the image
3. Activities or actions taking place
4. Overall context and scene description`

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: frameData, mimeType: format } }
    ])

    const analysis = result.response.text()
    
    // Parse analysis to determine significance
    const significant = analysis.toLowerCase().includes('important') ||
                       analysis.toLowerCase().includes('significant') ||
                       analysis.toLowerCase().includes('critical')

    return {
      significant,
      analysis,
      findings: {
        objects: extractObjects(analysis),
        text: extractText(analysis),
        activities: extractActivities(analysis),
        context: analysis,
      }
    }
  } catch (error) {
    console.error('Frame analysis error:', error)
    return {
      significant: false,
      error: error.message,
    }
  }
}

// Process text with appropriate agent
async function processWithAgent(
  text: string,
  context: any,
  userId: string,
  supabase: any
): Promise<any> {
  // Determine intent and route to appropriate agent
  const intent = await determineIntent(text)
  
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 1024,
    }
  })

  const systemPrompt = `You are EVA (Executive Virtual Assistant), helping with ${intent} tasks.
Provide helpful, actionable responses and suggest relevant commands when appropriate.`

  const result = await model.generateContent(`${systemPrompt}\n\nUser: ${text}`)
  const response = result.response.text()

  // Extract any suggested actions
  const actions = extractActions(response)

  return {
    text: response,
    agent: intent,
    actions,
    confidence: 0.9,
  }
}

// Command execution with retry
async function executeCommandWithRetry(
  command: string,
  params: any,
  userId: string,
  supabase: any,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeCommand(command, params, userId, supabase)
    } catch (error) {
      lastError = error
      console.error(`Command execution attempt ${attempt + 1} failed:`, error)
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
  }
  
  throw lastError!
}

// Execute specific commands
async function executeCommand(
  command: string,
  params: any,
  userId: string,
  supabase: any
): Promise<any> {
  const commandHandlers: Record<string, Function> = {
    schedule_meeting: scheduleMeeting,
    send_email: sendEmail,
    search_candidates: searchCandidates,
    update_crm: updateCRM,
    create_task: createTask,
    generate_report: generateReport,
    analyze_data: analyzeData,
  }

  const handler = commandHandlers[command]
  if (!handler) {
    throw new Error(`No handler for command: ${command}`)
  }

  return await handler(params, userId, supabase)
}

// Helper functions

async function initializeSupabase() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function authenticateUser(supabase: any, token: string): Promise<{ userId: string | null; error: any }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    return { userId: user?.id || null, error }
  } catch (error) {
    return { userId: null, error }
  }
}

function checkConnectionLimit(userId: string): boolean {
  const userConnections = activeConnections.get(userId) || new Set()
  return userConnections.size < CONNECTION_LIMITS.maxConnectionsPerUser
}

function checkMessageRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = messageRateLimits.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    messageRateLimits.set(userId, {
      count: 1,
      resetTime: now + 60000, // 1 minute
    })
    return true
  }
  
  if (userLimit.count >= CONNECTION_LIMITS.maxMessagesPerMinute) {
    return false
  }
  
  userLimit.count++
  return true
}

function trackConnection(userId: string, socket: WebSocket) {
  if (!activeConnections.has(userId)) {
    activeConnections.set(userId, new Set())
  }
  activeConnections.get(userId)!.add(socket)
}

function cleanupConnection(userId: string, socket: WebSocket, sessionId: string) {
  const userConnections = activeConnections.get(userId)
  if (userConnections) {
    userConnections.delete(socket)
    if (userConnections.size === 0) {
      activeConnections.delete(userId)
    }
  }
  
  // Clear message queue for session
  messageQueue.delete(sessionId)
}

async function parseAndValidateMessage(
  data: any,
  userId: string,
  sessionId: string
): Promise<WebSocketMessage | null> {
  try {
    const message = typeof data === 'string' ? JSON.parse(data) : data
    
    // Validate required fields
    if (!message.type || !message.data) {
      return null
    }
    
    // Check message size
    const messageSize = new Blob([JSON.stringify(message)]).size
    if (messageSize > CONNECTION_LIMITS.maxDataSizePerMessage) {
      throw new Error('Message size exceeds limit')
    }
    
    // Add metadata
    message.userId = userId
    message.sessionId = sessionId
    message.messageId = message.messageId || crypto.randomUUID()
    message.timestamp = message.timestamp || new Date().toISOString()
    
    return message as WebSocketMessage
  } catch (error) {
    console.error('Message parsing error:', error)
    return null
  }
}

function sendMessage(socket: WebSocket, message: any) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

function sendError(socket: WebSocket, message: string, code: string, error?: any) {
  sendMessage(socket, {
    type: 'error',
    error: {
      message,
      code,
      details: error?.message,
    },
    timestamp: new Date().toISOString()
  })
}

function startHeartbeat(socket: WebSocket, sessionId: string) {
  const interval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      sendMessage(socket, {
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      })
    } else {
      clearInterval(interval)
    }
  }, 30000) // 30 seconds
}

// Database operations
async function logConnection(supabase: any, userId: string, sessionId: string, connectedAt: string) {
  await supabase
    .from('websocket_connections')
    .insert({
      user_id: userId,
      session_id: sessionId,
      connected_at: connectedAt,
      status: 'connected'
    })
}

async function updateConnectionStatus(supabase: any, sessionId: string, status: string) {
  await supabase
    .from('websocket_connections')
    .update({
      status,
      disconnected_at: status === 'disconnected' ? new Date().toISOString() : null
    })
    .eq('session_id', sessionId)
}

async function logMessage(supabase: any, message: WebSocketMessage) {
  await supabase
    .from('websocket_messages')
    .insert({
      session_id: message.sessionId,
      user_id: message.userId,
      message_type: message.type,
      message_id: message.messageId,
      timestamp: message.timestamp,
      metadata: message.data
    })
}

async function storeMessage(
  supabase: any,
  userId: string,
  conversationId: string | undefined,
  role: string,
  content: string,
  metadata?: any
): Promise<string> {
  // Create conversation if needed
  if (!conversationId) {
    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: content.substring(0, 50) + '...',
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    conversationId = conversation?.id
  }

  const { data } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata,
    })
    .select()
    .single()

  return data?.id
}

async function storeTranscript(supabase: any, userId: string, sessionId: string, transcript: string) {
  await supabase
    .from('audio_transcripts')
    .insert({
      user_id: userId,
      session_id: sessionId,
      transcript,
      created_at: new Date().toISOString()
    })
}

async function storeVideoAnalysis(supabase: any, sessionId: string, analysis: any) {
  await supabase
    .from('video_analyses')
    .insert({
      session_id: sessionId,
      analysis_type: 'frame',
      findings: analysis.findings,
      significant: analysis.significant,
      created_at: new Date().toISOString()
    })
}

async function logCommandExecution(
  supabase: any,
  userId: string,
  sessionId: string,
  command: string,
  result: any
) {
  await supabase
    .from('command_logs')
    .insert({
      user_id: userId,
      session_id: sessionId,
      command,
      result,
      executed_at: new Date().toISOString()
    })
}

// Utility functions
async function determineIntent(text: string): Promise<string> {
  const intents = {
    scheduling: ['meeting', 'schedule', 'calendar', 'appointment'],
    email: ['email', 'send', 'message', 'reply'],
    recruitment: ['candidate', 'recruit', 'hire', 'interview'],
    crm: ['crm', 'contact', 'deal', 'opportunity'],
    task: ['task', 'todo', 'reminder', 'deadline'],
    analysis: ['analyze', 'report', 'data', 'insights'],
  }

  const lowerText = text.toLowerCase()
  
  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return intent
    }
  }
  
  return 'general'
}

function extractActions(response: string): any[] {
  // Extract suggested actions from AI response
  const actions = []
  
  // Look for command patterns
  const commandPattern = /\[command:(\w+)(?:\(([^)]*)\))?\]/g
  let match
  
  while ((match = commandPattern.exec(response)) !== null) {
    actions.push({
      command: match[1],
      params: match[2] ? JSON.parse(match[2]) : {}
    })
  }
  
  return actions
}

function extractObjects(analysis: string): string[] {
  // Simple extraction - in production, use more sophisticated NLP
  const objects = []
  const lines = analysis.split('\n')
  
  for (const line of lines) {
    if (line.toLowerCase().includes('object') || line.toLowerCase().includes('item')) {
      objects.push(line.trim())
    }
  }
  
  return objects
}

function extractText(analysis: string): string[] {
  // Extract text mentions from analysis
  const textMentions = []
  const textPattern = /"([^"]+)"/g
  let match
  
  while ((match = textPattern.exec(analysis)) !== null) {
    textMentions.push(match[1])
  }
  
  return textMentions
}

function extractActivities(analysis: string): string[] {
  // Extract activities from analysis
  const activities = []
  const activityKeywords = ['moving', 'standing', 'sitting', 'walking', 'typing', 'presenting']
  
  const lowerAnalysis = analysis.toLowerCase()
  for (const keyword of activityKeywords) {
    if (lowerAnalysis.includes(keyword)) {
      activities.push(keyword)
    }
  }
  
  return activities
}

async function executeActions(actions: any[], userId: string, socket: WebSocket, supabase: any) {
  for (const action of actions) {
    try {
      const result = await executeCommand(action.command, action.params, userId, supabase)
      
      sendMessage(socket, {
        type: 'action_result',
        action: action.command,
        result,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Action execution error:', error)
      sendError(socket, `Failed to execute action: ${action.command}`, 'ACTION_ERROR', error)
    }
  }
}

// Command implementations (placeholders)
async function scheduleMeeting(params: any, userId: string, supabase: any) {
  // Implement Zoom/Calendar integration
  return { 
    success: true, 
    meetingId: crypto.randomUUID(),
    meetingUrl: 'https://zoom.us/j/123456789',
    scheduledAt: params.dateTime 
  }
}

async function sendEmail(params: any, userId: string, supabase: any) {
  // Implement email integration
  return { 
    success: true, 
    messageId: crypto.randomUUID(),
    sentAt: new Date().toISOString() 
  }
}

async function searchCandidates(params: any, userId: string, supabase: any) {
  // Implement candidate search
  const { data: candidates } = await supabase
    .from('candidates')
    .select('*')
    .match(params.filters || {})
    .limit(10)
  
  return { 
    success: true, 
    candidates: candidates || [],
    count: candidates?.length || 0 
  }
}

async function updateCRM(params: any, userId: string, supabase: any) {
  // Implement CRM update
  return { 
    success: true, 
    recordId: params.recordId,
    updatedFields: params.updates 
  }
}

async function createTask(params: any, userId: string, supabase: any) {
  const { data: task } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: params.title,
      description: params.description,
      due_date: params.dueDate,
      priority: params.priority || 0.5,
      status: 'pending'
    })
    .select()
    .single()
  
  return { 
    success: true, 
    task 
  }
}

async function generateReport(params: any, userId: string, supabase: any) {
  // Implement report generation
  return { 
    success: true, 
    reportId: crypto.randomUUID(),
    reportUrl: '/reports/generated-report.pdf' 
  }
}

async function analyzeData(params: any, userId: string, supabase: any) {
  // Implement data analysis
  return { 
    success: true, 
    insights: ['Insight 1', 'Insight 2', 'Insight 3'],
    summary: 'Data analysis completed successfully' 
  }
}