'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  ArrowLeft, 
  Search, 
  Settings,
  Globe,
  Calendar,
  MapPin,
  Filter,
  ExternalLink,
  FileText,
  ChevronDown,
  Sparkles
} from 'lucide-react'
import { ResultViewer } from '@/components/firecrawl/ResultViewer'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface SearchOptions {
  limit: number
  lang: string
  country: string
  tbs?: string
  scrapeContent: boolean
  onlyMainContent: boolean
}

interface SearchResult {
  title: string
  url: string
  description: string
  favicon?: string
  publishedDate?: string
  content?: string
}

export default function SearchPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [showOptions, setShowOptions] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [options, setOptions] = useState<SearchOptions>({
    limit: 10,
    lang: 'en',
    country: 'us',
    scrapeContent: true,
    onlyMainContent: true,
  })

  const timeFilters = [
    { value: '', label: 'Any time' },
    { value: 'h', label: 'Past hour' },
    { value: 'd', label: 'Past 24 hours' },
    { value: 'w', label: 'Past week' },
    { value: 'm', label: 'Past month' },
    { value: 'y', label: 'Past year' },
  ]

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' },
  ]

  const countries = [
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' },
    { value: 'au', label: 'Australia' },
    { value: 'de', label: 'Germany' },
    { value: 'fr', label: 'France' },
  ]

  const handleSearch = async () => {
    if (!query) return

    setIsLoading(true)
    setResults([])
    setSelectedResult(null)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Mock results
      const mockResults: SearchResult[] = [
        {
          title: 'Understanding AI in Recruiting - Complete Guide 2024',
          url: 'https://example.com/ai-recruiting-guide',
          description: 'Learn how artificial intelligence is transforming the recruiting industry. Comprehensive guide covering AI tools, best practices, and implementation strategies for modern recruiters.',
          favicon: 'https://example.com/favicon.ico',
          publishedDate: '2024-01-15',
          content: options.scrapeContent ? '# Understanding AI in Recruiting\n\nArtificial intelligence is revolutionizing how companies find and hire talent...' : undefined,
        },
        {
          title: 'Top 10 AI Recruiting Tools for 2024',
          url: 'https://example.com/ai-tools-list',
          description: 'Discover the best AI-powered recruiting tools that can help streamline your hiring process. Detailed comparison of features, pricing, and use cases.',
          favicon: 'https://example.com/favicon.ico',
          publishedDate: '2024-01-10',
          content: options.scrapeContent ? '# Top AI Recruiting Tools\n\n1. Tool A - Best for enterprise\n2. Tool B - Best for startups...' : undefined,
        },
        {
          title: 'How AI is Changing Financial Advisor Recruiting',
          url: 'https://example.com/financial-advisor-ai',
          description: 'Explore the specific applications of AI in financial advisor recruiting. Case studies and success stories from leading firms.',
          publishedDate: '2024-01-05',
        },
      ]

      // Add more results based on limit
      const additionalResults = Array.from({ length: Math.min(options.limit - 3, 7) }, (_, i) => ({
        title: `Search Result ${i + 4}: ${query}`,
        url: `https://example.com/result-${i + 4}`,
        description: `This is a sample search result for "${query}". It contains relevant information about the topic you searched for.`,
        publishedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }))

      setResults([...mockResults, ...additionalResults].slice(0, options.limit))
      toast({
        title: `Found ${options.limit} results`,
        variant: 'success'
      })
    } catch (error) {
      toast({
        title: 'Search failed',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

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
              <h1 className="text-2xl font-bold text-gray-100">Web Search</h1>
              <p className="text-sm text-gray-400 mt-1">
                Search the web and extract relevant content with AI
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
        >
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Search for anything..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={!query || isLoading}
                className={cn(
                  'px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2',
                  query && !isLoading
                    ? 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-lg hover:shadow-purple-500/25'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                )}
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </div>

            {/* Options */}
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Search Options
              <ChevronDown className={cn(
                'h-4 w-4 transition-transform',
                showOptions && 'rotate-180'
              )} />
            </button>

            <AnimatePresence>
              {showOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-4 border-t border-gray-700"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-300 mb-2 block">
                        Results Limit
                      </label>
                      <input
                        type="number"
                        value={options.limit}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: SearchOptions) => ({ ...prev, limit: parseInt(e.target.value) || 10 }))}
                        min="1"
                        max="50"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Language
                      </label>
                      <select
                        value={options.lang}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOptions((prev: SearchOptions) => ({ ...prev, lang: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
                      >
                        {languages.map(lang => (
                          <option key={lang.value} value={lang.value}>
                            {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Country
                      </label>
                      <select
                        value={options.country}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOptions((prev: SearchOptions) => ({ ...prev, country: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
                      >
                        {countries.map(country => (
                          <option key={country.value} value={country.value}>
                            {country.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Time Filter
                    </label>
                    <div className="flex gap-2">
                      {timeFilters.map(filter => (
                        <button
                          key={filter.value}
                          onClick={() => setOptions(prev => ({ ...prev, tbs: filter.value }))}
                          className={cn(
                            'px-3 py-1.5 text-sm rounded-lg transition-colors',
                            options.tbs === filter.value
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                          )}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={options.scrapeContent}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: SearchOptions) => ({ ...prev, scrapeContent: e.target.checked }))}
                        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      Scrape page content
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={options.onlyMainContent}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: SearchOptions) => ({ ...prev, onlyMainContent: e.target.checked }))}
                        disabled={!options.scrapeContent}
                        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 disabled:opacity-50"
                      />
                      Extract main content only
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Results */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search Results List */}
          <div className="lg:col-span-2 space-y-4">
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Search className="h-12 w-12 text-purple-500 mx-auto mb-4 animate-pulse" />
                <p className="text-gray-400">Searching the web...</p>
              </motion.div>
            )}

            {!isLoading && results.length > 0 && (
              <AnimatePresence>
                {results.map((result, index) => (
                  <motion.div
                    key={result.url}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setSelectedResult(result)}
                    className={cn(
                      'bg-gray-900/50 border border-gray-700 rounded-lg p-6 cursor-pointer transition-all hover:border-gray-600 hover:shadow-lg hover:shadow-purple-500/10',
                      selectedResult?.url === result.url && 'border-purple-500/50 bg-purple-500/5'
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-100 line-clamp-2">
                            {result.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {result.favicon && (
                              <Image src={result.favicon} alt="Site favicon" width={16} height={16} className="h-4 w-4" />
                            )}
                            <p className="text-sm text-green-400 truncate">
                              {new URL(result.url).hostname}
                            </p>
                            {result.publishedDate && (
                              <>
                                <span className="text-gray-600">•</span>
                                <p className="text-sm text-gray-500">
                                  {new Date(result.publishedDate).toLocaleDateString()}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {result.description}
                      </p>
                      {result.content && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-purple-400">
                          <FileText className="h-3 w-3" />
                          Content scraped
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {!isLoading && query && results.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Search className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No results found for &quot;{query}&quot;</p>
                <p className="text-sm text-gray-500 mt-2">
                  Try different keywords or adjust your search filters
                </p>
              </motion.div>
            )}

            {!query && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Sparkles className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                <p className="text-gray-400">Start searching to see results</p>
                <p className="text-sm text-gray-500 mt-2">
                  Enter your query above and we&apos;ll search the web for you
                </p>
              </motion.div>
            )}
          </div>

          {/* Content Preview */}
          <div className="lg:col-span-1">
            {selectedResult?.content && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="sticky top-6"
              >
                <ResultViewer
                  content={selectedResult.content}
                  format="markdown"
                  title={selectedResult.title}
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}