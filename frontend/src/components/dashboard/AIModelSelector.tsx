'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Brain, Sparkles, Zap, Cpu, Check, Info } from 'lucide-react'

interface AIModel {
  id: string
  name: string
  provider: string
  description: string
  features: string[]
  performance: 'fast' | 'balanced' | 'quality'
  icon: React.ComponentType<any>
  recommended?: boolean
}

const models: AIModel[] = [
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    description: 'Advanced multimodal model with extended context window',
    features: ['1M token context', 'Vision support', 'Audio processing'],
    performance: 'quality',
    icon: Sparkles,
    recommended: true
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    description: 'Fast and efficient for real-time applications',
    features: ['Low latency', 'Cost effective', 'Voice optimized'],
    performance: 'fast',
    icon: Zap
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    description: 'Powerful general-purpose language model',
    features: ['High accuracy', 'Complex reasoning', 'Code generation'],
    performance: 'quality',
    icon: Brain
  },
  {
    id: 'claude-3',
    name: 'Claude 3',
    provider: 'Anthropic',
    description: 'Constitutional AI with strong safety features',
    features: ['Safe responses', 'Long context', 'Analytical tasks'],
    performance: 'balanced',
    icon: Cpu
  }
]

export default function AIModelSelector() {
  const [selectedModel, setSelectedModel] = React.useState('gemini-1.5-pro')
  
  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'fast': return 'text-green-400 bg-green-400/20'
      case 'balanced': return 'text-yellow-400 bg-yellow-400/20'
      case 'quality': return 'text-purple-400 bg-purple-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">AI Model Selection</h2>
        <p className="text-gray-400 mb-6">Choose the AI model that best fits your needs</p>
        
        {/* Model Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((model) => (
            <motion.div
              key={model.id}
              whileHover={{ y: -2 }}
              onClick={() => setSelectedModel(model.id)}
              className={`relative p-4 rounded-xl cursor-pointer transition-all ${
                selectedModel === model.id
                  ? 'bg-purple-600/20 border-2 border-purple-600'
                  : 'bg-white/5 border-2 border-white/10 hover:border-white/20'
              }`}
            >
              {model.recommended && (
                <span className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                  Recommended
                </span>
              )}
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/10 rounded-lg">
                  <model.icon className="w-6 h-6 text-purple-400" />
                </div>
                
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{model.name}</h3>
                  <p className="text-sm text-gray-400">{model.provider}</p>
                  <p className="text-sm text-gray-300 mt-1">{model.description}</p>
                  
                  {/* Features */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {model.features.map((feature) => (
                      <span
                        key={feature}
                        className="px-2 py-1 bg-white/10 text-xs text-gray-300 rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                  
                  {/* Performance */}
                  <div className="mt-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getPerformanceColor(model.performance)}`}>
                      {model.performance.charAt(0).toUpperCase() + model.performance.slice(1)}
                    </span>
                  </div>
                </div>
                
                {selectedModel === model.id && (
                  <Check className="w-5 h-5 text-purple-400" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Model Settings */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <h3 className="font-semibold text-white mb-4">Model Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Temperature</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                defaultValue="70"
                className="w-full accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Max Tokens</label>
              <input 
                type="number" 
                defaultValue="2048"
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white"
              />
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex gap-2">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <p className="text-blue-400 text-sm">
              Model selection is currently a UI preview. API integration required for functionality.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}