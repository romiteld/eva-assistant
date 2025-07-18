'use client'

import React, { lazy, Suspense, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Settings, 
  Loader2,
  Play,
  Pause,
  Volume2,
  Brain,
  Zap
} from 'lucide-react'

// Lazy load heavy AI components
const GeminiLiveChat = lazy(() => import('./GeminiLiveChat'))
const VoiceProcessingEngine = lazy(() => import('./VoiceProcessingEngine'))
const AIModelSelector = lazy(() => import('./AIModelSelector'))
const VoiceSettings = lazy(() => import('./VoiceSettings'))

// Reduced motion variants for performance
const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const fastVariants = {
  hidden: { opacity: 0, y: reduceMotion ? 0 : 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: reduceMotion ? 0 : -10 }
}

const slowVariants = {
  hidden: { opacity: 0, y: reduceMotion ? 0 : 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: reduceMotion ? 0 : -20 }
}

// Optimized loading component
const VoiceLoader = React.memo(({ name }: { name: string }) => (
  <div className="flex items-center justify-center p-8">
    <div className="flex items-center gap-3 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Loading {name}...</span>
    </div>
  </div>
))
VoiceLoader.displayName = 'VoiceLoader'

// Optimized glass card component
const GlassCard = React.memo(({ 
  children, 
  className = "", 
  delay = 0,
  onClick
}: { 
  children: React.ReactNode
  className?: string
  delay?: number
  onClick?: () => void
}) => (
  <motion.div
    className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${className}`}
    initial="hidden"
    animate="visible"
    exit="exit"
    variants={fastVariants}
    transition={{ duration: reduceMotion ? 0.1 : 0.5, delay }}
    whileHover={reduceMotion ? {} : { y: -2, transition: { duration: 0.2 } }}
    onClick={onClick}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
    <div className="relative z-10">{children}</div>
  </motion.div>
))
GlassCard.displayName = 'GlassCard'

// Optimized voice control button
const VoiceControlButton = React.memo(({ 
  isRecording, 
  onClick, 
  disabled = false 
}: { 
  isRecording: boolean
  onClick: () => void
  disabled?: boolean
}) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    className={`relative p-8 rounded-full border-2 transition-all duration-300 ${
      isRecording 
        ? 'bg-red-500/20 border-red-500 text-red-400' 
        : 'bg-purple-600/20 border-purple-600 text-purple-400 hover:bg-purple-600/30'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    whileHover={reduceMotion ? {} : { scale: disabled ? 1 : 1.05 }}
    whileTap={reduceMotion ? {} : { scale: disabled ? 1 : 0.95 }}
    animate={isRecording && !reduceMotion ? { scale: [1, 1.1, 1] } : {}}
    transition={{ 
      duration: 0.2,
      repeat: isRecording ? Infinity : 0,
      repeatType: "reverse"
    }}
  >
    {isRecording ? (
      <MicOff className="w-12 h-12" />
    ) : (
      <Mic className="w-12 h-12" />
    )}
    
    {/* Pulse animation for recording */}
    {isRecording && !reduceMotion && (
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-red-500/50"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    )}
  </motion.button>
))
VoiceControlButton.displayName = 'VoiceControlButton'

// Voice status indicator
const VoiceStatusIndicator = React.memo(({ 
  status, 
  volume = 0 
}: { 
  status: 'idle' | 'listening' | 'processing' | 'speaking'
  volume?: number
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'listening': return 'text-green-400'
      case 'processing': return 'text-yellow-400'
      case 'speaking': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'listening': return <Mic className="w-5 h-5" />
      case 'processing': return <Brain className="w-5 h-5" />
      case 'speaking': return <Volume2 className="w-5 h-5" />
      default: return <MicOff className="w-5 h-5" />
    }
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
      <div className={`${getStatusColor()}`}>
        {getStatusIcon()}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium capitalize ${getStatusColor()}`}>
          {status}
        </p>
        {volume > 0 && (
          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
            <motion.div 
              className="h-1 rounded-full bg-gradient-to-r from-green-500 to-yellow-500"
              style={{ width: `${Math.min(volume * 100, 100)}%` }}
              animate={{ width: `${Math.min(volume * 100, 100)}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}
      </div>
    </div>
  )
})
VoiceStatusIndicator.displayName = 'VoiceStatusIndicator'

// Quick action card
const QuickActionCard = React.memo(({ 
  icon: Icon, 
  title, 
  description, 
  onClick,
  delay = 0
}: {
  icon: React.ComponentType<any>
  title: string
  description: string
  onClick: () => void
  delay?: number
}) => (
  <GlassCard 
    className="p-6 cursor-pointer hover:bg-white/10 transition-colors" 
    delay={delay}
    onClick={onClick}
  >
    <div className="flex items-center gap-4">
      <motion.div 
        className="p-3 bg-purple-600/20 rounded-xl"
        whileHover={reduceMotion ? {} : { scale: 1.1 }}
        transition={{ duration: 0.2 }}
      >
        <Icon className="w-6 h-6 text-purple-400" />
      </motion.div>
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
    </div>
  </GlassCard>
))
QuickActionCard.displayName = 'QuickActionCard'

interface VoiceAgentProps {
  className?: string
}

export default function VoiceAgentOptimized({ className = "" }: VoiceAgentProps) {
  const [isRecording, setIsRecording] = React.useState(false)
  const [voiceStatus, setVoiceStatus] = React.useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle')
  const [selectedTab, setSelectedTab] = React.useState<'main' | 'models' | 'settings'>('main')
  const [volume, setVolume] = React.useState(0)
  const [loadedComponents, setLoadedComponents] = React.useState<Set<string>>(new Set())

  // Memoized handlers
  const handleVoiceToggle = useCallback(() => {
    setIsRecording(prev => !prev)
    if (!isRecording) {
      setVoiceStatus('listening')
    } else {
      setVoiceStatus('idle')
    }
  }, [isRecording])

  const handleTabClick = useCallback((tab: 'main' | 'models' | 'settings') => {
    setSelectedTab(tab)
    if (!loadedComponents.has(tab)) {
      setLoadedComponents(prev => new Set(prev).add(tab))
    }
  }, [loadedComponents])

  // Preload components on hover
  const handleTabHover = useCallback((tab: string) => {
    if (!loadedComponents.has(tab)) {
      setLoadedComponents(prev => new Set(prev).add(tab))
    }
  }, [loadedComponents])

  // Memoized quick actions
  const quickActions = useMemo(() => [
    {
      icon: Brain,
      title: "AI Models",
      description: "Select and configure AI models",
      onClick: () => handleTabClick('models'),
      delay: 0.1
    },
    {
      icon: Settings,
      title: "Voice Settings",
      description: "Adjust voice parameters and quality",
      onClick: () => handleTabClick('settings'),
      delay: 0.2
    },
    {
      icon: Zap,
      title: "Quick Call",
      description: "Start a voice call immediately",
      onClick: () => console.log('Quick call'),
      delay: 0.3
    }
  ], [handleTabClick])

  return (
    <div className={`p-8 space-y-8 ${className}`}>
      {/* Header */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fastVariants}
        transition={{ duration: reduceMotion ? 0.1 : 0.5 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Voice Agent</h1>
        <p className="text-gray-400">AI-powered voice interaction with Gemini Live</p>
      </motion.div>

      {/* Main Voice Control */}
      {selectedTab === 'main' && (
        <AnimatePresence mode="wait">
          <motion.div
            key="main"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={slowVariants}
            transition={{ duration: reduceMotion ? 0.1 : 0.3 }}
            className="space-y-6"
          >
            {/* Voice Control Center */}
            <GlassCard className="p-8 text-center">
              <VoiceControlButton 
                isRecording={isRecording}
                onClick={handleVoiceToggle}
              />
              <h3 className="text-xl font-semibold text-white mt-6 mb-2">
                {isRecording ? 'Listening...' : 'Tap to Start'}
              </h3>
              <p className="text-gray-400">
                {isRecording 
                  ? 'Speak clearly into your microphone' 
                  : 'Click the microphone to begin voice interaction'
                }
              </p>
            </GlassCard>

            {/* Voice Status */}
            <VoiceStatusIndicator status={voiceStatus} volume={volume} />

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quickActions.map((action, index) => (
                <QuickActionCard key={action.title} {...action} />
              ))}
            </div>

            {/* Live Chat Component */}
            <Suspense fallback={<VoiceLoader name="Live Chat" />}>
              <GeminiLiveChat />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Tab Navigation */}
      {selectedTab !== 'main' && (
        <motion.div 
          className="flex space-x-1 bg-white/5 p-1 rounded-lg"
          initial="hidden"
          animate="visible"
          variants={fastVariants}
        >
          {[
            { id: 'main', label: 'Voice Control', icon: Mic },
            { id: 'models', label: 'AI Models', icon: Brain },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id as any)}
              onMouseEnter={() => handleTabHover(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                selectedTab === tab.id 
                  ? 'bg-white/10 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {selectedTab === 'models' && (
          <motion.div
            key="models"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={slowVariants}
            transition={{ duration: reduceMotion ? 0.1 : 0.3 }}
          >
            <Suspense fallback={<VoiceLoader name="AI Models" />}>
              <AIModelSelector />
            </Suspense>
          </motion.div>
        )}

        {selectedTab === 'settings' && (
          <motion.div
            key="settings"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={slowVariants}
            transition={{ duration: reduceMotion ? 0.1 : 0.3 }}
          >
            <Suspense fallback={<VoiceLoader name="Voice Settings" />}>
              <VoiceSettings />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}