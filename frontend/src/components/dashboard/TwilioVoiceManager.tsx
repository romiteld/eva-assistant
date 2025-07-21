'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Voicemail } from 'lucide-react'

export default function TwilioVoiceManager() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Voice Manager</h2>
        <p className="text-gray-400 mb-6">Manage voice calls, IVR flows, and voice recordings</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <PhoneCall className="w-8 h-8 text-purple-400 mb-2" />
            <h3 className="font-semibold text-white">Active Calls</h3>
            <p className="text-2xl font-bold text-purple-400">0</p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-lg">
            <PhoneIncoming className="w-8 h-8 text-green-400 mb-2" />
            <h3 className="font-semibold text-white">Incoming</h3>
            <p className="text-2xl font-bold text-green-400">0</p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-lg">
            <PhoneOutgoing className="w-8 h-8 text-blue-400 mb-2" />
            <h3 className="font-semibold text-white">Outgoing</h3>
            <p className="text-2xl font-bold text-blue-400">0</p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-lg">
            <Voicemail className="w-8 h-8 text-orange-400 mb-2" />
            <h3 className="font-semibold text-white">Voicemails</h3>
            <p className="text-2xl font-bold text-orange-400">0</p>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ This is a placeholder component. Connect to Twilio Voice API to enable functionality.
          </p>
        </div>
      </div>
    </motion.div>
  )
}