'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  Globe, 
  Search, 
  Map, 
  FileSearch, 
  Database,
  Activity,
  TrendingUp,
  Clock,
  Zap,
  ArrowRight,
  ExternalLink,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Feature {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  stats?: {
    usage: number
    trend: number
  }
}

interface RecentActivity {
  id: string
  type: 'scrape' | 'crawl' | 'map' | 'search' | 'extract'
  url: string
  timestamp: Date
  status: 'success' | 'error' | 'pending'
  resultCount?: number
}

const features: Feature[] = [
  {
    id: 'scrape',
    title: 'URL Scraping',
    description: 'Extract content from any webpage with advanced parsing',
    icon: <Globe className="h-6 w-6" />,
    color: 'from-purple-500 to-pink-500',
    stats: { usage: 1234, trend: 12 }
  },
  {
    id: 'crawl',
    title: 'Website Crawling',
    description: 'Deep crawl entire websites and extract structured data',
    icon: <FileSearch className="h-6 w-6" />,
    color: 'from-blue-500 to-cyan-500',
    stats: { usage: 567, trend: 8 }
  },
  {
    id: 'map',
    title: 'Sitemap Generation',
    description: 'Generate visual sitemaps and discover all pages',
    icon: <Map className="h-6 w-6" />,
    color: 'from-green-500 to-emerald-500',
    stats: { usage: 890, trend: 15 }
  },
  {
    id: 'search',
    title: 'Web Search',
    description: 'Search the web and extract relevant content',
    icon: <Search className="h-6 w-6" />,
    color: 'from-orange-500 to-red-500',
    stats: { usage: 2345, trend: -5 }
  },
  {
    id: 'extract',
    title: 'Data Extraction',
    description: 'Extract structured data using AI-powered schemas',
    icon: <Database className="h-6 w-6" />,
    color: 'from-indigo-500 to-purple-500',
    stats: { usage: 432, trend: 20 }
  }
]

// Mock data - replace with real API calls
const mockRecentActivity: RecentActivity[] = [
  {
    id: '1',
    type: 'scrape',
    url: 'https://example.com/blog/post-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    status: 'success',
    resultCount: 1
  },
  {
    id: '2',
    type: 'crawl',
    url: 'https://docs.example.com',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    status: 'success',
    resultCount: 42
  },
  {
    id: '3',
    type: 'search',
    url: 'AI recruiting trends 2024',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    status: 'success',
    resultCount: 10
  },
  {
    id: '4',
    type: 'extract',
    url: 'https://careers.example.com',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    status: 'error'
  }
]

export default function FirecrawlDashboard() {
  const router = useRouter()
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setActivities(mockRecentActivity)
      setIsLoading(false)
    }, 1000)
  }, [])

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'scrape': return <Globe className="h-4 w-4" />
      case 'crawl': return <FileSearch className="h-4 w-4" />
      case 'map': return <Map className="h-4 w-4" />
      case 'search': return <Search className="h-4 w-4" />
      case 'extract': return <Database className="h-4 w-4" />
    }
  }

  const getActivityColor = (type: RecentActivity['type']) => {
    switch (type) {
      case 'scrape': return 'text-purple-400'
      case 'crawl': return 'text-blue-400'
      case 'map': return 'text-green-400'
      case 'search': return 'text-orange-400'
      case 'extract': return 'text-indigo-400'
    }
  }

  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 1000 / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold text-gray-100">
            Firecrawl Dashboard
          </h1>
          <p className="text-gray-400">
            Extract and analyze web content at scale with AI-powered tools
          </p>
        </motion.div>

        {/* Usage Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Requests</p>
                <p className="text-2xl font-bold text-gray-100 mt-1">5,468</p>
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +12% from last month
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Pages Processed</p>
                <p className="text-2xl font-bold text-gray-100 mt-1">142.3K</p>
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +8% from last month
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg Response Time</p>
                <p className="text-2xl font-bold text-gray-100 mt-1">1.2s</p>
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  -5% from last month
                </p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/dashboard/firecrawl/${feature.id}`)}
              className="group cursor-pointer"
            >
              <div className="relative h-full bg-gray-900/50 border border-gray-700 rounded-lg p-6 overflow-hidden transition-all hover:border-gray-600 hover:shadow-lg hover:shadow-purple-500/10">
                {/* Background Gradient */}
                <div className={cn(
                  'absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity',
                  `bg-gradient-to-br ${feature.color}`
                )} />

                <div className="relative space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={cn(
                      'p-3 rounded-lg bg-gradient-to-br',
                      feature.color
                    )}>
                      {feature.icon}
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-500 group-hover:text-gray-300 transition-colors" />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-100">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {feature.description}
                    </p>
                  </div>

                  {feature.stats && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {feature.stats.usage.toLocaleString()} uses
                      </span>
                      <span className={cn(
                        'flex items-center gap-1',
                        feature.stats.trend > 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        <TrendingUp className="h-3 w-3" />
                        {Math.abs(feature.stats.trend)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/50 border border-gray-700 rounded-lg"
        >
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-gray-100">
              Recent Activity
            </h2>
          </div>
          
          <div className="divide-y divide-gray-700">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                Loading activities...
              </div>
            ) : activities.length > 0 ? (
              activities.map((activity: RecentActivity) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-6 py-4 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn('p-2 rounded-lg bg-gray-800', getActivityColor(activity.type))}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {activity.url}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {activity.resultCount !== undefined && (
                        <span className="text-sm text-gray-400">
                          {activity.resultCount} results
                        </span>
                      )}
                      <span className={cn(
                        'px-2 py-1 text-xs rounded-full',
                        activity.status === 'success' && 'bg-green-500/20 text-green-400',
                        activity.status === 'error' && 'bg-red-500/20 text-red-400',
                        activity.status === 'pending' && 'bg-yellow-500/20 text-yellow-400'
                      )}>
                        {activity.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                No recent activity
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}