'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  MessageSquare,
  FileText,
  Settings,
  Zap,
  Shield,
  Mic,
  Flame,
  X,
  Megaphone,
  Sparkles,
  BrainCircuit,
  Mail,
  FileSearch,
  Calendar,
  Brain,
  CheckSquare,
  Linkedin,
  Phone,
  FolderOpen,
  Cloud,
  MailOpen,
  TrendingUp as TrendingUpIcon,
  Target,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Database
} from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

// Glassmorphic card component
function GlassCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export function Sidebar({ isOpen, onClose, isCollapsed: controlledCollapsed, onCollapsedChange }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024)
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])
  
  // Use controlled state if provided, otherwise use internal state
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed
  const setIsCollapsed = (collapsed: boolean) => {
    if (onCollapsedChange) {
      onCollapsedChange(collapsed)
    } else {
      setInternalCollapsed(collapsed)
    }
  }

  const sidebarItems = [
    { icon: BarChart3, label: "Dashboard", href: "/dashboard" },
    { icon: Mic, label: "Voice Agent", href: "/dashboard/voice" },
    { icon: Megaphone, label: "Lead Generation", href: "/dashboard/lead-generation" },
    { icon: Sparkles, label: "Content Studio", href: "/dashboard/content-studio" },
    { icon: TrendingUpIcon, label: "Post Predictor", href: "/dashboard/post-predictor" },
    { icon: BrainCircuit, label: "Agent Orchestrator", href: "/dashboard/orchestrator" },
    { icon: GitBranch, label: "Workflow Designer", href: "/dashboard/workflows" },
    { icon: TrendingUp, label: "Analytics", href: "/dashboard/analytics" },
    { icon: Mail, label: "Outreach Campaigns", href: "/dashboard/outreach" },
    { icon: MailOpen, label: "Email Templates", href: "/dashboard/email-templates" },
    { icon: FileSearch, label: "Resume Parser", href: "/dashboard/resume-parser" },
    { icon: Calendar, label: "Interview Center", href: "/dashboard/interview-center" },
    { icon: Brain, label: "Recruiter Intel", href: "/dashboard/recruiter-intel" },
    { icon: CheckSquare, label: "Task Management", href: "/dashboard/tasks" },
    { icon: Target, label: "Competitor Analysis", href: "/dashboard/competitor-analysis" },
    { icon: Database, label: "Zoho CRM", href: "/dashboard/zoho" },
    { icon: Phone, label: "Twilio", href: "/dashboard/twilio" },
    { icon: Linkedin, label: "LinkedIn", href: "/dashboard/linkedin" },
    { icon: Brain, label: "Intelligence Hub", href: "/dashboard/firecrawl" },
    { icon: Cloud, label: "SharePoint", href: "/dashboard/sharepoint" },
    { icon: FolderOpen, label: "File Manager", href: "/dashboard/files" },
    { icon: Users, label: "Candidates", href: "/dashboard/candidates" },
    { icon: MessageSquare, label: "Messages", href: "/dashboard/messages" },
    { icon: FileText, label: "Documents", href: "/dashboard/documents" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" }
  ]

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      
      {/* Sidebar - always visible on desktop, conditional on mobile */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen || isDesktop ? 0 : -280 }}
        transition={{ type: "spring", damping: 25 }}
        className={`fixed left-0 top-0 ${isCollapsed ? 'w-20' : 'w-72'} h-screen bg-gradient-to-b from-zinc-900 to-black backdrop-blur-xl border-r border-white/10 z-50 shadow-2xl flex flex-col transition-all duration-300`}
      >
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                <motion.div
                  className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <Zap className="w-6 h-6 text-white" />
                </motion.div>
                {!isCollapsed && (
                  <div>
                    <h2 className="text-white font-bold text-base">EVA Enterprise</h2>
                    <p className="text-gray-400 text-sm">AI Assistant</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Desktop collapse button */}
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="hidden lg:block p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-5 h-5 text-white" />
                  ) : (
                    <ChevronLeft className="w-5 h-5 text-white" />
                  )}
                </button>
                {/* Mobile close button */}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Navigation - Scrollable */}
            <nav className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
              <div className="space-y-1.5">
                {sidebarItems.map((item, index) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  
                  return (
                    <motion.button
                      key={item.label}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => {
                        router.push(item.href)
                        onClose()
                      }}
                      className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl transition-all group relative ${
                        isActive 
                          ? 'bg-gradient-to-r from-purple-600/25 to-blue-600/25 text-white shadow-lg' 
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                      whileHover={{ x: isCollapsed ? 0 : 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <motion.div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-r-full"
                          layoutId="activeIndicator"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      
                      <div className={`relative ${isActive ? 'text-purple-400' : ''} flex-shrink-0`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      {!isCollapsed && (
                        <span className="font-medium text-[15px]">{item.label}</span>
                      )}
                      
                      {/* Tooltip for collapsed state */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                          {item.label}
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </nav>
          </motion.aside>
    </>
  )
}