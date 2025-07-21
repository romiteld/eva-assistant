'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Activity,
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
  Database,
  Video,
  Building2,
  PhoneCall,
  History
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
  const [focusedItemIndex, setFocusedItemIndex] = useState(-1)
  const navRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  
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

  const sidebarGroups = [
    {
      label: "Overview",
      items: [
        { icon: BarChart3, label: "Dashboard", href: "/dashboard" }
      ]
    },
    {
      label: "AI Tools",
      items: [
        { icon: Mic, label: "Talk to Eva", href: "/dashboard/talk-to-eva" },
        { icon: History, label: "Voice History", href: "/dashboard/voice-history" },
        { icon: BrainCircuit, label: "Agent Orchestrator", href: "/dashboard/orchestrator" },
        { icon: Sparkles, label: "Content Studio", href: "/dashboard/content-studio" },
        { icon: Brain, label: "Firecrawl", href: "/dashboard/firecrawl" },
        { icon: Brain, label: "Recruiter Intel", href: "/dashboard/recruiter-intel" },
        { icon: TrendingUpIcon, label: "Post Predictor", href: "/dashboard/post-predictor" }
      ]
    },
    {
      label: "Workflow & Automation",
      items: [
        { icon: Zap, label: "Deal Automation", href: "/dashboard/deals" },
        { icon: GitBranch, label: "Workflow Designer", href: "/dashboard/workflows" },
        { icon: CheckSquare, label: "Task Management", href: "/dashboard/tasks" }
      ]
    },
    {
      label: "Communication",
      items: [
        { icon: Building2, label: "Company Research", href: "/dashboard/company-research" },
        { icon: Megaphone, label: "Lead Generation", href: "/dashboard/lead-generation" },
        { icon: Mail, label: "Outreach Campaigns", href: "/dashboard/outreach" },
        { icon: MailOpen, label: "Email Templates", href: "/dashboard/email-templates" },
        { icon: MessageSquare, label: "Messages", href: "/dashboard/messages" }
      ]
    },
    {
      label: "Integrations",
      items: [
        { icon: Database, label: "Zoho CRM", href: "/dashboard/zoho" },
        { icon: Phone, label: "Twilio", href: "/dashboard/twilio" },
        { icon: Video, label: "Zoom", href: "/dashboard/zoom" },
        { icon: Linkedin, label: "LinkedIn", href: "/dashboard/linkedin" },
        { icon: Cloud, label: "SharePoint", href: "/dashboard/sharepoint" },
        { icon: Users, label: "Microsoft Teams", href: "/dashboard/teams" }
      ]
    },
    {
      label: "Analytics & Data",
      items: [
        { icon: TrendingUp, label: "Analytics", href: "/dashboard/analytics" },
        { icon: Target, label: "Competitor Analysis", href: "/dashboard/competitor-analysis" },
        { icon: Zap, label: "Performance", href: "/dashboard/performance" }
      ]
    },
    {
      label: "Files & Documents",
      items: [
        { icon: FolderOpen, label: "File Manager", href: "/dashboard/files" },
        { icon: FileText, label: "Documents", href: "/dashboard/documents" }
      ]
    },
    {
      label: "System",
      items: [
        { icon: Activity, label: "Monitoring", href: "/dashboard/monitoring" },
        { icon: Settings, label: "Settings", href: "/dashboard/settings" }
      ]
    }
  ]

  // Flatten all navigation items for keyboard navigation
  const allItems = sidebarGroups.flatMap(group => group.items)
  const totalItems = allItems.length

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!navRef.current) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setFocusedItemIndex(prev => {
          const next = prev < totalItems - 1 ? prev + 1 : 0
          itemRefs.current[next]?.focus()
          return next
        })
        break
      case 'ArrowUp':
        event.preventDefault()
        setFocusedItemIndex(prev => {
          const next = prev > 0 ? prev - 1 : totalItems - 1
          itemRefs.current[next]?.focus()
          return next
        })
        break
      case 'Home':
        event.preventDefault()
        setFocusedItemIndex(0)
        itemRefs.current[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        setFocusedItemIndex(totalItems - 1)
        itemRefs.current[totalItems - 1]?.focus()
        break
      case 'Escape':
        if (!isDesktop) {
          onClose()
        }
        break
    }
  }, [totalItems, isDesktop, onClose])

  // Reset focus when sidebar closes on mobile
  useEffect(() => {
    if (!isOpen && !isDesktop) {
      setFocusedItemIndex(-1)
    }
  }, [isOpen, isDesktop])

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
        className={`fixed left-0 top-0 ${isCollapsed ? 'w-20' : 'w-full sm:w-72'} h-full bg-gradient-to-b from-zinc-900 to-black backdrop-blur-xl border-r border-white/10 z-50 shadow-2xl flex flex-col transition-[width] duration-150 safe-area-inset`}
        role="navigation"
        aria-label="Main navigation"
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
                  className="hidden lg:block p-2 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-expanded={!isCollapsed}
                  aria-controls="sidebar-nav"
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
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden focus:outline-none focus:ring-2 focus:ring-purple-500"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Navigation - Scrollable */}
            <nav 
              ref={navRef}
              id="sidebar-nav"
              className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin"
              aria-label="Main navigation"
              onKeyDown={handleKeyDown}
              tabIndex={-1}
            >
              <div className="space-y-6">
                {sidebarGroups.map((group, groupIndex) => {
                  const groupStartIndex = sidebarGroups.slice(0, groupIndex).reduce((acc, g) => acc + g.items.length, 0)
                  
                  return (
                    <div key={group.label} role="group" aria-labelledby={`group-${groupIndex}`}>
                      {groupIndex > 0 && isCollapsed && (
                        <div className="mx-4 my-2 border-t border-gray-800" aria-hidden="true" />
                      )}
                      {!isCollapsed && (
                        <h3 
                          id={`group-${groupIndex}`}
                          className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-4"
                        >
                          {group.label}
                        </h3>
                      )}
                      <ul className="space-y-1" role="list">
                      {group.items.map((item, itemIndex) => {
                        const isActive = pathname === item.href || 
                          (item.href !== '/dashboard' && pathname.startsWith(item.href))
                        const animationDelay = groupIndex * 0.05 + itemIndex * 0.03
                        
                        const globalIndex = groupStartIndex + itemIndex
                        
                        return (
                          <li key={item.label} role="none">
                            <motion.button
                              ref={(el) => { itemRefs.current[globalIndex] = el }}
                              initial={{ x: -20, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: animationDelay }}
                              onClick={() => {
                                router.push(item.href)
                                // Only close on mobile
                                if (!isDesktop) {
                                  onClose()
                                }
                              }}
                              onFocus={() => setFocusedItemIndex(globalIndex)}
                              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl transition-all group relative touch-target ${
                                isActive 
                                  ? 'bg-gradient-to-r from-purple-600/25 to-blue-600/25 text-white shadow-lg' 
                                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
                              } focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
                              whileHover={{ x: isCollapsed ? 0 : 4 }}
                              whileTap={{ scale: 0.98 }}
                              aria-label={isCollapsed ? item.label : undefined}
                              aria-current={isActive ? 'page' : undefined}
                              aria-describedby={isCollapsed ? `tooltip-${globalIndex}` : undefined}
                              tabIndex={focusedItemIndex === globalIndex ? 0 : -1}
                              role="menuitem"
                            >
                            {/* Active indicator */}
                            {isActive && (
                              <>
                                <motion.div
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-r-full"
                                  layoutId="activeIndicator"
                                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                  aria-hidden="true"
                                />
                                <span className="sr-only">Current page</span>
                              </>
                            )}
                            
                            <div className={`relative ${isActive ? 'text-purple-400' : ''} flex-shrink-0`}>
                              <item.icon className="w-5 h-5" />
                            </div>
                            {!isCollapsed && (
                              <span className="font-medium text-[15px]">{item.label}</span>
                            )}
                            
                            {/* Tooltip for collapsed state */}
                            {isCollapsed && (
                              <div 
                                id={`tooltip-${globalIndex}`}
                                role="tooltip"
                                className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50"
                              >
                                {item.label}
                              </div>
                            )}
                          </motion.button>
                          </li>
                        )
                      })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </nav>

            {/* Skip to main content link for keyboard users */}
            <a 
              href="#main-content" 
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-purple-600 text-white px-4 py-2 rounded-lg z-50"
            >
              Skip to main content
            </a>
          </motion.aside>
    </>
  )
}