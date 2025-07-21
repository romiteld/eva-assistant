'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Send, MessageCircle, Users, TrendingUp } from 'lucide-react'

export default function TwilioSMSManager() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">SMS Manager</h2>
        <p className="text-gray-400 mb-6">Send SMS messages, manage templates and campaigns</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <Send className="w-8 h-8 text-purple-400 mb-2" />
            <h3 className="font-semibold text-white">Sent Today</h3>
            <p className="text-2xl font-bold text-purple-400">0</p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-lg">
            <MessageCircle className="w-8 h-8 text-green-400 mb-2" />
            <h3 className="font-semibold text-white">Templates</h3>
            <p className="text-2xl font-bold text-green-400">0</p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-lg">
            <Users className="w-8 h-8 text-blue-400 mb-2" />
            <h3 className="font-semibold text-white">Recipients</h3>
            <p className="text-2xl font-bold text-blue-400">0</p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-lg">
            <TrendingUp className="w-8 h-8 text-orange-400 mb-2" />
            <h3 className="font-semibold text-white">Delivery Rate</h3>
            <p className="text-2xl font-bold text-orange-400">0%</p>
          </div>
        </div>
        
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-white/5 rounded-lg">
            <h3 className="font-semibold text-white mb-2">Quick Send</h3>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Phone number" 
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
              />
              <textarea 
                placeholder="Message content" 
                rows={3}
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
              />
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                Send SMS
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ This is a placeholder component. Connect to Twilio SMS API to enable functionality.
          </p>
        </div>
      </div>
    </motion.div>
  )
}