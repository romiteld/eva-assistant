'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Globe, 
  Settings,
  Play,
  Pause,
  Square as Stop,
  Download,
  Filter,
  FolderTree,
  Link2,
  AlertCircle
} from 'lucide-react'
import { UrlInput } from '@/components/firecrawl/UrlInput'
import { CrawlVisualizer } from '@/components/firecrawl/CrawlVisualizer'
import { ProgressTracker, type ProgressStep } from '@/components/firecrawl/ProgressTracker'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface CrawlOptions {
  maxDepth: number
  limit: number
  allowBackwardLinks: boolean
  allowExternalLinks: boolean
  ignoreSitemap: boolean
  includePaths: string[]
  excludePaths: string[]
}

interface CrawlStatus {
  status: 'idle' | 'starting' | 'crawling' | 'paused' | 'completed' | 'error'
  crawlId?: string
  progress: number
  pagesFound: number
  pagesCrawled: number
  errors: number
  startTime?: Date
  estimatedTime?: number
}

interface CrawlNode {
  url: string
  title: string
  status: 'pending' | 'crawling' | 'completed' | 'error'
  depth: number
  children: CrawlNode[]
}

export default function CrawlPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus>({
    status: 'idle',
    progress: 0,
    pagesFound: 0,
    pagesCrawled: 0,
    errors: 0,
  })
  const [options, setOptions] = useState<CrawlOptions>({
    maxDepth: 3,
    limit: 100,
    allowBackwardLinks: true,
    allowExternalLinks: false,
    ignoreSitemap: false,
    includePaths: [],
    excludePaths: [],
  })
  const [crawlNodes, setCrawlNodes] = useState<CrawlNode[]>([])
  const [newPath, setNewPath] = useState('')
  const [pathType, setPathType] = useState<'include' | 'exclude'>('include')

  // Simulate crawl progress
  useEffect(() => {
    if (crawlStatus.status === 'crawling') {
      const interval = setInterval(() => {
        setCrawlStatus(prev => {
          if (prev.progress >= 100) {
            return { ...prev, status: 'completed', progress: 100 }
          }
          
          const newProgress = Math.min(prev.progress + Math.random() * 10, 100)
          const newPagesCrawled = Math.floor((newProgress / 100) * prev.pagesFound)
          
          // Simulate finding new pages
          const newPagesFound = prev.pagesFound + (Math.random() > 0.7 ? Math.floor(Math.random() * 5) : 0)
          
          return {
            ...prev,
            progress: newProgress,
            pagesCrawled: newPagesCrawled,
            pagesFound: newPagesFound,
            errors: prev.errors + (Math.random() > 0.9 ? 1 : 0),
          }
        })

        // Simulate adding nodes to visualization
        if (Math.random() > 0.5) {
          setCrawlNodes(prev => {
            // Mock node update logic
            return prev
          })
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [crawlStatus.status])

  const handleStartCrawl = async () => {
    if (!url) return

    setCrawlStatus({
      status: 'starting',
      progress: 0,
      pagesFound: 1,
      pagesCrawled: 0,
      errors: 0,
      startTime: new Date(),
      crawlId: `crawl_${Date.now()}`,
    })

    // Simulate crawl start
    setTimeout(() => {
      setCrawlStatus(prev => ({ ...prev, status: 'crawling' }))
      setCrawlNodes([
        {
          url,
          title: new URL(url).hostname,
          status: 'crawling',
          depth: 0,
          children: [],
        }
      ])
      toast({
        title: 'Crawl started successfully!',
        variant: 'success'
      })
    }, 1500)
  }

  const handlePauseCrawl = () => {
    setCrawlStatus(prev => ({ ...prev, status: 'paused' }))
    toast({
      title: 'Crawl paused'
    })
  }

  const handleResumeCrawl = () => {
    setCrawlStatus(prev => ({ ...prev, status: 'crawling' }))
    toast({
      title: 'Crawl resumed'
    })
  }

  const handleStopCrawl = () => {
    setCrawlStatus({
      status: 'idle',
      progress: 0,
      pagesFound: 0,
      pagesCrawled: 0,
      errors: 0,
    })
    setCrawlNodes([])
    toast({
      title: 'Crawl stopped'
    })
  }

  const addPath = () => {
    if (!newPath) return
    
    if (pathType === 'include') {
      setOptions(prev => ({
        ...prev,
        includePaths: [...prev.includePaths, newPath]
      }))
    } else {
      setOptions(prev => ({
        ...prev,
        excludePaths: [...prev.excludePaths, newPath]
      }))
    }
    setNewPath('')
  }

  const removePath = (path: string, type: 'include' | 'exclude') => {
    if (type === 'include') {
      setOptions(prev => ({
        ...prev,
        includePaths: prev.includePaths.filter(p => p !== path)
      }))
    } else {
      setOptions(prev => ({
        ...prev,
        excludePaths: prev.excludePaths.filter(p => p !== path)
      }))
    }
  }

  const progressSteps: ProgressStep[] = [
    { 
      id: 'init', 
      label: 'Initializing crawler', 
      status: crawlStatus.status === 'idle' ? 'pending' : 'completed'
    },
    { 
      id: 'sitemap', 
      label: 'Checking sitemap', 
      status: crawlStatus.status === 'starting' ? 'active' : 
              crawlStatus.status !== 'idle' ? 'completed' : 'pending',
      message: options.ignoreSitemap ? 'Skipped' : undefined
    },
    { 
      id: 'crawl', 
      label: 'Crawling pages', 
      status: crawlStatus.status === 'crawling' ? 'active' : 
              crawlStatus.status === 'completed' ? 'completed' : 'pending',
      progress: crawlStatus.status === 'crawling' ? crawlStatus.progress : undefined
    },
  ]

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
              <h1 className="text-2xl font-bold text-gray-100">Website Crawling</h1>
              <p className="text-sm text-gray-400 mt-1">
                Deep crawl entire websites with progress tracking
              </p>
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* URL Input */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
            >
              <UrlInput
                value={url}
                onChange={setUrl}
                label="Website URL"
                placeholder="https://example.com"
                disabled={crawlStatus.status !== 'idle'}
              />

              <div className="mt-4 flex gap-2">
                {crawlStatus.status === 'idle' && (
                  <button
                    onClick={handleStartCrawl}
                    disabled={!url}
                    className={cn(
                      'flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                      url
                        ? 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-lg hover:shadow-purple-500/25'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    )}
                  >
                    <Play className="h-4 w-4" />
                    Start Crawl
                  </button>
                )}
                
                {crawlStatus.status === 'crawling' && (
                  <>
                    <button
                      onClick={handlePauseCrawl}
                      className="flex-1 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg font-medium hover:bg-yellow-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </button>
                    <button
                      onClick={handleStopCrawl}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg font-medium hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Stop className="h-4 w-4" />
                      Stop
                    </button>
                  </>
                )}
                
                {crawlStatus.status === 'paused' && (
                  <>
                    <button
                      onClick={handleResumeCrawl}
                      className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg font-medium hover:bg-green-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Resume
                    </button>
                    <button
                      onClick={handleStopCrawl}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg font-medium hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Stop className="h-4 w-4" />
                      Stop
                    </button>
                  </>
                )}
                
                {crawlStatus.status === 'completed' && (
                  <>
                    <button
                      onClick={() => toast({
                        title: 'Download started',
                        variant: 'success'
                      })}
                      className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg font-medium hover:bg-green-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download Results
                    </button>
                    <button
                      onClick={handleStopCrawl}
                      className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg font-medium hover:bg-gray-700 transition-all"
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>
            </motion.div>

            {/* Options */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg"
            >
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="w-full px-6 py-4 flex items-center justify-between text-gray-300 hover:text-gray-100 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Crawl Options
                </span>
                <motion.div
                  animate={{ rotate: showOptions ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Filter className="h-4 w-4" />
                </motion.div>
              </button>

              {showOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-6 space-y-4 border-t border-gray-700"
                >
                  {/* Depth and Limit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Max Depth</label>
                      <input
                        type="number"
                        value={options.maxDepth}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: CrawlOptions) => ({ ...prev, maxDepth: parseInt(e.target.value) || 1 }))}
                        min="1"
                        max="10"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Page Limit</label>
                      <input
                        type="number"
                        value={options.limit}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: CrawlOptions) => ({ ...prev, limit: parseInt(e.target.value) || 1 }))}
                        min="1"
                        max="10000"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100"
                      />
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={options.allowBackwardLinks}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: CrawlOptions) => ({ ...prev, allowBackwardLinks: e.target.checked }))}
                        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      Allow backward links
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={options.allowExternalLinks}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: CrawlOptions) => ({ ...prev, allowExternalLinks: e.target.checked }))}
                        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      Allow external links
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={options.ignoreSitemap}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: CrawlOptions) => ({ ...prev, ignoreSitemap: e.target.checked }))}
                        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      Ignore sitemap
                    </label>
                  </div>

                  {/* Path Filters */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Path Filters</label>
                      <div className="flex gap-2">
                        <select
                          value={pathType}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPathType(e.target.value as 'include' | 'exclude')}
                          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
                        >
                          <option value="include">Include</option>
                          <option value="exclude">Exclude</option>
                        </select>
                        <input
                          type="text"
                          value={newPath}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPath(e.target.value)}
                          placeholder="/blog/*"
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500"
                        />
                        <button
                          onClick={addPath}
                          disabled={!newPath}
                          className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Include Paths */}
                    {options.includePaths.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Include paths:</p>
                        <div className="space-y-1">
                          {options.includePaths.map(path => (
                            <div key={path} className="flex items-center justify-between text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded">
                              <span>{path}</span>
                              <button
                                onClick={() => removePath(path, 'include')}
                                className="text-green-500 hover:text-green-600"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exclude Paths */}
                    {options.excludePaths.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Exclude paths:</p>
                        <div className="space-y-1">
                          {options.excludePaths.map(path => (
                            <div key={path} className="flex items-center justify-between text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded">
                              <span>{path}</span>
                              <button
                                onClick={() => removePath(path, 'exclude')}
                                className="text-red-500 hover:text-red-600"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Progress Tracker */}
            {crawlStatus.status !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <ProgressTracker
                  steps={progressSteps}
                  title="Crawl Progress"
                  subtitle={`${crawlStatus.pagesCrawled} of ${crawlStatus.pagesFound} pages`}
                />
              </motion.div>
            )}

            {/* Stats */}
            {crawlStatus.status !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
              >
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Crawl Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Pages Found</span>
                    <span className="text-gray-200 font-medium">{crawlStatus.pagesFound}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Pages Crawled</span>
                    <span className="text-gray-200 font-medium">{crawlStatus.pagesCrawled}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Errors</span>
                    <span className={cn(
                      'font-medium',
                      crawlStatus.errors > 0 ? 'text-red-400' : 'text-gray-200'
                    )}>{crawlStatus.errors}</span>
                  </div>
                  {crawlStatus.startTime && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Duration</span>
                      <span className="text-gray-200 font-medium">
                        {Math.floor((Date.now() - crawlStatus.startTime.getTime()) / 1000)}s
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Visualization */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            {crawlStatus.status === 'idle' ? (
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-12">
                <div className="text-center">
                  <FolderTree className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">
                    No Active Crawl
                  </h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Enter a URL and configure your crawl settings to begin. The visualization will show the site structure as pages are discovered.
                  </p>
                </div>
              </div>
            ) : (
              <CrawlVisualizer
                nodes={crawlNodes}
                maxDepth={options.maxDepth}
                onNodeClick={(node) => {
                  toast({
                    title: `Clicked: ${node.url}`
                  })
                }}
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}