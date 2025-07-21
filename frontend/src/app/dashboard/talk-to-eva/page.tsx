'use client'

// Talk to Eva - Real-time voice assistant interface
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Brain,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
  Clock,
  Activity,
  Search,
  Navigation,
  Database,
  Play,
  Zap,
  History,
  Command,
  X,
  Settings,
  CheckCircle,
  Paperclip,
  Send
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'
import type { User } from '@supabase/supabase-js'
import { supabaseVoiceStreaming } from '@/lib/services/supabase-voice-streaming'
import { AudioVisualizer } from '@/components/voice/AudioVisualizer'

interface VoiceState {
  sessionId: string | null
  isConnected: boolean
  isListening: boolean
  isSpeaking: boolean
  status: 'connected' | 'disconnected' | 'connecting'
}

interface ToolExecution {
  name: string
  status: 'success' | 'error'
  result: any
}

interface Conversation {
  id: string
  type: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  toolExecution?: ToolExecution
}

// Simple ChatMessage component
function ChatMessage({ message, isLatest }: { message: Conversation, isLatest: boolean }) {
  const isUser = message.type === 'user'
  const isTool = message.type === 'tool'
  
  // Tool icons mapping
  const toolIcons: Record<string, any> = {
    search_web: Search,
    navigate_dashboard: Navigation,
    execute_workflow: Zap,
    query_data: Database,
    create_task: CheckCircle
  }
  
  if (isTool && message.toolExecution) {
    const Icon = toolIcons[message.toolExecution.name] || Command
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex justify-center mb-4"
      >
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3 max-w-md">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              message.toolExecution.status === 'success' 
                ? 'bg-green-500/20' 
                : 'bg-red-500/20'
            }`}>
              <Icon className={`w-4 h-4 ${
                message.toolExecution.status === 'success'
                  ? 'text-green-400'
                  : 'text-red-400'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-purple-300">
                  {message.toolExecution.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  message.toolExecution.status === 'success'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {message.toolExecution.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{message.content}</p>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser 
          ? 'bg-purple-600 text-white' 
          : 'bg-white/10 text-gray-100 border border-white/20'
      }`}>
        <div className="flex items-start gap-3">
          {!isUser && (
            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Brain className="w-3 h-3 text-purple-400" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            <div className="flex items-center gap-2 mt-2 text-xs opacity-60">
              <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function TalkToEvaPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [voice, setVoice] = useState<VoiceState>({
    sessionId: null,
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    status: 'disconnected'
  })
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastTranscript, setLastTranscript] = useState('')
  const [lastResponse, setLastResponse] = useState('')
  const [audioLevels, setAudioLevels] = useState<Uint8Array | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [commandPalette, setCommandPalette] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const router = useRouter()
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages are added
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [conversations, scrollToBottom])

  // Initialize user on mount
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

  // Set up voice streaming event listeners
  useEffect(() => {
    if (!supabaseVoiceStreaming) return

    const handleConnected = (sessionId: string) => {
      setConnectionStatus('connected')
      setVoice(prev => ({ ...prev, sessionId, isConnected: true, status: 'connected' }))
    }

    const handleDisconnected = () => {
      setConnectionStatus('disconnected')
      setVoice(prev => ({ ...prev, sessionId: null, isConnected: false, status: 'disconnected' }))
    }

    const handleTranscript = (transcript: string) => {
      setLastTranscript(transcript)
      // Add user message to conversation
      setConversations(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'user',
        content: transcript,
        timestamp: Date.now()
      }])
    }

    const handleResponse = (response: string) => {
      setLastResponse(response)
      // Add assistant response to conversation
      setConversations(prev => [...prev, {
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
      setIsProcessing(true)
    }

    const handleProcessingEnd = () => {
      setIsProcessing(false)
    }

    const handleAudioData = (data: Uint8Array) => {
      setAudioLevels(data)
    }

    const handleError = (error: any) => {
      console.error('[VoiceStreaming] Error:', error)
      setConnectionStatus('disconnected')
      setVoice(prev => ({ ...prev, isConnected: false, status: 'disconnected' }))
    }

    const handleFunctionCall = (data: { name: string; status: 'success' | 'error'; result: any }) => {
      console.log('[VoiceStreaming] Function call:', data)
      // Add tool execution to conversation
      const toolMessage = `${data.name === 'search_web' ? 'Searching the web...' :
        data.name === 'navigate_dashboard' ? 'Navigating to page...' :
        data.name === 'execute_workflow' ? 'Executing workflow...' :
        data.name === 'query_data' ? 'Querying data...' :
        data.name === 'create_task' ? 'Creating task...' :
        'Processing tool...'}`
      
      setConversations(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'tool',
        content: toolMessage,
        timestamp: Date.now(),
        toolExecution: {
          name: data.name,
          status: data.status,
          result: data.result
        }
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
    }
  }, [])

  // Handle connect
  const handleConnect = async () => {
    if (!user) return

    try {
      setConnectionStatus('connecting')
      await supabaseVoiceStreaming.startSession(user.id)
    } catch (error) {
      console.error('Failed to connect:', error)
      setConnectionStatus('disconnected')
    }
  }

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await supabaseVoiceStreaming.endSession()
      setConversations([])
      setLastTranscript('')
      setLastResponse('')
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'k') {
          e.preventDefault()
          setCommandPalette(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 animate-pulse" />
          <div>
            <div className="w-32 h-6 bg-white/10 rounded animate-pulse mb-1" />
            <div className="w-48 h-4 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 w-full h-96 bg-white/5 rounded-2xl animate-pulse" />
          <div className="lg:col-span-3 w-full h-96 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-xl">
            <Brain className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Talk to Eva</h1>
            <p className="text-gray-400">Real-time voice assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400 capitalize">{connectionStatus}</span>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Voice Controls */}
        <motion.div 
          className="lg:col-span-1"
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden h-fit">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
            <div className="relative z-10 p-6">
              {/* Connection controls */}
              <div className="space-y-4 mb-6">
                {!voice.isConnected ? (
                  <motion.button
                    onClick={handleConnect}
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    {isLoading ? 'Connecting...' : 'Connect'}
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={handleDisconnect}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl font-medium transition-all duration-200 hover:bg-red-500/30 flex items-center justify-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Disconnect
                  </motion.button>
                )}
              </div>

              {/* Voice activity indicator */}
              {voice.isConnected && (
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Voice Activity</span>
                    <div className="flex items-center gap-2">
                      {voice.isListening && <motion.div className="w-2 h-2 bg-green-500 rounded-full" animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} />}
                      {voice.isSpeaking && <motion.div className="w-2 h-2 bg-blue-500 rounded-full" animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.5 }} />}
                      {isProcessing && <motion.div className="w-2 h-2 bg-purple-500 rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} />}
                    </div>
                  </div>
                  
                  {/* Audio visualizer */}
                  {audioLevels && (
                    <div className="h-16 bg-white/5 rounded-lg p-2">
                      <AudioVisualizer 
                        frequencyData={audioLevels} 
                        waveformData={null}
                        isActive={voice.isListening || voice.isSpeaking}
                        mode={voice.isListening ? 'input' : 'output'}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {voice.isListening && (
                      <>
                        <Mic className="w-3 h-3 text-green-400" />
                        <span>Listening...</span>
                      </>
                    )}
                    {voice.isSpeaking && (
                      <>
                        <Volume2 className="w-3 h-3 text-blue-400" />
                        <span>Eva is speaking...</span>
                      </>
                    )}
                    {isProcessing && (
                      <>
                        <Brain className="w-3 h-3 text-purple-400" />
                        <span>Processing...</span>
                      </>
                    )}
                    {voice.isConnected && !voice.isListening && !voice.isSpeaking && !isProcessing && (
                      <>
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span>Ready</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left text-sm text-gray-300"
                >
                  <History className="w-4 h-4" />
                  Voice History
                </button>
                
                <button
                  onClick={() => setCommandPalette(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left text-sm text-gray-300"
                >
                  <Command className="w-4 h-4" />
                  Commands
                  <kbd className="ml-auto text-xs bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Conversation Area */}
        <motion.div 
          className="lg:col-span-3"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden h-[600px]">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
            <div className="relative z-10 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                  <AnimatePresence>
                    {lastTranscript && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-white/10 rounded-lg px-4 py-2 text-sm text-gray-300 max-w-md truncate"
                      >
                        &quot;{lastTranscript}&quot;
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-hidden">
                {voice.isConnected ? (
                  <>
                    {/* Conversation history */}
                    <div 
                      ref={scrollAreaRef}
                      className="h-full overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
                    >
                      {conversations.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center max-w-md">
                            <motion.div
                              animate={{ 
                                rotate: [0, 360],
                                scale: [1, 1.1, 1]
                              }}
                              transition={{ 
                                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                                scale: { duration: 2, repeat: Infinity }
                              }}
                              className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center"
                            >
                              <Brain className="w-10 h-10 text-purple-400" />
                            </motion.div>
                            <h3 className="text-xl font-semibold text-white mb-2">Start a conversation with Eva</h3>
                            <p className="text-gray-400">Click the connect button to begin</p>
                          </div>
                        </div>
                      ) : (
                        conversations.map((conv, index) => (
                          <ChatMessage 
                            key={index}
                            message={conv}
                            isLatest={index === conversations.length - 1}
                          />
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <motion.div
                        animate={{ 
                          rotate: [0, 360],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{ 
                          rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                          scale: { duration: 2, repeat: Infinity }
                        }}
                        className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center"
                      >
                        <Brain className="w-12 h-12 text-purple-400" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-white mb-4">Start a conversation with Eva</h3>
                      <p className="text-gray-400 mb-6">Click the connect button to begin</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Input area */}
              {voice.isConnected && (
                <div className="border-t border-white/5 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Connect to start chatting"
                        disabled
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <Paperclip className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                      >
                        <Search className="w-4 h-4" />
                        Web Search
                      </Button>
                      <Button
                        variant="secondary"
                        className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                      >
                        <Navigation className="w-4 h-4" />
                        Navigate
                      </Button>
                      <Button
                        disabled
                        className="bg-purple-600/50 hover:bg-purple-600/70 text-white"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                    <span>Press Enter to send, Shift+Enter for new line • Attach images or documents with the paperclip</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* History sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            className="fixed inset-y-0 right-0 w-96 bg-black/90 backdrop-blur-xl border-l border-white/10 z-30"
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Voice History</h3>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="text-center text-gray-400 py-8">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Voice history will appear here</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command palette */}
      <AnimatePresence>
        {commandPalette && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setCommandPalette(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Quick Commands</h3>
                <button
                  onClick={() => setCommandPalette(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white text-sm">Voice commands available when connected</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}