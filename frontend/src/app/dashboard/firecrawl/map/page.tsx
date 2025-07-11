'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Map, 
  Settings,
  Play,
  Download,
  Copy,
  Check,
  Filter,
  Search,
  ExternalLink,
  FolderTree as FileTree,
  Globe,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { UrlInput } from '@/components/firecrawl/UrlInput'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface MapOptions {
  includeSubdomains: boolean
  sitemapOnly: boolean
  ignoreSitemap: boolean
  limit: number
  search?: string
}

interface SiteMapNode {
  url: string
  path: string
  depth: number
  children: SiteMapNode[]
}

interface MapResult {
  urls: string[]
  tree: SiteMapNode
  totalPages: number
  domains: string[]
  timestamp: Date
}

export default function MapPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<MapResult | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [options, setOptions] = useState<MapOptions>({
    includeSubdomains: false,
    sitemapOnly: false,
    ignoreSitemap: false,
    limit: 1000,
  })
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const handleMap = async () => {
    if (!url) return

    setIsLoading(true)
    setResult(null)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Mock result
      const mockTree: SiteMapNode = {
        url,
        path: '/',
        depth: 0,
        children: [
          {
            url: `${url}/about`,
            path: '/about',
            depth: 1,
            children: [
              { url: `${url}/about/team`, path: '/about/team', depth: 2, children: [] },
              { url: `${url}/about/mission`, path: '/about/mission', depth: 2, children: [] },
            ]
          },
          {
            url: `${url}/products`,
            path: '/products',
            depth: 1,
            children: [
              { url: `${url}/products/software`, path: '/products/software', depth: 2, children: [] },
              { url: `${url}/products/hardware`, path: '/products/hardware', depth: 2, children: [] },
            ]
          },
          {
            url: `${url}/blog`,
            path: '/blog',
            depth: 1,
            children: [
              { url: `${url}/blog/post-1`, path: '/blog/post-1', depth: 2, children: [] },
              { url: `${url}/blog/post-2`, path: '/blog/post-2', depth: 2, children: [] },
              { url: `${url}/blog/post-3`, path: '/blog/post-3', depth: 2, children: [] },
            ]
          },
        ]
      }

      const allUrls = extractUrls(mockTree)
      
      setResult({
        urls: allUrls,
        tree: mockTree,
        totalPages: allUrls.length,
        domains: [new URL(url).hostname],
        timestamp: new Date(),
      })

      // Auto-expand root
      setExpandedNodes(new Set([url]))
      
      toast({
        title: `Found ${allUrls.length} pages!`,
        variant: 'success'
      })
    } catch (error) {
      toast({
        title: 'Failed to map website',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const extractUrls = (node: SiteMapNode): string[] => {
    const urls = [node.url]
    node.children.forEach(child => {
      urls.push(...extractUrls(child))
    })
    return urls
  }

  const toggleNode = (url: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return next
    })
  }

  const renderTreeNode = (node: SiteMapNode, isLast = false, parentPath = '') => {
    const isExpanded = expandedNodes.has(node.url)
    const hasChildren = node.children.length > 0
    const matchesSearch = !searchQuery || 
      node.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.path.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch && !hasChildren) return null

    const depthColors = [
      'text-purple-400',
      'text-blue-400',
      'text-green-400',
      'text-orange-400',
    ]

    return (
      <motion.div
        key={node.url}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative"
      >
        <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-800/50 rounded group">
          {parentPath && (
            <span className="text-gray-600 font-mono text-sm select-none">
              {parentPath}{isLast ? '└' : '├'}{'─'}
            </span>
          )}
          
          {hasChildren && (
            <button
              onClick={() => toggleNode(node.url)}
              className="p-0.5 hover:bg-gray-700 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
          )}
          
          <Globe className={cn('h-4 w-4', depthColors[node.depth % depthColors.length])} />
          
          <span className="flex-1 text-sm text-gray-300 truncate">
            {node.path}
          </span>
          
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-300 transition-all"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="ml-4"
            >
              {node.children.map((child, index) => 
                renderTreeNode(
                  child, 
                  index === node.children.length - 1,
                  parentPath + (isLast ? '  ' : '│ ')
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  const handleCopyUrls = async () => {
    if (!result) return
    
    const text = result.urls.join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({
      title: 'URLs copied to clipboard!',
      variant: 'success'
    })
  }

  const handleDownload = () => {
    if (!result) return
    
    const content = JSON.stringify({
      site: url,
      timestamp: result.timestamp,
      totalPages: result.totalPages,
      urls: result.urls,
      tree: result.tree,
    }, null, 2)
    
    const blob = new Blob([content], { type: 'application/json' })
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `sitemap-${new URL(result.tree.url).hostname}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)
  }

  const filteredUrls = result ? result.urls.filter(url => 
    !searchQuery || url.toLowerCase().includes(searchQuery.toLowerCase())
  ) : []

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
              <h1 className="text-2xl font-bold text-gray-100">Sitemap Generation</h1>
              <p className="text-sm text-gray-400 mt-1">
                Discover and visualize all pages on a website
              </p>
            </div>
          </div>
        </motion.div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
        >
          <div className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <UrlInput
                  value={url}
                  onChange={setUrl}
                  onSubmit={handleMap}
                  label="Website URL"
                  placeholder="https://example.com"
                />
              </div>
              <button
                onClick={handleMap}
                disabled={!url || isLoading}
                className={cn(
                  'px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2',
                  url && !isLoading
                    ? 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-lg hover:shadow-purple-500/25'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                )}
              >
                <Play className="h-4 w-4" />
                {isLoading ? 'Mapping...' : 'Map Site'}
              </button>
            </div>

            {/* Options */}
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Mapping Options
            </button>

            {showOptions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 pt-4 border-t border-gray-700"
              >
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={options.includeSubdomains}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeSubdomains: e.target.checked }))}
                      className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                    />
                    Include subdomains
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={options.sitemapOnly}
                      onChange={(e) => setOptions(prev => ({ ...prev, sitemapOnly: e.target.checked }))}
                      className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                    />
                    Sitemap only
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={options.ignoreSitemap}
                      onChange={(e) => setOptions(prev => ({ ...prev, ignoreSitemap: e.target.checked }))}
                      className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                    />
                    Ignore sitemap
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    URL Limit
                  </label>
                  <input
                    type="number"
                    value={options.limit}
                    onChange={(e) => setOptions(prev => ({ ...prev, limit: parseInt(e.target.value) || 100 }))}
                    min="1"
                    max="10000"
                    className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100"
                  />
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Results */}
        {result && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Stats Bar */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-gray-400">Total Pages</p>
                    <p className="text-2xl font-bold text-gray-100">{result.totalPages}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Domains</p>
                    <p className="text-2xl font-bold text-gray-100">{result.domains.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Generated</p>
                    <p className="text-sm text-gray-300">
                      {result.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyUrls}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
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
                    Copy URLs
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>

            {/* View Controls */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('tree')}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2',
                      viewMode === 'tree'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'text-gray-400 hover:text-gray-300'
                    )}
                  >
                    <FileTree className="h-4 w-4" />
                    Tree View
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2',
                      viewMode === 'list'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'text-gray-400 hover:text-gray-300'
                    )}
                  >
                    <Filter className="h-4 w-4" />
                    List View
                  </button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search URLs..."
                    className="pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500"
                  />
                </div>
              </div>

              <div className="p-4 max-h-[600px] overflow-y-auto">
                {viewMode === 'tree' ? (
                  <div className="font-mono text-sm">
                    {renderTreeNode(result.tree)}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredUrls.map((url, index) => (
                      <motion.div
                        key={url}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.01 }}
                        className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded group"
                      >
                        <span className="text-sm text-gray-300 truncate flex-1">
                          {url}
                        </span>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-300 transition-all"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gray-900/50 border border-gray-700 rounded-lg p-12"
          >
            <div className="text-center">
              <Map className="h-16 w-16 text-purple-500 mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">
                Mapping Website Structure
              </h3>
              <p className="text-sm text-gray-500">
                Discovering pages and building sitemap...
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}