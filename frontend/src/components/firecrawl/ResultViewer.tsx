'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import NextImage from 'next/image'
import { 
  Code2, 
  FileText, 
  Image, 
  Copy, 
  Check, 
  Download,
  Maximize2,
  Eye,
  EyeOff 
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ContentFormat = 'markdown' | 'html' | 'json' | 'text' | 'image'

interface ResultViewerProps {
  content: any
  format?: ContentFormat
  title?: string
  className?: string
}

export function ResultViewer({
  content,
  format = 'text',
  title,
  className,
}: ResultViewerProps) {
  const [activeTab, setActiveTab] = useState<ContentFormat>(format)
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleCopy = async () => {
    const textContent = typeof content === 'string' 
      ? content 
      : JSON.stringify(content, null, 2)
    
    await navigator.clipboard.writeText(textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const textContent = typeof content === 'string' 
      ? content 
      : JSON.stringify(content, null, 2)
    
    const blob = new Blob([textContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'result'}.${activeTab}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renderContent = () => {
    if (!content) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No content to display
        </div>
      )
    }

    switch (activeTab) {
      case 'markdown':
        return (
          <div className="prose prose-invert max-w-none">
            {showRaw ? (
              <pre className="text-gray-300">{content}</pre>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            )}
          </div>
        )
      
      case 'html':
        return showRaw ? (
          <pre className="text-gray-300">{content}</pre>
        ) : (
          <iframe
            srcDoc={content}
            className="w-full h-full min-h-[400px] bg-white rounded"
            title="HTML Preview"
          />
        )
      
      case 'json':
        return (
          <pre className="text-gray-300 overflow-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        )
      
      case 'image':
        return (
          <div className="flex items-center justify-center p-8">
            <NextImage 
              src={content} 
              alt="Scraped content image"
              width={800}
              height={600}
              className="max-w-full h-auto rounded-lg shadow-lg"
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
        )
      
      default:
        return <pre className="text-gray-300 whitespace-pre-wrap">{content}</pre>
    }
  }

  const tabs = [
    { id: 'text' as ContentFormat, label: 'Text', icon: FileText },
    { id: 'markdown' as ContentFormat, label: 'Markdown', icon: FileText },
    { id: 'html' as ContentFormat, label: 'HTML', icon: Code2 },
    { id: 'json' as ContentFormat, label: 'JSON', icon: Code2 },
    { id: 'image' as ContentFormat, label: 'Image', icon: Image },
  ]

  const availableTabs = tabs.filter(tab => {
    if (tab.id === 'image') return typeof content === 'string' && content.startsWith('data:image')
    if (tab.id === 'json') return typeof content === 'object'
    return true
  })

  return (
    <motion.div
      className={cn(
        'relative rounded-lg border border-gray-700 bg-gray-900/50 backdrop-blur-sm overflow-hidden',
        isFullscreen && 'fixed inset-4 z-50',
        className
      )}
      layout
    >
      <div className="border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            {title && (
              <h3 className="text-sm font-medium text-gray-200">{title}</h3>
            )}
            <div className="flex gap-1">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    activeTab === tab.id
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                  )}
                >
                  <tab.icon className="h-3 w-3" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(activeTab === 'markdown' || activeTab === 'html') && (
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="p-1.5 text-gray-400 hover:text-gray-300 rounded hover:bg-gray-700/50 transition-colors"
                title={showRaw ? 'Show preview' : 'Show raw'}
              >
                {showRaw ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1.5 text-gray-400 hover:text-gray-300 rounded hover:bg-gray-700/50 transition-colors"
              title="Copy content"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check className="h-4 w-4 text-green-500" />
                  </motion.div>
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </AnimatePresence>
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 text-gray-400 hover:text-gray-300 rounded hover:bg-gray-700/50 transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-gray-400 hover:text-gray-300 rounded hover:bg-gray-700/50 transition-colors"
              title="Toggle fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className={cn(
        'p-4 overflow-auto',
        isFullscreen ? 'max-h-[calc(100vh-8rem)]' : 'max-h-[600px]'
      )}>
        {renderContent()}
      </div>
    </motion.div>
  )
}