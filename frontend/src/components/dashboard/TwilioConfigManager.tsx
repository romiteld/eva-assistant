'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Settings, Key, Shield, Database, Globe, AlertCircle } from 'lucide-react'

export default function TwilioConfigManager() {
  const [showApiKey, setShowApiKey] = React.useState(false)
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Configuration</h2>
        <p className="text-gray-400 mb-6">Manage Twilio account settings and API credentials</p>
        
        {/* API Credentials */}
        <div className="space-y-6">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-6 h-6 text-purple-400" />
              <h3 className="font-semibold text-white">API Credentials</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Account SID</label>
                <input 
                  type="text" 
                  placeholder="AC..." 
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Auth Token</label>
                <div className="relative">
                  <input 
                    type={showApiKey ? "text" : "password"}
                    placeholder="Enter your auth token" 
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 pr-20"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Settings */}
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="w-6 h-6 text-blue-400" />
              <h3 className="font-semibold text-white">General Settings</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Enable Voice Calls</p>
                  <p className="text-sm text-gray-400">Allow making and receiving calls</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Enable SMS</p>
                  <p className="text-sm text-gray-400">Allow sending and receiving SMS</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          </div>
          
          {/* Status */}
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-green-400" />
              <h3 className="font-semibold text-white">Connection Status</h3>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-gray-400">Not Connected</span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-4">
            <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
              Save Configuration
            </button>
            <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
              Test Connection
            </button>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ This is a placeholder component. Add your Twilio credentials to enable functionality.
          </p>
        </div>
      </div>
    </motion.div>
  )
}