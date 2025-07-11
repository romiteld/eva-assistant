'use client'

import React from 'react'
import { Database, Clock, AlertTriangle, Search, Filter } from 'lucide-react'
import { useDatabaseTracking } from '@/hooks/useMetrics'
import { metricsCollector } from '@/lib/monitoring/metrics'

interface QueryLog {
  query: string
  duration: number
  rowCount: number
  timestamp: number
  error?: string
}

export function DatabaseQueryMonitor() {
  const { trackQuery } = useDatabaseTracking()
  const [queries, setQueries] = React.useState<QueryLog[]>([])
  const [filter, setFilter] = React.useState('')
  const [showSlowOnly, setShowSlowOnly] = React.useState(false)
  const [selectedQuery, setSelectedQuery] = React.useState<QueryLog | null>(null)

  React.useEffect(() => {
    const updateQueries = () => {
      const dbMetrics = metricsCollector.getDatabaseMetrics()
      setQueries(dbMetrics.map(m => ({
        query: m.query,
        duration: m.duration,
        rowCount: m.rowCount,
        timestamp: m.timestamp,
        error: m.error
      })).reverse()) // Show newest first
    }

    updateQueries()
    const interval = setInterval(updateQueries, 2000)
    return () => clearInterval(interval)
  }, [])

  const filteredQueries = React.useMemo(() => {
    let filtered = queries

    if (filter) {
      filtered = filtered.filter(q => 
        q.query.toLowerCase().includes(filter.toLowerCase())
      )
    }

    if (showSlowOnly) {
      filtered = filtered.filter(q => q.duration > 1000) // > 1 second
    }

    return filtered
  }, [queries, filter, showSlowOnly])

  const stats = React.useMemo(() => {
    if (queries.length === 0) {
      return {
        total: 0,
        avgDuration: 0,
        slowest: 0,
        fastest: 0,
        errorCount: 0
      }
    }

    const durations = queries.map(q => q.duration)
    const errors = queries.filter(q => q.error).length

    return {
      total: queries.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      slowest: Math.max(...durations),
      fastest: Math.min(...durations),
      errorCount: errors
    }
  }, [queries])

  const formatDuration = (ms: number) => {
    if (ms < 1) return '<1ms'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatQuery = (query: string) => {
    // Truncate long queries
    if (query.length > 100) {
      return query.substring(0, 100) + '...'
    }
    return query
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  // Simulate some queries for demo
  React.useEffect(() => {
    const queries = [
      { query: 'SELECT * FROM users WHERE id = $1', duration: 23, rowCount: 1 },
      { query: 'SELECT COUNT(*) FROM tasks WHERE user_id = $1', duration: 45, rowCount: 1 },
      { query: 'UPDATE users SET last_login = NOW() WHERE id = $1', duration: 67, rowCount: 1 },
      { query: 'SELECT * FROM documents WHERE created_at > $1 ORDER BY created_at DESC LIMIT 10', duration: 1234, rowCount: 10 },
      { query: 'INSERT INTO error_logs (message, severity, timestamp) VALUES ($1, $2, $3)', duration: 89, rowCount: 1 }
    ]

    // Add a query every 5 seconds
    const interval = setInterval(() => {
      const query = queries[Math.floor(Math.random() * queries.length)]
      trackQuery(
        query.query,
        query.duration + Math.random() * 100,
        query.rowCount,
        Math.random() > 0.95 ? 'Connection timeout' : undefined
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [trackQuery])

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Database Query Monitor</h3>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={showSlowOnly}
              onChange={(e) => setShowSlowOnly(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
            />
            Slow queries only
          </label>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="p-3 bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500">Total Queries</p>
          <p className="text-lg font-semibold text-gray-100">{stats.total}</p>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500">Avg Duration</p>
          <p className="text-lg font-semibold text-gray-100">{formatDuration(stats.avgDuration)}</p>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500">Fastest</p>
          <p className="text-lg font-semibold text-green-500">{formatDuration(stats.fastest)}</p>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500">Slowest</p>
          <p className="text-lg font-semibold text-yellow-500">{formatDuration(stats.slowest)}</p>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500">Errors</p>
          <p className={`text-lg font-semibold ${stats.errorCount > 0 ? 'text-red-500' : 'text-gray-100'}`}>
            {stats.errorCount}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter queries..."
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500"
        />
      </div>

      {/* Query List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredQueries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {filter || showSlowOnly ? 'No queries match the current filter' : 'No queries recorded yet'}
          </div>
        ) : (
          filteredQueries.map((query, index) => (
            <div
              key={`${query.timestamp}-${index}`}
              className={`p-3 rounded-lg border transition-all cursor-pointer hover:border-gray-600 ${
                query.error
                  ? 'bg-red-900/10 border-red-900/50'
                  : query.duration > 1000
                  ? 'bg-yellow-900/10 border-yellow-900/50'
                  : 'bg-gray-800 border-gray-700'
              } ${selectedQuery === query ? 'ring-2 ring-primary-500' : ''}`}
              onClick={() => setSelectedQuery(query === selectedQuery ? null : query)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-gray-100 truncate">
                    {formatQuery(query.query)}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className={`flex items-center gap-1 ${
                      query.duration > 1000 ? 'text-yellow-500' : 'text-gray-500'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {formatDuration(query.duration)}
                    </span>
                    
                    <span className="text-gray-500">
                      {query.rowCount} row{query.rowCount !== 1 ? 's' : ''}
                    </span>
                    
                    <span className="text-gray-500">
                      {formatTimestamp(query.timestamp)}
                    </span>
                    
                    {query.error && (
                      <span className="flex items-center gap-1 text-red-500">
                        <AlertTriangle className="w-3 h-3" />
                        Error
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {selectedQuery === query && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="font-mono text-xs text-gray-400 whitespace-pre-wrap break-all">
                    {query.query}
                  </p>
                  {query.error && (
                    <p className="mt-2 text-sm text-red-500">
                      Error: {query.error}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}