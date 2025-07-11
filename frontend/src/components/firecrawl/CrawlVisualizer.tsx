'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Globe, 
  Link2, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  FileText,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Search,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CrawlNode {
  url: string
  title?: string
  status: 'pending' | 'crawling' | 'completed' | 'error'
  depth: number
  pageCount?: number
  error?: string
  children?: CrawlNode[]
}

interface CrawlVisualizerProps {
  nodes: CrawlNode[]
  maxDepth?: number
  onNodeClick?: (node: CrawlNode) => void
  className?: string
}

export function CrawlVisualizer({
  nodes,
  maxDepth = 3,
  onNodeClick,
  className,
}: CrawlVisualizerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<CrawlNode['status'] | 'all'>('all')

  useEffect(() => {
    // Auto-expand nodes that are being crawled
    const crawlingNodes = findNodesByStatus(nodes, 'crawling')
    crawlingNodes.forEach(node => {
      setExpandedNodes(prev => new Set([...prev, node.url]))
    })
  }, [nodes])

  const findNodesByStatus = (nodes: CrawlNode[], status: CrawlNode['status']): CrawlNode[] => {
    const result: CrawlNode[] = []
    
    const traverse = (nodes: CrawlNode[]) => {
      nodes.forEach(node => {
        if (node.status === status) {
          result.push(node)
        }
        if (node.children) {
          traverse(node.children)
        }
      })
    }
    
    traverse(nodes)
    return result
  }

  const filterNodes = (nodes: CrawlNode[]): CrawlNode[] => {
    return nodes
      .filter(node => {
        const matchesSearch = !searchQuery || 
          node.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.title?.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesStatus = filterStatus === 'all' || node.status === filterStatus
        
        return matchesSearch && matchesStatus
      })
      .map(node => ({
        ...node,
        children: node.children ? filterNodes(node.children) : undefined,
      }))
  }

  const toggleExpanded = (url: string) => {
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

  const getStatusIcon = (status: CrawlNode['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'crawling':
        return <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Globe className="h-4 w-4 text-gray-500" />
    }
  }

  const getDepthColor = (depth: number) => {
    const colors = [
      'border-purple-500/50 bg-purple-500/5',
      'border-blue-500/50 bg-blue-500/5',
      'border-green-500/50 bg-green-500/5',
      'border-orange-500/50 bg-orange-500/5',
    ]
    return colors[depth % colors.length]
  }

  const renderNode = (node: CrawlNode, isLast = false, parentPath = '') => {
    const isExpanded = expandedNodes.has(node.url)
    const hasChildren = node.children && node.children.length > 0
    const path = parentPath + (isLast ? '└' : '├')

    return (
      <motion.div
        key={node.url}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="relative"
      >
        <div className="flex items-center gap-2 py-1">
          {parentPath && (
            <span className="text-gray-600 font-mono text-sm select-none">
              {path}{'─'}
            </span>
          )}
          
          <motion.div
            className={cn(
              'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all',
              getDepthColor(node.depth),
              'hover:shadow-lg hover:shadow-purple-500/10'
            )}
            onClick={() => {
              if (hasChildren) toggleExpanded(node.url)
              if (onNodeClick) onNodeClick(node)
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpanded(node.url)
                }}
                className="p-0.5 hover:bg-white/10 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </button>
            )}
            
            {getStatusIcon(node.status)}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {node.title || new URL(node.url).pathname || '/'}
                </p>
                {node.pageCount !== undefined && (
                  <span className="text-xs text-gray-500">
                    ({node.pageCount} pages)
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{node.url}</p>
            </div>

            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-gray-400 hover:text-gray-300 hover:bg-white/10 rounded transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </motion.div>
        </div>

        {node.error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="ml-8 mt-1 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400"
          >
            {node.error}
          </motion.div>
        )}

        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="ml-6"
            >
              {node.children!.map((child, index) => 
                renderNode(
                  child, 
                  index === node.children!.length - 1,
                  parentPath + (isLast ? '  ' : '│ ')
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  const filteredNodes = filterNodes(nodes)
  const stats = {
    total: nodes.length,
    completed: findNodesByStatus(nodes, 'completed').length,
    crawling: findNodesByStatus(nodes, 'crawling').length,
    error: findNodesByStatus(nodes, 'error').length,
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-100">Crawl Progress</h3>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-gray-300">{stats.completed}</span>
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
              <span className="text-gray-300">{stats.crawling}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-gray-300">{stats.error}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search URLs..."
              className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="crawling">Crawling</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Tree View */}
      <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg overflow-auto max-h-[600px]">
        <AnimatePresence>
          {filteredNodes.length > 0 ? (
            filteredNodes.map((node, index) => 
              renderNode(node, index === filteredNodes.length - 1)
            )
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-gray-500"
            >
              {searchQuery || filterStatus !== 'all' 
                ? 'No matching URLs found'
                : 'No crawl data yet'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}