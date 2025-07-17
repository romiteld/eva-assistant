'use client'

import { useRef } from 'react'
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
} from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

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
  const metrics = [
    { title: "Total Leads", value: "2,847", change: 12.5, trend: "up", icon: Users },
    { title: "Active Campaigns", value: "23", change: 8.2, trend: "up", icon: Search },
    { title: "Placements", value: "156", change: 15.3, trend: "up", icon: TrendingUp },
    { title: "Success Rate", value: "94%", change: 3.1, trend: "down", icon: Activity }
  ]

  const activities = [
    { icon: FileText, title: "New lead profile added", time: "2 minutes ago" },
    { icon: MessageSquare, title: "Meeting scheduled with John Doe", time: "15 minutes ago" },
    { icon: Users, title: "Team meeting in 30 minutes", time: "25 minutes ago" },
    { icon: TrendingUp, title: "Weekly report generated", time: "1 hour ago" }
  ]

  // Chart data visualization
  const chartData = [
    { month: 'Jan', value: 65 },
    { month: 'Feb', value: 72 },
    { month: 'Mar', value: 78 },
    { month: 'Apr', value: 85 },
    { month: 'May', value: 92 },
    { month: 'Jun', value: 98 }
  ]

  return (
    <DashboardLayout>
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
            <h3 className="text-xl font-semibold text-white mb-6">Performance Overview</h3>
            
            {/* Simple bar chart visualization */}
            <div className="flex items-end justify-between h-48 px-4">
              {chartData.map((data, index) => (
                <motion.div
                  key={data.month}
                  className="relative w-12"
                  initial={{ height: 0 }}
                  animate={{ height: `${data.value}%` }}
                  transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                >
                  <div className="absolute bottom-0 w-full bg-gradient-to-t from-purple-600 to-blue-600 rounded-t-lg" />
                  <div className="absolute -bottom-8 w-full text-center">
                    <span className="text-xs text-gray-400">{data.month}</span>
                  </div>
                  <div className="absolute -top-6 w-full text-center">
                    <span className="text-xs text-white font-medium">{data.value}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
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
    </DashboardLayout>
  )
}