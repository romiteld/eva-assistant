'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Brain,
  Mic,
  MicOff,
  Volume2,
  Phone,
  PhoneOff,
  Loader2,
  Send,
  Paperclip,
  X,
  Check,
  AlertCircle,
  Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'
import type { User } from '@supabase/supabase-js'
import { supabaseVoiceStreaming } from '@/lib/services/supabase-voice-streaming'
import { cn } from '@/lib/utils'

interface VoiceState {
  sessionId: string | null
  isConnected: boolean
  isListening: boolean
  isSpeaking: boolean
  isProcessing: boolean
  status: 'idle' | 'connecting' | 'connected' | 'error'
}

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  status?: 'sending' | 'sent' | 'error'
  toolName?: string
  toolStatus?: 'running' | 'success' | 'error'
}

const toolDescriptions: Record<string, string> = {
  search_web: 'Searching the web',
  navigate_dashboard: 'Navigating',
  execute_workflow: 'Executing workflow',
  query_data: 'Querying database',
  create_task: 'Creating task',
  update_task: 'Updating task',
  read_emails: 'Reading emails',
  write_email: 'Composing email',
  monitor_updates: 'Setting up monitor'
}

export default function TalkToEvaPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [voice, setVoice] = useState<VoiceState>({
    sessionId: null,
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    status: 'idle'
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [audioLevel, setAudioLevel] = useState(0)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioVisualizerRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const router = useRouter()

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Initialize user
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error getting user:', error)
      } finally {
        setIsLoading(false)
      }
    }
    getUser()
  }, [])

  // Audio visualization
  useEffect(() => {
    if (!audioVisualizerRef.current) return

    const canvas = audioVisualizerRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const baseRadius = 40
      const maxRadius = 60
      
      // Draw animated circles based on audio level
      const radius = baseRadius + (audioLevel * (maxRadius - baseRadius))
      
      // Outer glow
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius + 20, 0, Math.PI * 2)
      const gradient = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, radius + 20)
      gradient.addColorStop(0, voice.isListening ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.2)')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fill()
      
      // Main circle
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = voice.isListening ? '#22c55e' : '#a855f7'
      ctx.fill()
      
      // Inner circle
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2)
      ctx.fillStyle = voice.isListening ? '#16a34a' : '#9333ea'
      ctx.fill()
      
      animationFrameRef.current = requestAnimationFrame(draw)
    }
    
    draw()
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [audioLevel, voice.isListening])

  // Set up voice streaming event listeners
  useEffect(() => {
    if (!supabaseVoiceStreaming) return

    const handleConnected = (sessionId: string) => {
      setVoice(prev => ({ 
        ...prev, 
        sessionId, 
        isConnected: true, 
        status: 'connected' 
      }))
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'system',
        content: 'Connected to Eva. Start speaking!',
        timestamp: Date.now()
      }])
    }

    const handleDisconnected = () => {
      setVoice(prev => ({ 
        ...prev, 
        sessionId: null, 
        isConnected: false, 
        status: 'idle',
        isListening: false,
        isSpeaking: false,
        isProcessing: false
      }))
      setAudioLevel(0)
    }

    const handleTranscript = (transcript: string) => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'user',
        content: transcript,
        timestamp: Date.now(),
        status: 'sent'
      }])
    }

    const handleResponse = (response: string) => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: response,
        timestamp: Date.now()
      }])
    }

    const handleListening = (isListening: boolean) => {
      setVoice(prev => ({ ...prev, isListening }))
    }

    const handleSpeakingStart = () => {
      setVoice(prev => ({ ...prev, isSpeaking: true }))
    }

    const handleSpeakingEnd = () => {
      setVoice(prev => ({ ...prev, isSpeaking: false }))
    }

    const handleProcessingStart = () => {
      setVoice(prev => ({ ...prev, isProcessing: true }))
    }

    const handleProcessingEnd = () => {
      setVoice(prev => ({ ...prev, isProcessing: false }))
    }

    const handleAudioData = (data: Uint8Array) => {
      // Calculate average audio level
      const sum = data.reduce((acc, val) => acc + val, 0)
      const avg = sum / data.length / 255
      setAudioLevel(avg)
    }

    const handleError = (error: any) => {
      console.error('[VoiceStreaming] Error:', error)
      setVoice(prev => ({ ...prev, status: 'error' }))
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'system',
        content: `Error: ${error.message || 'Connection failed'}`,
        timestamp: Date.now()
      }])
    }

    const handleFunctionCall = (data: { name: string; status: 'success' | 'error'; result: any }) => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'tool',
        content: toolDescriptions[data.name] || data.name,
        timestamp: Date.now(),
        toolName: data.name,
        toolStatus: data.status === 'success' ? 'success' : 'error'
      }])
    }

    const handleCalibrationStart = () => {
      setIsCalibrating(true)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'system',
        content: 'Calibrating microphone... Please remain quiet.',
        timestamp: Date.now()
      }])
    }

    const handleCalibrationComplete = (data: any) => {
      setIsCalibrating(false)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'system',
        content: 'Microphone calibration complete!',
        timestamp: Date.now()
      }])
    }

    // Add event listeners
    supabaseVoiceStreaming.on('connected', handleConnected)
    supabaseVoiceStreaming.on('disconnected', handleDisconnected)
    supabaseVoiceStreaming.on('transcript', handleTranscript)
    supabaseVoiceStreaming.on('response', handleResponse)
    supabaseVoiceStreaming.on('listening', handleListening)
    supabaseVoiceStreaming.on('speakingStart', handleSpeakingStart)
    supabaseVoiceStreaming.on('speakingEnd', handleSpeakingEnd)
    supabaseVoiceStreaming.on('processingStart', handleProcessingStart)
    supabaseVoiceStreaming.on('processingEnd', handleProcessingEnd)
    supabaseVoiceStreaming.on('audioData', handleAudioData)
    supabaseVoiceStreaming.on('functionCall', handleFunctionCall)
    supabaseVoiceStreaming.on('error', handleError)
    supabaseVoiceStreaming.on('calibrationStart', handleCalibrationStart)
    supabaseVoiceStreaming.on('calibrationComplete', handleCalibrationComplete)

    return () => {
      // Clean up event listeners
      supabaseVoiceStreaming.removeListener('connected', handleConnected)
      supabaseVoiceStreaming.removeListener('disconnected', handleDisconnected)
      supabaseVoiceStreaming.removeListener('transcript', handleTranscript)
      supabaseVoiceStreaming.removeListener('response', handleResponse)
      supabaseVoiceStreaming.removeListener('listening', handleListening)
      supabaseVoiceStreaming.removeListener('speakingStart', handleSpeakingStart)
      supabaseVoiceStreaming.removeListener('speakingEnd', handleSpeakingEnd)
      supabaseVoiceStreaming.removeListener('processingStart', handleProcessingStart)
      supabaseVoiceStreaming.removeListener('processingEnd', handleProcessingEnd)
      supabaseVoiceStreaming.removeListener('audioData', handleAudioData)
      supabaseVoiceStreaming.removeListener('functionCall', handleFunctionCall)
      supabaseVoiceStreaming.removeListener('error', handleError)
      supabaseVoiceStreaming.removeListener('calibrationStart', handleCalibrationStart)
      supabaseVoiceStreaming.removeListener('calibrationComplete', handleCalibrationComplete)
    }
  }, [])

  // Handle connect
  const handleConnect = async () => {
    if (!user) return

    try {
      setVoice(prev => ({ ...prev, status: 'connecting' }))
      await supabaseVoiceStreaming.startSession(user.id)
      
      // Apply optimized VAD configuration
      supabaseVoiceStreaming.setChunkDuration(2000)
      supabaseVoiceStreaming.setVADConfig({
        silenceThreshold: 0.01,
        speechThreshold: 0.015,
        silenceDuration: 4000,
      })
      
      // Calibrate microphone for optimal VAD
      await supabaseVoiceStreaming.calibrateMicrophone()
    } catch (error) {
      console.error('Failed to connect:', error)
      setVoice(prev => ({ ...prev, status: 'error' }))
    }
  }

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await supabaseVoiceStreaming.endSession()
      setMessages([])
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  // Handle file attachment
  const handleFileAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !voice.isConnected) return

    // For now, just show a message - in a real implementation, you'd process the file
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'system',
      content: `File attached: ${file.name}`,
      timestamp: Date.now()
    }])
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Eva Voice Assistant</h1>
            <p className="text-xs text-gray-400">
              {voice.isConnected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            voice.status === 'connected' ? 'bg-green-500' : 
            voice.status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
            voice.status === 'error' ? 'bg-red-500' : 
            'bg-gray-500'
          )} />
          {voice.isConnected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
            >
              <PhoneOff className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConnect}
              disabled={voice.status === 'connecting'}
              className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
            >
              <Phone className="w-4 h-4 mr-2" />
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">
                {voice.isConnected ? 'Start speaking to Eva' : 'Connect to start'}
              </h3>
              <p className="text-sm text-gray-500">
                {voice.isConnected 
                  ? 'Eva is listening for your voice commands' 
                  : 'Click the connect button to begin your conversation'}
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex gap-3",
                message.type === 'user' && "flex-row-reverse"
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                message.type === 'user' ? 'bg-blue-500/20' :
                message.type === 'assistant' ? 'bg-purple-500/20' :
                message.type === 'tool' ? 'bg-orange-500/20' :
                'bg-gray-500/20'
              )}>
                {message.type === 'user' ? (
                  <Mic className="w-4 h-4 text-blue-400" />
                ) : message.type === 'assistant' ? (
                  <Brain className="w-4 h-4 text-purple-400" />
                ) : message.type === 'tool' ? (
                  <Activity className="w-4 h-4 text-orange-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {/* Message Content */}
              <div className={cn(
                "flex-1 max-w-[70%]",
                message.type === 'user' && "flex justify-end"
              )}>
                <div className={cn(
                  "rounded-2xl px-4 py-2",
                  message.type === 'user' ? 'bg-blue-500/20 text-blue-100' :
                  message.type === 'assistant' ? 'bg-gray-800 text-gray-100' :
                  message.type === 'tool' ? 'bg-orange-500/10 text-orange-200' :
                  'bg-gray-800/50 text-gray-400'
                )}>
                  {message.type === 'tool' && (
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        {message.content}
                      </span>
                      {message.toolStatus === 'success' ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : message.toolStatus === 'error' ? (
                        <X className="w-3 h-3 text-red-400" />
                      ) : (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                    </div>
                  )}
                  {message.type !== 'tool' && (
                    <p className="text-sm">{message.content}</p>
                  )}
                  <p className="text-xs opacity-50 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Voice Indicator */}
      {voice.isConnected && (
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-6">
              {/* Audio Visualizer */}
              <div className="relative">
                <canvas
                  ref={audioVisualizerRef}
                  width={120}
                  height={120}
                  className="rounded-full"
                />
                <AnimatePresence>
                  {(voice.isListening || voice.isSpeaking) && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      {voice.isListening ? (
                        <Mic className="w-8 h-8 text-white" />
                      ) : (
                        <Volume2 className="w-8 h-8 text-white" />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Status Text */}
              <div className="text-center">
                <p className="text-sm font-medium text-gray-300">
                  {isCalibrating ? 'Calibrating...' :
                   voice.isProcessing ? 'Processing...' :
                   voice.isListening ? 'Listening...' :
                   voice.isSpeaking ? 'Speaking...' :
                   'Ready'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {voice.isListening ? 'Speak clearly into your microphone' :
                   voice.isSpeaking ? 'Eva is responding' :
                   'Say something to start'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Input (Hidden) */}
      <input
        type="file"
        id="file-attach"
        className="hidden"
        onChange={handleFileAttach}
        accept="image/*,.pdf,.doc,.docx,.txt"
      />
    </div>
  )
}