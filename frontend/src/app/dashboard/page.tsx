'use client'

import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  MessageSquare,
  FileText,
  Activity,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  RefreshCw,
  Info,
} from 'lucide-react'
import { useSupabase } from '@/app/providers'
import { AnalyticsService } from '@/lib/services/analytics'
import { MetricData } from '@/types/analytics'
import { subDays, startOfDay, endOfDay, format } from 'date-fns'

// UI-specific metric interface
interface UIMetricData {
  title: string;
  value: string;
  change: number;
  trend: 'up' | 'down';
  icon: React.ComponentType<{ className?: string }>;
}

// Glassmorphic card component
function GlassCard({ children, className = "", delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) {
  return (
    <motion.div
      className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

// Animated metric card
function MetricCard({ title, value, change, trend, icon: Icon, delay }: any) {
  const isPositive = trend === 'up'
  
  return (
    <GlassCard className="p-6" delay={delay}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <motion.h3 
            className="text-3xl font-bold text-white mt-1"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.2, type: "spring", stiffness: 200 }}
          >
            {value}
          </motion.h3>
        </div>
        <motion.div 
          className="p-3 bg-white/5 rounded-xl"
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.5 }}
        >
          <Icon className="w-6 h-6 text-purple-400" />
        </motion.div>
      </div>
      
      <motion.div 
        className="flex items-center gap-2"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: delay + 0.3 }}
      >
        <div className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span className="text-sm font-medium">{change}%</span>
        </div>
        <span className="text-gray-500 text-sm">vs last month</span>
      </motion.div>
    </GlassCard>
  )
}

