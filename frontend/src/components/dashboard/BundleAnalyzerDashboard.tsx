'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Package, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
  Zap,
  FileText,
  Download,
  RefreshCw,
  Target,
  Clock,
  Gauge
} from 'lucide-react'
import { 
  analyzeBundleSize, 
  validateBundleSizes, 
  generatePerformanceReport, 
  measurePerformance,
  BUNDLE_SIZE_LIMITS,
  PERFORMANCE_BENCHMARKS
} from '@/utils/bundle-analyzer'

interface BundleAnalyzerDashboardProps {
  className?: string
}

// Glass card component for consistent styling
function GlassCard({ 
  children, 
  className = "", 
  delay = 0,
  onClick
}: { 
  children: React.ReactNode
  className?: string
  delay?: number
  onClick?: () => void
}) {
  return (
    <motion.div
      className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden cursor-pointer ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

// Performance metric card
function MetricCard({ 
  title, 
  value, 
  change, 
  trend, 
  icon: Icon, 
  delay,
  unit = "KB",
  limit
}: {
  title: string
  value: number
  change?: number
  trend?: 'up' | 'down'
  icon: React.ComponentType<any>
  delay: number
  unit?: string
  limit?: number
}) {
  const isOverLimit = limit && value > limit
  const isNearLimit = limit && value > limit * 0.8
  
  return (
    <GlassCard className="p-6" delay={delay}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <motion.div
            className="flex items-baseline gap-2 mt-1"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.2, type: "spring", stiffness: 200 }}
          >
            <h3 className={`text-3xl font-bold ${
              isOverLimit ? 'text-red-400' : 
              isNearLimit ? 'text-yellow-400' : 'text-white'
            }`}>
              {value.toLocaleString()}
            </h3>
            <span className="text-gray-500 text-sm">{unit}</span>
          </motion.div>
          {limit && (
            <p className="text-xs text-gray-500 mt-1">
              Limit: {limit.toLocaleString()} {unit}
            </p>
          )}
        </div>
        <motion.div 
          className={`p-3 rounded-xl ${
            isOverLimit ? 'bg-red-500/10' : 
            isNearLimit ? 'bg-yellow-500/10' : 'bg-white/5'
          }`}
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.5 }}
        >
          <Icon className={`w-6 h-6 ${
            isOverLimit ? 'text-red-400' : 
            isNearLimit ? 'text-yellow-400' : 'text-purple-400'
          }`} />
        </motion.div>
      </div>
      
      {change !== undefined && trend && (
        <motion.div 
          className="flex items-center gap-2"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: delay + 0.3 }}
        >
          <div className={`flex items-center gap-1 ${
            trend === 'up' ? 'text-red-400' : 'text-green-400'
          }`}>
            {trend === 'up' ? 
              <TrendingUp className="w-4 h-4" /> : 
              <TrendingDown className="w-4 h-4" />
            }
            <span className="text-sm font-medium">{Math.abs(change)}%</span>
          </div>
          <span className="text-gray-500 text-sm">vs last build</span>
        </motion.div>
      )}
    </GlassCard>
  )
}

