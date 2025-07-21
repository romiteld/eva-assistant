'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Sparkles, Send, Mic, MicOff } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function GeminiLiveChat() {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant powered by Gemini. How can I help you today?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = React.useState('')
  const [isListening, setIsListening] = React.useState(false)
  
  const handleSend = () => {
    if (!input.trim()) return
    
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, newMessage])
    setInput('')
    
    // Simulate AI response
    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'This is a placeholder response. Connect to Gemini API for real conversations.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, response])
    }, 1000)
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-purple-400" />
          <h3 className="font-semibold text-white">Gemini Live Chat</h3>
          <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
            Active
          </span>
        </div>
      </div>
      
      {/* Messages */}
      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-3 rounded-lg ${
              message.role === 'user' 
                ? 'bg-purple-600/20 text-white' 
                : 'bg-white/10 text-gray-100'
            }`}>
              <p className="text-sm">{message.content}</p>
              <p className="text-xs mt-1 opacity-50">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Input */}
      <div className="p-4 bg-white/5 border-t border-white/10">
        <div className="flex gap-2">
          <button
            onClick={() => setIsListening(!isListening)}
            className={`p-3 rounded-lg transition-colors ${
              isListening 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
          />
          
          <button
            onClick={handleSend}
            className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-xs">
            ⚠️ Placeholder chat. Connect to Gemini Live API for real-time conversations.
          </p>
        </div>
      </div>
    </motion.div>
  )
}