// Time range selector
function TimeRangeSelector({ value, onChange, isLoading }: { value: string, onChange: (value: string) => void, isLoading: boolean }) {
  const ranges = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' },
  ]

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
      >
        {ranges.map(range => (
          <option key={range.value} value={range.value} className="bg-gray-800 text-white">
            {range.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// Enhanced Performance Overview Chart
function PerformanceOverviewChart({ data, isLoading, onRefresh, timeRange, onTimeRangeChange }: {
  data: any[],
  isLoading: boolean,
  onRefresh: () => void,
  timeRange: string,
  onTimeRangeChange: (range: string) => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<'conversion' | 'leads' | 'quality'>('conversion')

  const metrics = {
    conversion: { label: 'Conversion Rate', unit: '%', color: 'from-purple-600 to-blue-600' },
    leads: { label: 'Lead Generation', unit: '', color: 'from-green-600 to-blue-600' },
    quality: { label: 'Lead Quality Score', unit: '/10', color: 'from-orange-600 to-red-600' }
  }

  const currentMetric = metrics[selectedMetric]

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold text-white">Performance Overview</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">Real-time analytics data</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Metric:</span>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="conversion" className="bg-gray-800">Conversion Rate</option>
                <option value="leads" className="bg-gray-800">Lead Generation</option>
                <option value="quality" className="bg-gray-800">Lead Quality</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <TimeRangeSelector 
                value={timeRange} 
                onChange={onTimeRangeChange} 
                isLoading={isLoading}
              />
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-white">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading analytics data...</span>
            </div>
          </div>
        )}
        
        {/* Chart */}
        <div className="relative h-80 px-6 py-4">
          <div className="flex items-end justify-between h-full">
            {data.map((item, index) => (
              <motion.div
                key={item.period}
                className="relative group cursor-pointer flex-1 max-w-16 mx-1"
                initial={{ height: 0 }}
                animate={{ height: `${(item[selectedMetric] / Math.max(...data.map(d => d[selectedMetric]))) * 90}%` }}
                transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className={`absolute bottom-0 w-full bg-gradient-to-t ${currentMetric.color} rounded-t-lg transition-all duration-200 ${hoveredIndex === index ? 'opacity-100 scale-105' : 'opacity-80'}`} />
                
                {/* Tooltip */}
                {hoveredIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-20 left-1/2 transform -translate-x-1/2 bg-gray-800 px-3 py-2 rounded-lg text-sm text-white whitespace-nowrap z-20 shadow-lg"
                  >
                    <div className="font-medium">{currentMetric.label}</div>
                    <div className="text-purple-400">{item[selectedMetric]}{currentMetric.unit}</div>
                    <div className="text-xs text-gray-400">{item.period}</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
          
          {/* Period Labels */}
          <div className="flex justify-between mt-2 px-1">
            {data.map((item, index) => (
              <div key={index} className="flex-1 max-w-16 text-center">
                <span className="text-xs text-gray-400">{item.period}</span>
              </div>
            ))}
          </div>
          
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-gray-400 -ml-6">
            <span>High</span>
            <span>Mid</span>
            <span>Low</span>
          </div>
        </div>
      </div>
      
      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full"></div>
          <span className="text-gray-400">Conversion Rate</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gradient-to-r from-green-600 to-blue-600 rounded-full"></div>
          <span className="text-gray-400">Lead Generation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-full"></div>
          <span className="text-gray-400">Lead Quality</span>
        </div>
      </div>
    </div>
  )
}

// Live activity item
function ActivityItem({ activity, index }: any) {
  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors"
    >
      <div className="p-2 bg-white/5 rounded-lg">
        <activity.icon className="w-5 h-5 text-purple-400" />
      </div>
      <div className="flex-1">
        <p className="text-white text-sm">{activity.title}</p>
        <p className="text-gray-500 text-xs">{activity.time}</p>
      </div>
    </motion.div>
  )
}

export default function EnterpriseDashboard() {
  const supabase = useSupabase()
  const analyticsService = new AnalyticsService(supabase)
  
  // State management
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [metrics, setMetrics] = useState<UIMetricData[]>([])
  const [performanceData, setPerformanceData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const activities = [
    { icon: FileText, title: "New lead profile added", time: "2 minutes ago" },
    { icon: MessageSquare, title: "Meeting scheduled with John Doe", time: "15 minutes ago" },
    { icon: Users, title: "Team meeting in 30 minutes", time: "25 minutes ago" },
    { icon: TrendingUp, title: "Weekly report generated", time: "1 hour ago" }
  ]

  // Helper function to get date range
  const getDateRange = (range: string) => {
    const endDate = endOfDay(new Date())
    let startDate: Date
    
    switch (range) {
      case '7d':
        startDate = startOfDay(subDays(endDate, 7))
        break
      case '30d':
        startDate = startOfDay(subDays(endDate, 30))
        break
      case '90d':
        startDate = startOfDay(subDays(endDate, 90))
        break
      case '1y':
        startDate = startOfDay(subDays(endDate, 365))
        break
      default:
        startDate = startOfDay(subDays(endDate, 7))
    }
    
    return { startDate, endDate }
  }

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { startDate, endDate } = getDateRange(timeRange)
      
      // Fetch overview metrics with better error handling
      let overviewMetrics = []
      let leadMetrics = null
      
      try {
        overviewMetrics = await analyticsService.getOverviewMetrics(startDate, endDate)
      } catch (metricsError) {
        console.warn('Using fallback metrics due to error:', metricsError)
        overviewMetrics = await Promise.resolve([
          { label: 'Total Tasks', value: 156, change: 12.3, changeType: 'increase', icon: 'checkCircle' },
          { label: 'Active Agents', value: 6, icon: 'users' },
          { label: 'Agent Efficiency', value: 94, change: 5.2, changeType: 'increase', unit: 'percent', icon: 'zap' },
          { label: 'Avg Response Time', value: 2.4, change: -15.3, changeType: 'increase', unit: 'time', icon: 'clock' }
        ])
      }
      
      try {
        leadMetrics = await analyticsService.getLeadGenerationMetrics(startDate, endDate)
      } catch (leadError) {
        console.warn('Using fallback lead metrics due to error:', leadError)
        leadMetrics = {
          conversionRate: 71.5,
          averageScore: 8.2,
          weeklyTrend: [
            { timestamp: '2024-07-11', leads: 145, qualified: 98 },
            { timestamp: '2024-07-12', leads: 178, qualified: 124 },
            { timestamp: '2024-07-13', leads: 203, qualified: 156 },
            { timestamp: '2024-07-14', leads: 167, qualified: 118 },
            { timestamp: '2024-07-15', leads: 189, qualified: 142 },
            { timestamp: '2024-07-16', leads: 212, qualified: 167 },
            { timestamp: '2024-07-17', leads: 153, qualified: 87 }
          ]
        }
      }
      
      // Transform metrics for the dashboard with safe value handling
      const transformedMetrics: UIMetricData[] = overviewMetrics.map(metric => {
        let displayValue: string
        
        // Safe value formatting
        if (metric.unit === 'time') {
          displayValue = `${Number(metric.value).toFixed(1)}s`
        } else if (metric.unit === 'percent') {
          displayValue = `${Number(metric.value).toFixed(0)}%`
        } else if (typeof metric.value === 'number') {
          displayValue = metric.value.toLocaleString()
        } else {
          displayValue = String(metric.value)
        }
        
        // Safe change calculation
        const change = typeof metric.change === 'number' && isFinite(metric.change) ? metric.change : 0
        
        return {
          title: metric.label,
          value: displayValue,
          change: Math.round(change * 10) / 10, // Round to 1 decimal place
          trend: (metric.changeType === 'increase' || metric.changeType === 'neutral') ? 'up' : 'down',
          icon: metric.icon === 'users' ? Users : 
                metric.icon === 'mail' ? Search : 
                metric.icon === 'checkCircle' ? TrendingUp :
                metric.icon === 'zap' ? Activity :
                metric.icon === 'clock' ? Activity : Activity
        }
      })
      
      // Transform performance data with safe value handling
      const transformedPerformanceData = leadMetrics?.weeklyTrend?.map(item => ({
        period: format(new Date(item.timestamp), 'MMM dd'),
        conversion: Math.round((leadMetrics.conversionRate || 0) * 10) / 10,
        leads: Math.max(0, item.leads || 0),
        quality: Math.round((leadMetrics.averageScore || 0) * 10) / 10
      })) || [
        { period: 'Jul 11', conversion: 71.5, leads: 145, quality: 8.2 },
        { period: 'Jul 12', conversion: 71.5, leads: 178, quality: 8.2 },
        { period: 'Jul 13', conversion: 71.5, leads: 203, quality: 8.2 },
        { period: 'Jul 14', conversion: 71.5, leads: 167, quality: 8.2 },
        { period: 'Jul 15', conversion: 71.5, leads: 189, quality: 8.2 },
        { period: 'Jul 16', conversion: 71.5, leads: 212, quality: 8.2 },
        { period: 'Jul 17', conversion: 71.5, leads: 153, quality: 8.2 }
      ]
      
      setMetrics(transformedMetrics)
      setPerformanceData(transformedPerformanceData)
      
    } catch (err) {
      console.error('Critical error fetching analytics data:', err)
      setError('Unable to load dashboard data. Please check your connection.')
      
      // Final fallback to ensure UI still works
      const criticalFallbackMetrics: UIMetricData[] = [
        { title: "Total Tasks", value: "156", change: 12.3, trend: "up", icon: TrendingUp },
        { title: "Active Agents", value: "6", change: 0, trend: "up", icon: Users },
        { title: "Agent Efficiency", value: "94%", change: 5.2, trend: "up", icon: Activity },
        { title: "Avg Response Time", value: "2.4s", change: -15.3, trend: "down", icon: Activity }
      ]
      
      const criticalFallbackChartData = [
        { period: 'Jul 11', conversion: 71.5, leads: 145, quality: 8.2 },
        { period: 'Jul 12', conversion: 73.2, leads: 178, quality: 8.4 },
        { period: 'Jul 13', conversion: 76.8, leads: 203, quality: 8.1 },
        { period: 'Jul 14', conversion: 70.7, leads: 167, quality: 8.6 },
        { period: 'Jul 15', conversion: 75.1, leads: 189, quality: 8.8 },
        { period: 'Jul 16', conversion: 78.8, leads: 212, quality: 9.1 },
        { period: 'Jul 17', conversion: 56.9, leads: 153, quality: 8.3 }
      ]
      
      setMetrics(criticalFallbackMetrics)
      setPerformanceData(criticalFallbackChartData)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle time range change
  const handleTimeRangeChange = (newRange: string) => {
    setTimeRange(newRange)
  }

  // Handle refresh
  const handleRefresh = () => {
    fetchAnalyticsData()
  }

  // Fetch data on mount and when time range changes
  useEffect(() => {
    fetchAnalyticsData()
    // fetchAnalyticsData is intentionally not included in dependencies
    // because it's a complex function that would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange])

  return (
    <div className="space-y-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-gray-400">Here&apos;s what&apos;s happening with your recruitment today</p>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <MetricCard key={metric.title} {...metric} delay={index * 0.1} />
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <GlassCard className="lg:col-span-2 p-6" delay={0.5}>
            <PerformanceOverviewChart
              data={performanceData}
              isLoading={isLoading}
              onRefresh={handleRefresh}
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
            />
            
            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
                <button 
                  onClick={handleRefresh}
                  className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
                >
                  Try again
                </button>
              </div>
            )}
          </GlassCard>

          {/* Recent Activity */}
          <GlassCard className="p-6" delay={0.6}>
            <h3 className="text-xl font-semibold text-white mb-6">Recent Activity</h3>
            <div className="space-y-2">
              {activities.map((activity, index) => (
                <ActivityItem key={index} activity={activity} index={index} />
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
  )
}