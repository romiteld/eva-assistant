'use client'

import React, { lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Phone, MessageSquare, Settings, BarChart3, Clock, Loader2 } from 'lucide-react'

// Lazy load heavy components
const TwilioVoiceManager = lazy(() => import('./TwilioVoiceManager'))
const TwilioSMSManager = lazy(() => import('./TwilioSMSManager'))
const TwilioAnalytics = lazy(() => import('./TwilioAnalytics'))
const TwilioConfigManager = lazy(() => import('./TwilioConfigManager'))

// Loading component
function ComponentLoader({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center gap-3 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading {name}...</span>
      </div>
    </div>
  )
}

// Glass card component
function GlassCard({ 
  children, 
  className = "", 
  delay = 0,
  onClick
}: { 
  children: React.ReactNode
  className?: string
  delay?: number
  onClick?: () => void
}) {
  return (
    <motion.div
      className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

// Quick action card
function QuickActionCard({ 
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
}) {
  return (
    <GlassCard 
      className="p-6 cursor-pointer hover:bg-white/10 transition-colors" 
      delay={delay}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <motion.div 
          className="p-3 bg-purple-600/20 rounded-xl"
          whileHover={{ scale: 1.1 }}
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
  )
}

interface TwilioIntegrationProps {
  className?: string
}

export default function TwilioIntegrationOptimized({ className = "" }: TwilioIntegrationProps) {
  const [selectedTab, setSelectedTab] = React.useState<'overview' | 'voice' | 'sms' | 'analytics' | 'config'>('overview')
  const [loadedComponents, setLoadedComponents] = React.useState<Set<string>>(new Set())

  // Pre-load components on hover for better UX
  const handleTabHover = (tab: string) => {
    if (!loadedComponents.has(tab)) {
      setLoadedComponents(prev => new Set(prev).add(tab))
    }
  }

  const handleTabClick = (tab: 'overview' | 'voice' | 'sms' | 'analytics' | 'config') => {
    setSelectedTab(tab)
    if (!loadedComponents.has(tab)) {
      setLoadedComponents(prev => new Set(prev).add(tab))
    }
  }

  return (
    <div className={`p-8 space-y-8 ${className}`}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Twilio Integration</h1>
        <p className="text-gray-400">Manage voice calls, SMS, and communication settings</p>
      </motion.div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <QuickActionCard
              icon={Phone}
              title="Voice Management"
              description="Manage voice calls, recordings, and IVR"
              onClick={() => handleTabClick('voice')}
              delay={0.1}
            />
            <QuickActionCard
              icon={MessageSquare}
              title="SMS Management"
              description="Send SMS, manage templates and campaigns"
              onClick={() => handleTabClick('sms')}
              delay={0.2}
            />
            <QuickActionCard
              icon={BarChart3}
              title="Analytics"
              description="View communication metrics and insights"
              onClick={() => handleTabClick('analytics')}
              delay={0.3}
            />
            <QuickActionCard
              icon={Settings}
              title="Configuration"
              description="Twilio account settings and API keys"
              onClick={() => handleTabClick('config')}
              delay={0.4}
            />
          </div>

          {/* Recent Activity */}
          <GlassCard className="p-6" delay={0.5}>
            <h3 className="text-xl font-semibold text-white mb-6">Recent Activity</h3>
            <div className="space-y-4">
              {[
                { icon: Phone, text: "Voice call completed", time: "2 minutes ago" },
                { icon: MessageSquare, text: "SMS campaign sent", time: "15 minutes ago" },
                { icon: Clock, text: "IVR flow updated", time: "1 hour ago" }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                >
                  <item.icon className="w-5 h-5 text-purple-400" />
                  <div className="flex-1">
                    <p className="text-white text-sm">{item.text}</p>
                    <p className="text-gray-400 text-xs">{item.time}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Tab Navigation */}
      {selectedTab !== 'overview' && (
        <div className="flex space-x-1 bg-white/5 p-1 rounded-lg">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'voice', label: 'Voice', icon: Phone },
            { id: 'sms', label: 'SMS', icon: MessageSquare },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'config', label: 'Config', icon: Settings }
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
        </div>
      )}

      {/* Tab Content */}
      {selectedTab === 'voice' && (
        <Suspense fallback={<ComponentLoader name="Voice Manager" />}>
          <TwilioVoiceManager />
        </Suspense>
      )}

      {selectedTab === 'sms' && (
        <Suspense fallback={<ComponentLoader name="SMS Manager" />}>
          <TwilioSMSManager />
        </Suspense>
      )}

      {selectedTab === 'analytics' && (
        <Suspense fallback={<ComponentLoader name="Analytics" />}>
          <TwilioAnalytics />
        </Suspense>
      )}

      {selectedTab === 'config' && (
        <Suspense fallback={<ComponentLoader name="Configuration" />}>
          <TwilioConfigManager />
        </Suspense>
      )}
    </div>
  )
}