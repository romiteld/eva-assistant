'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  ArrowLeft, 
  Globe, 
  Settings,
  Play,
  Download,
  Share2,
  History,
  Bookmark,
  Filter,
  Eye
} from 'lucide-react'
import { UrlInput } from '@/components/firecrawl/UrlInput'
import { ResultViewer } from '@/components/firecrawl/ResultViewer'
import { ProgressTracker } from '@/components/firecrawl/ProgressTracker'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { ProgressStep } from '@/components/firecrawl/ProgressTracker'

interface ScrapeOptions {
  formats: string[]
  waitFor: number
  onlyMainContent: boolean
  includeScreenshot: boolean
  mobile: boolean
  removeBase64Images: boolean
}

interface ScrapeResult {
  markdown?: string
  html?: string
  screenshot?: string
  links?: string[]
  metadata?: {
    title?: string
    description?: string
    ogImage?: string
  }
}

export default function ScrapePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [options, setOptions] = useState<ScrapeOptions>({
    formats: ['markdown'],
    waitFor: 0,
    onlyMainContent: true,
    includeScreenshot: false,
    mobile: false,
    removeBase64Images: true,
  })
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { id: 'connect', label: 'Connecting to URL', status: 'pending' },
    { id: 'parse', label: 'Parsing content', status: 'pending' },
    { id: 'extract', label: 'Extracting data', status: 'pending' },
  ])

  const handleScrape = async () => {
    if (!url) return

    setIsLoading(true)
    setResult(null)
    setProgressSteps(steps => steps.map(s => ({ ...s, status: 'pending' as const })))

    try {
      // Simulate progress updates
      setProgressSteps(steps => steps.map((s, i) => 
        i === 0 ? { ...s, status: 'active' as const, progress: 0 } : s
      ))

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setProgressSteps(steps => steps.map((s, i) => 
        i === 0 ? { ...s, status: 'completed' as const } : 
        i === 1 ? { ...s, status: 'active' as const, progress: 50 } : s
      ))

      await new Promise(resolve => setTimeout(resolve, 1500))

      setProgressSteps(steps => steps.map((s, i) => 
        i <= 1 ? { ...s, status: 'completed' as const } : 
        { ...s, status: 'active' as const, progress: 80 }
      ))

      await new Promise(resolve => setTimeout(resolve, 1000))

      // Mock result
      setResult({
        markdown: `# Example Page Title\n\nThis is the scraped content from ${url}.\n\n## Section 1\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n## Section 2\n\nMore content here...`,
        html: `<h1>Example Page Title</h1><p>This is the scraped content from ${url}.</p>`,
        metadata: {
          title: 'Example Page Title',
          description: 'This is an example page description',
          ogImage: 'https://via.placeholder.com/1200x630',
        },
        links: ['https://example.com/page1', 'https://example.com/page2'],
      })

      setProgressSteps(steps => steps.map(s => ({ ...s, status: 'completed' as const })))
      toast({
        title: 'Page scraped successfully!',
        variant: 'success'
      })
    } catch (error) {
      toast({
        title: 'Failed to scrape page',
        variant: 'destructive'
      })
      setProgressSteps(steps => steps.map((s, i) => 
        s.status === 'active' ? { ...s, status: 'error' as const, message: 'Failed to complete' } : s
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const formatOptions = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'html', label: 'HTML' },
    { value: 'links', label: 'Links' },
    { value: 'screenshot', label: 'Screenshot' },
    { value: 'extract', label: 'Structured Data' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/firecrawl')}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">URL Scraping</h1>
              <p className="text-sm text-gray-400 mt-1">
                Extract content from any webpage with real-time preview
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
              <History className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
              <Bookmark className="h-5 w-5" />
            </button>
          </div>
        </motion.div>

        {/* URL Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <UrlInput
                    value={url}
                    onChange={setUrl}
                    onSubmit={handleScrape}
                    label="Enter URL to scrape"
                    placeholder="https://example.com/page"
                  />
                </div>
                <button
                  onClick={handleScrape}
                  disabled={!url || isLoading}
                  className={cn(
                    'px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2',
                    url && !isLoading
                      ? 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-lg hover:shadow-purple-500/25'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  )}
                >
                  <Play className="h-4 w-4" />
                  Scrape
                </button>
              </div>

              {/* Options Toggle */}
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Advanced Options
              </button>

              {/* Options Panel */}
              {showOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-4 border-t border-gray-700"
                >
                  {/* Format Selection */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Output Formats
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {formatOptions.map(format => (
                        <button
                          key={format.value}
                          onClick={() => {
                            setOptions(prev => ({
                              ...prev,
                              formats: prev.formats.includes(format.value)
                                ? prev.formats.filter(f => f !== format.value)
                                : [...prev.formats, format.value]
                            }))
                          }}
                          className={cn(
                            'px-3 py-1.5 text-sm rounded-lg transition-colors',
                            options.formats.includes(format.value)
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                          )}
                        >
                          {format.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Other Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={options.onlyMainContent}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: ScrapeOptions) => ({ ...prev, onlyMainContent: e.target.checked }))}
                        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      Extract main content only
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={options.mobile}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: ScrapeOptions) => ({ ...prev, mobile: e.target.checked }))}
                        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      Mobile viewport
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={options.includeScreenshot}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: ScrapeOptions) => ({ ...prev, includeScreenshot: e.target.checked }))}
                        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      Include screenshot
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={options.removeBase64Images}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: ScrapeOptions) => ({ ...prev, removeBase64Images: e.target.checked }))}
                        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      Remove base64 images
                    </label>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Wait for content (ms)
                    </label>
                    <input
                      type="number"
                      value={options.waitFor}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: ScrapeOptions) => ({ ...prev, waitFor: parseInt(e.target.value) || 0 }))}
                      min="0"
                      max="10000"
                      step="100"
                      className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100"
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Progress Tracker */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ProgressTracker
              steps={progressSteps}
              title="Scraping in progress"
              subtitle={url}
            />
          </motion.div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Metadata */}
            {result.metadata && (
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Page Metadata</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Title</p>
                    <p className="text-gray-200 mt-1">{result.metadata.title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Description</p>
                    <p className="text-gray-200 mt-1">{result.metadata.description}</p>
                  </div>
                  {result.metadata.ogImage && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-400 mb-2">Open Graph Image</p>
                      <Image 
                        src={result.metadata.ogImage} 
                        alt="Open Graph image preview"
                        width={400}
                        height={200}
                        className="rounded-lg border border-gray-700 max-h-48 object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content */}
            <ResultViewer
              content={result.markdown || result.html || ''}
              format={result.markdown ? 'markdown' : 'html'}
              title="Scraped Content"
            />

            {/* Links */}
            {result.links && result.links.length > 0 && (
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">
                  Found Links ({result.links.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {result.links.map((link, index) => (
                    <a
                      key={index}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                    >
                      <Globe className="h-3 w-3" />
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}