// Optimization opportunity card
function OptimizationCard({ 
  opportunity, 
  index 
}: { 
  opportunity: any
  index: number 
}) {
  const savingsPercentage = Math.round((opportunity.potentialSavings / opportunity.currentSize) * 100)
  
  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors"
    >
      <div className="p-2 bg-green-500/10 rounded-lg">
        <Target className="w-5 h-5 text-green-400" />
      </div>
      <div className="flex-1">
        <h4 className="text-white font-medium">{opportunity.component}</h4>
        <p className="text-gray-400 text-sm">{opportunity.strategy}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">
            {opportunity.currentSize} KB → {opportunity.currentSize - opportunity.potentialSavings} KB
          </span>
          <span className="text-xs text-green-400 font-medium">
            -{savingsPercentage}%
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// Large page card
function LargePageCard({ 
  page, 
  index 
}: { 
  page: any
  index: number 
}) {
  const isOverLimit = page.size > BUNDLE_SIZE_LIMITS.maxPageSize
  const isNearLimit = page.size > BUNDLE_SIZE_LIMITS.maxPageSize * 0.8
  
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1 }}
      className={`p-4 rounded-xl border ${
        isOverLimit ? 'border-red-500/20 bg-red-500/5' :
        isNearLimit ? 'border-yellow-500/20 bg-yellow-500/5' :
        'border-white/10 bg-white/5'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-white font-medium">{page.page}</h4>
        {isOverLimit && <AlertTriangle className="w-5 h-5 text-red-400" />}
        {isNearLimit && !isOverLimit && <Info className="w-5 h-5 text-yellow-400" />}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Page Size:</span>
          <span className={`text-sm font-medium ${
            isOverLimit ? 'text-red-400' : 
            isNearLimit ? 'text-yellow-400' : 'text-white'
          }`}>
            {page.size} KB
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">First Load:</span>
          <span className="text-white text-sm">{page.firstLoadJS} KB</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
          <div 
            className={`h-2 rounded-full ${
              isOverLimit ? 'bg-red-500' : 
              isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ 
              width: `${Math.min((page.size / BUNDLE_SIZE_LIMITS.maxPageSize) * 100, 100)}%` 
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export function BundleAnalyzerDashboard({ className = "" }: BundleAnalyzerDashboardProps) {
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [performanceData, setPerformanceData] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'pages' | 'optimization'>('overview')

  // Memoized computations
  const analysis = useMemo(() => {
    if (!analysisData) return null
    return analyzeBundleSize()
  }, [analysisData])

  const validation = useMemo(() => {
    if (!analysis) return null
    return validateBundleSizes(analysis)
  }, [analysis])

  const totalPotentialSavings = useMemo(() => {
    if (!analysis) return 0
    return analysis.optimizationOpportunities.reduce((total, opp) => total + opp.potentialSavings, 0)
  }, [analysis])

  // Load initial data
  useEffect(() => {
    refreshData()
  }, [])

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setAnalysisData(Date.now()) // Trigger re-computation
      setPerformanceData(measurePerformance())
    } catch (error) {
      console.error('Failed to refresh data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const downloadReport = () => {
    const report = generatePerformanceReport()
    const blob = new Blob([report], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bundle-analysis-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!analysis || !validation) {
    return (
      <div className={`p-8 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading bundle analysis...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-8 space-y-8 ${className}`}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Bundle Analyzer</h1>
          <p className="text-gray-400">Monitor and optimize your application&apos;s bundle size</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-white">Refresh</span>
          </button>
          <button
            onClick={downloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-white">Download Report</span>
          </button>
        </div>
      </motion.div>

      {/* Status Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className={`p-4 rounded-lg border ${
          validation.passed 
            ? 'border-green-500/20 bg-green-500/5' 
            : 'border-red-500/20 bg-red-500/5'
        }`}
      >
        <div className="flex items-center gap-3">
          {validation.passed ? (
            <CheckCircle className="w-6 h-6 text-green-400" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-red-400" />
          )}
          <div>
            <h3 className={`font-medium ${
              validation.passed ? 'text-green-400' : 'text-red-400'
            }`}>
              {validation.passed ? 'Bundle Size Validation Passed' : 'Bundle Size Validation Failed'}
            </h3>
            <p className="text-gray-400 text-sm">
              {validation.violations.length} violations found. 
              Potential savings: {totalPotentialSavings} KB
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-white/5 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'pages', label: 'Large Pages', icon: FileText },
          { id: 'optimization', label: 'Optimization', icon: Zap }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              selectedTab === tab.id 
                ? 'bg-white/10 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {selectedTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Total Bundle Size"
                value={analysis.totalSize}
                icon={Package}
                delay={0.1}
                limit={BUNDLE_SIZE_LIMITS.maxTotalJS}
              />
              <MetricCard
                title="Framer Motion"
                value={analysis.framerMotionSize}
                icon={Zap}
                delay={0.2}
                change={-5}
                trend="down"
              />
              <MetricCard
                title="Lucide Icons"
                value={analysis.lucideIconsSize}
                icon={FileText}
                delay={0.3}
                change={2}
                trend="up"
              />
              <MetricCard
                title="Potential Savings"
                value={totalPotentialSavings}
                icon={TrendingDown}
                delay={0.4}
              />
            </div>

            {/* Performance Overview */}
            {performanceData && (
              <GlassCard className="p-6" delay={0.5}>
                <h3 className="text-xl font-semibold text-white mb-6">Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-400 text-sm">Core Web Vitals</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">LCP:</span>
                        <span className="text-white text-sm">{performanceData.coreWebVitals.LCP.toFixed(0)}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">FCP:</span>
                        <span className="text-white text-sm">{performanceData.coreWebVitals.FCP.toFixed(0)}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">TTFB:</span>
                        <span className="text-white text-sm">{performanceData.coreWebVitals.TTFB.toFixed(0)}ms</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-green-400" />
                      <span className="text-gray-400 text-sm">Resource Sizes</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">JS:</span>
                        <span className="text-white text-sm">{(performanceData.bundleMetrics.jsSize / 1024).toFixed(1)} KB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">CSS:</span>
                        <span className="text-white text-sm">{(performanceData.bundleMetrics.cssSize / 1024).toFixed(1)} KB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Images:</span>
                        <span className="text-white text-sm">{(performanceData.bundleMetrics.imageSize / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-400 text-sm">Memory Usage</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Heap:</span>
                        <span className="text-white text-sm">{(performanceData.renderingMetrics.memoryUsage / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Components:</span>
                        <span className="text-white text-sm">{performanceData.renderingMetrics.componentsCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}

        {selectedTab === 'pages' && (
          <motion.div
            key="pages"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {analysis.largePages.map((page, index) => (
                <LargePageCard key={page.page} page={page} index={index} />
              ))}
            </div>
          </motion.div>
        )}

        {selectedTab === 'optimization' && (
          <motion.div
            key="optimization"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <GlassCard className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Optimization Opportunities</h3>
              <div className="space-y-2">
                {analysis.optimizationOpportunities.map((opportunity, index) => (
                  <OptimizationCard key={opportunity.component} opportunity={opportunity} index={index} />
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Recommendations</h3>
              <div className="space-y-3">
                {analysis.recommendations.map((rec, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-white/5 rounded-lg"
                  >
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-300 text-sm">{rec}</p>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}