'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  MessageSquare,
  FileText,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  Activity,
  Zap,
  Globe,
  Shield,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  LogOut,
  User,
  Mic,
  Flame
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'
import { authHelpers } from '@/lib/supabase/auth'
import { Sidebar } from '@/components/dashboard/Sidebar'

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
      <div className="p-2 bg-purple-500/20 rounded-lg">
        <activity.icon className="w-4 h-4 text-purple-400" />
      </div>
      <div className="flex-1">
        <p className="text-white text-sm">{activity.title}</p>
        <p className="text-gray-500 text-xs">{activity.time}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </motion.div>
  )
}

export default function EnterpriseDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  
  const handleSignOut = async () => {
    try {
      await authHelpers.signOut()
      router.push('/login')
    } catch (error) {
      toast({
        title: "Failed to sign out. Please try again.",
        variant: 'destructive'
      })
    }
  }
  
  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await authHelpers.getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadUser()
  }, [])
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const metrics = [
    { title: "Total Candidates", value: "2,847", change: 12.5, trend: "up", icon: Users },
    { title: "Active Searches", value: "23", change: 8.2, trend: "up", icon: Search },
    { title: "Placements", value: "156", change: 15.3, trend: "up", icon: TrendingUp },
    { title: "Success Rate", value: "94%", change: 3.1, trend: "down", icon: Activity }
  ]

  const activities = [
    { icon: FileText, title: "New candidate profile added", time: "2 minutes ago" },
    { icon: MessageSquare, title: "Interview scheduled with John Doe", time: "15 minutes ago" },
    { icon: Users, title: "Team meeting in 30 minutes", time: "25 minutes ago" },
    { icon: TrendingUp, title: "Weekly report generated", time: "1 hour ago" }
  ]

  const sidebarItems = [
    { icon: BarChart3, label: "Dashboard", href: "/dashboard", active: true },
    { icon: Mic, label: "Voice Agent", href: "/dashboard/voice" },
    { icon: Flame, label: "Firecrawl", href: "/dashboard/firecrawl" },
    { icon: Users, label: "Candidates", href: "/dashboard/candidates" },
    { icon: MessageSquare, label: "Messages", href: "/dashboard/messages" },
    { icon: FileText, label: "Documents", href: "/dashboard/documents" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" }
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
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/10 to-slate-950">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 flex">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content */}
        <div className="flex-1">
          {/* Header */}
          <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
                </motion.button>
                
                <motion.div 
                  className={`relative ${searchFocused ? 'w-96' : 'w-64'} transition-all duration-300`}
                  initial={false}
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search anything..."
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                  />
                </motion.div>
              </div>

              <div className="flex items-center gap-4">
                <motion.button
                  className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Bell className="w-5 h-5 text-white" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </motion.button>
                
                <div className="relative" ref={profileRef}>
                  <motion.button 
                    className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-white text-sm font-medium">
                        {user?.profile?.full_name || user?.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="text-gray-400 text-xs">{user?.email || 'Loading...'}</p>
                    </div>
                  </motion.button>
                  
                  <AnimatePresence>
                    {profileDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden"
                      >
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm">Sign Out</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </header>

          {/* Dashboard content */}
          <main className="p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl font-bold text-white mb-8">
                Welcome back, {user?.profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'}
              </h1>
              
              {/* Metrics grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {metrics.map((metric, index) => (
                  <MetricCard key={metric.title} {...metric} delay={index * 0.1} />
                ))}
              </div>

              {/* Charts and activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2">
                  <GlassCard className="p-6" delay={0.4}>
                    <h3 className="text-xl font-semibold text-white mb-6">Performance Overview</h3>
                    <div className="h-64 relative">
                      <svg className="w-full h-full" viewBox="0 0 600 250">
                        {chartData.map((point, index) => (
                          <motion.g key={point.month}>
                            <motion.rect
                              x={index * 100 + 20}
                              y={250 - point.value * 2.5}
                              width="60"
                              height={point.value * 2.5}
                              fill="url(#gradient)"
                              rx="4"
                              initial={{ height: 0, y: 250 }}
                              animate={{ height: point.value * 2.5, y: 250 - point.value * 2.5 }}
                              transition={{ delay: 0.6 + index * 0.1, duration: 0.5, type: "spring" }}
                            />
                            <text
                              x={index * 100 + 50}
                              y="240"
                              textAnchor="middle"
                              className="fill-gray-400 text-sm"
                            >
                              {point.month}
                            </text>
                          </motion.g>
                        ))}
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#9333ea" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </GlassCard>
                </div>

                {/* Activity feed */}
                <GlassCard className="p-6" delay={0.5}>
                  <h3 className="text-xl font-semibold text-white mb-6">Recent Activity</h3>
                  <div className="space-y-2">
                    {activities.map((activity, index) => (
                      <ActivityItem key={index} activity={activity} index={index} />
                    ))}
                  </div>
                </GlassCard>
              </div>

              {/* Quick actions */}
              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                {[
                  { title: "Add Candidate", icon: Users, color: "from-purple-600 to-purple-700" },
                  { title: "Schedule Interview", icon: MessageSquare, color: "from-blue-600 to-blue-700" },
                  { title: "Generate Report", icon: FileText, color: "from-green-600 to-green-700" }
                ].map((action, index) => (
                  <motion.button
                    key={action.title}
                    className={`relative p-6 bg-gradient-to-br ${action.color} rounded-2xl text-white overflow-hidden group`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400 }}
                    onClick={() => toast({
                      title: `${action.title} clicked`,
                      variant: 'success'
                    })}
                  >
                    <motion.div
                      className="absolute inset-0 bg-white/20"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    <div className="relative z-10 flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold mb-1">{action.title}</h4>
                        <p className="text-white/80 text-sm">Quick action</p>
                      </div>
                      <action.icon className="w-8 h-8 text-white/80" />
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  )
}