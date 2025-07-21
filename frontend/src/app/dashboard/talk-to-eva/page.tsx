'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
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
import { chatFileUploadService, ChatUploadedFile } from '@/lib/services/chat-file-upload'
import { FileUploadZone } from '@/components/voice/FileUploadZone'

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

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
  const [pendingAttachments, setPendingAttachments] = useState<ChatUploadedFile[]>([])
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioVisualizerRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const headerRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const voiceIndicatorRef = useRef<HTMLDivElement>(null)
  const orbitRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  
  // Motion values for 3D effects
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-300, 300], [30, -30])
  const rotateY = useTransform(mouseX, [-300, 300], [-30, 30])
  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })

  // Handle mouse movement for 3D effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      mouseX.set(e.clientX - centerX)
      mouseY.set(e.clientY - centerY)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])
  
  // GSAP animations
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    
    const ctx = gsap.context(() => {
      // Header animation
      if (headerRef.current) {
        gsap.from(headerRef.current, {
          y: -100,
          opacity: 0,
          duration: 1,
          ease: 'power3.out'
        })
      }
      
      // Voice indicator 3D rotation
      if (voiceIndicatorRef.current) {
        gsap.set(voiceIndicatorRef.current, {
          transformPerspective: 1000,
          transformStyle: 'preserve-3d'
        })
      }
      
      // Orbit animation
      if (orbitRef.current) {
        gsap.to(orbitRef.current, {
          rotation: 360,
          duration: 20,
          repeat: -1,
          ease: 'none'
        })
      }
    })
    
    return () => ctx.revert()
  }, [])
  
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

  // Advanced audio visualization with particles
  useEffect(() => {
    if (!audioVisualizerRef.current) return

    const canvas = audioVisualizerRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Particle system
    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      size: number
      life: number
      color: string
    }> = []
    
    const createParticle = (x: number, y: number) => {
      const angle = Math.random() * Math.PI * 2
      const velocity = 0.5 + Math.random() * 2
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        size: 2 + Math.random() * 3,
        life: 1,
        color: voice.isListening ? '#22c55e' : '#a855f7'
      })
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(17, 24, 39, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const baseRadius = 40
      const maxRadius = 80
      
      // Draw animated circles based on audio level
      const radius = baseRadius + (audioLevel * (maxRadius - baseRadius))
      
      // Create particles when audio level is high
      if (audioLevel > 0.3 && particles.length < 50) {
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2
          const r = radius + Math.random() * 20
          createParticle(
            centerX + Math.cos(angle) * r,
            centerY + Math.sin(angle) * r
          )
        }
      }
      
      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.02
        p.vy += 0.05 // gravity
        
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.shadowBlur = 10
        ctx.shadowColor = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      
      // Draw main orb with 3D effect
      const time = Date.now() * 0.001
      
      // Outer glow layers
      for (let i = 3; i > 0; i--) {
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius + i * 15, 0, Math.PI * 2)
        const gradient = ctx.createRadialGradient(
          centerX, centerY, radius,
          centerX, centerY, radius + i * 15
        )
        const alpha = 0.1 / i
        gradient.addColorStop(0, voice.isListening 
          ? `rgba(34, 197, 94, ${alpha})` 
          : `rgba(168, 85, 247, ${alpha})`)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fill()
      }
      
      // Main sphere with gradient
      const mainGradient = ctx.createRadialGradient(
        centerX - radius * 0.3, 
        centerY - radius * 0.3, 
        0,
        centerX, 
        centerY, 
        radius
      )
      mainGradient.addColorStop(0, voice.isListening ? '#86efac' : '#e9d5ff')
      mainGradient.addColorStop(0.5, voice.isListening ? '#22c55e' : '#a855f7')
      mainGradient.addColorStop(1, voice.isListening ? '#14532d' : '#581c87')
      
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = mainGradient
      ctx.fill()
      
      // Inner light reflection
      ctx.beginPath()
      ctx.arc(
        centerX - radius * 0.3, 
        centerY - radius * 0.3, 
        radius * 0.3, 
        0, 
        Math.PI * 2
      )
      const innerGradient = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        0,
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.3
      )
      innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
      innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = innerGradient
      ctx.fill()
      
      // Orbiting rings
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(time * 0.5)
      
      for (let i = 0; i < 3; i++) {
        ctx.save()
        ctx.rotate((Math.PI * 2 / 3) * i + time)
        ctx.beginPath()
        ctx.ellipse(0, 0, radius + 30, radius * 0.3, 0, 0, Math.PI * 2)
        ctx.strokeStyle = voice.isListening 
          ? `rgba(34, 197, 94, ${0.3 - i * 0.1})` 
          : `rgba(168, 85, 247, ${0.3 - i * 0.1})`
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }
      
      ctx.restore()
      
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
      
      // Process with attachments if any
      if (pendingAttachments.length > 0) {
        const attachmentsForProcessing = pendingAttachments.map(file => ({
          type: file.fileType as 'image' | 'document',
          content: file.base64 || file.content || '',
          mimeType: file.mimeType,
          fileName: file.fileName
        }))
        
        supabaseVoiceStreaming.processTranscriptWithAttachments(
          transcript,
          attachmentsForProcessing
        )
        
        // Clear attachments after processing
        setPendingAttachments([])
      }
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
      
      // Apply optimized VAD configuration with runtime guards
      if (typeof supabaseVoiceStreaming.setChunkDuration === 'function') {
        supabaseVoiceStreaming.setChunkDuration(2000)
      } else {
        console.warn('setChunkDuration method not available in SupabaseVoiceStreamingService')
      }
      
      if (typeof supabaseVoiceStreaming.setVADConfig === 'function') {
        supabaseVoiceStreaming.setVADConfig({
          silenceThreshold: 0.01,
          speechThreshold: 0.015,
          silenceDuration: 4000,
        })
      } else {
        console.warn('setVADConfig method not available in SupabaseVoiceStreamingService')
      }
      
      // Calibrate microphone for optimal VAD
      if (typeof supabaseVoiceStreaming.calibrateMicrophone === 'function') {
        await supabaseVoiceStreaming.calibrateMicrophone()
      } else {
        console.warn('calibrateMicrophone method not available in SupabaseVoiceStreamingService')
      }
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
    if (!file || !voice.isConnected || !voice.sessionId) return

    setIsUploadingFile(true)
    try {
      const uploadedFile = await chatFileUploadService.uploadChatFile(
        file,
        voice.sessionId,
        (progress) => {
          // Optional: Add progress tracking
          console.log(`Upload progress: ${progress}%`)
        }
      )
      
      setPendingAttachments(prev => [...prev, uploadedFile])
      
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'system',
        content: `File attached: ${file.name}`,
        timestamp: Date.now()
      }])
    } catch (error) {
      console.error('File upload failed:', error)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'system',
        content: `Failed to attach file: ${(error as Error).message}`,
        timestamp: Date.now()
      }])
    } finally {
      setIsUploadingFile(false)
      // Reset the input
      if (event.target) {
        event.target.value = ''
      }
    }
  }
  
  // Handle file removal
  const handleFileRemove = async (fileId: string) => {
    try {
      await chatFileUploadService.deleteChatFile(fileId)
      setPendingAttachments(prev => prev.filter(f => f.id !== fileId))
    } catch (error) {
      console.error('Failed to remove file:', error)
    }
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
      {/* Header with 3D effect */}
      <motion.div 
        ref={headerRef}
        className="flex items-center justify-between px-6 py-4 border-b border-gray-800 backdrop-blur-lg"
        style={{
          transformStyle: 'preserve-3d',
          transform: 'translateZ(0)'
        }}
      >
        <div className="flex items-center gap-3">
          <motion.div 
            className="p-2 bg-purple-500/20 rounded-lg"
            whileHover={{ 
              scale: 1.1, 
              rotateZ: 360,
              transition: { duration: 0.6 }
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Brain className="w-5 h-5 text-purple-400" />
          </motion.div>
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
      </motion.div>

      {/* Messages Area with parallax effect */}
      <motion.div 
        ref={messagesRef}
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{
          perspective: 1000,
          transformStyle: 'preserve-3d'
        }}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              <motion.div
                animate={{ 
                  rotateY: 360,
                  transition: { duration: 4, repeat: Infinity, ease: 'linear' }
                }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              </motion.div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">
                {voice.isConnected ? 'Start speaking to Eva' : 'Connect to start'}
              </h3>
              <p className="text-sm text-gray-500">
                {voice.isConnected 
                  ? 'Eva is listening for your voice commands' 
                  : 'Click the connect button to begin your conversation'}
              </p>
            </motion.div>
          )}
          
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ 
                opacity: 0, 
                y: 20,
                scale: 0.8,
                rotateX: -15
              }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: 1,
                rotateX: 0
              }}
              transition={{ 
                duration: 0.4,
                type: 'spring',
                stiffness: 100
              }}
              whileHover={{
                scale: 1.02,
                transition: { duration: 0.2 }
              }}
              className={cn(
                "flex gap-3",
                message.type === 'user' && "flex-row-reverse"
              )}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Avatar */}
              <motion.div 
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  message.type === 'user' ? 'bg-blue-500/20' :
                  message.type === 'assistant' ? 'bg-purple-500/20' :
                  message.type === 'tool' ? 'bg-orange-500/20' :
                  'bg-gray-500/20'
                )}
                whileHover={{ 
                  rotate: 360,
                  scale: 1.2,
                  transition: { duration: 0.6 }
                }}
              >
                {message.type === 'user' ? (
                  <Mic className="w-4 h-4 text-blue-400" />
                ) : message.type === 'assistant' ? (
                  <Brain className="w-4 h-4 text-purple-400" />
                ) : message.type === 'tool' ? (
                  <Activity className="w-4 h-4 text-orange-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                )}
              </motion.div>
              
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
      </motion.div>

      {/* File Upload Zone */}
      {voice.isConnected && voice.sessionId && (
        <div className="px-4 py-2 border-t border-gray-800">
          <FileUploadZone
            sessionId={voice.sessionId}
            onFilesUploaded={(files) => setPendingAttachments(prev => [...prev, ...files])}
            onFileRemove={handleFileRemove}
            uploadedFiles={pendingAttachments}
            disabled={!voice.isConnected || isUploadingFile}
            className="max-w-3xl mx-auto"
          />
        </div>
      )}

      {/* Voice Indicator with 3D animation */}
      {voice.isConnected && (
        <motion.div 
          className="px-4 py-4 border-t border-gray-800 backdrop-blur-lg"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 100 }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-6">
              {/* 3D Audio Visualizer */}
              <motion.div 
                ref={voiceIndicatorRef}
                className="relative"
                style={{
                  rotateX: springRotateX,
                  rotateY: springRotateY,
                  transformStyle: 'preserve-3d'
                }}
              >
                <canvas
                  ref={audioVisualizerRef}
                  width={200}
                  height={200}
                  className="rounded-full"
                  style={{
                    boxShadow: voice.isListening 
                      ? '0 0 60px rgba(34, 197, 94, 0.6)' 
                      : '0 0 60px rgba(168, 85, 247, 0.6)'
                  }}
                />
                <AnimatePresence>
                  {(voice.isListening || voice.isSpeaking) && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ transform: 'translateZ(50px)' }}
                    >
                      <motion.div
                        animate={{ 
                          scale: [1, 1.2, 1],
                          rotate: voice.isListening ? [0, 0, 0] : [0, 360, 360]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut'
                        }}
                      >
                        {voice.isListening ? (
                          <Mic className="w-10 h-10 text-white drop-shadow-2xl" />
                        ) : (
                          <Volume2 className="w-10 h-10 text-white drop-shadow-2xl" />
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              
              {/* Status Text with typewriter effect */}
              <motion.div 
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
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
              </motion.div>
              
              {/* File Attachment Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-4"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => document.getElementById('file-attach')?.click()}
                  disabled={isUploadingFile || voice.isProcessing}
                  className="text-gray-400 hover:text-gray-300 hover:bg-gray-700/50"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  {isUploadingFile ? 'Uploading...' : 'Attach File'}
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
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