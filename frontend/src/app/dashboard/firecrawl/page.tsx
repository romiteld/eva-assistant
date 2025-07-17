'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  Search,
  Building2,
  User,
  TrendingUp,
  Newspaper,
  Network,
  Target,
  Brain,
  Sparkles,
  ChevronRight,
  Clock,
  BookOpen,
  Shield,
  Zap,
  Award,
  BarChart3,
  Users,
  Globe,
  FileSearch,
  MessageSquare,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  Info,
  Star,
  Database,
  RefreshCw,
  Download,
  Share2,
  History,
  Settings,
  Briefcase,
  Music,
  Filter,
  Calendar,
  FileText,
  FolderOpen,
  Save,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Bookmark,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Trash2,
  Edit,
  PlusCircle,
  MoreVertical,
  Activity,
  AlertCircle,
  CheckCheck,
  Loader2,
  Upload,
  Link,
  Hash,
  Layers,
  PieChart,
  FileDown,
  FileUp,
  Folder,
  FolderPlus,
  GitBranch,
  Heart,
  MessageCircle,
  Mic,
  Play,
  Pause,
  Square,
  Volume2,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
  List
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'

interface ResearchTemplate {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  category: 'executive' | 'company' | 'market' | 'talent' | 'custom'
  estimatedTime: string
  popularity: number
  proTips: string[]
  requiredInputs: string[]
  deliverables: string[]
  gradient: string
  tags?: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  automationLevel?: number // 0-100 percentage of automation
}

interface RecentResearch {
  id: string
  template: string
  templateId: string
  target: string
  completedAt: Date
  findings: number
  quality: 'high' | 'medium' | 'low'
  status: 'completed' | 'in-progress' | 'scheduled' | 'failed'
  savedToLibrary?: boolean
  sharedWith?: string[]
  tags?: string[]
  exportFormats?: string[]
  collaborators?: Array<{
    id: string
    name: string
    avatar?: string
    role: 'owner' | 'editor' | 'viewer'
  }>
}

interface ResearchInsight {
  id: string
  type: 'trend' | 'opportunity' | 'risk' | 'recommendation' | 'alert' | 'competitor-move'
  title: string
  description: string
  confidence: number
  sources: number
  impact?: 'high' | 'medium' | 'low'
  actionable?: boolean
  relatedResearch?: string[]
  suggestedActions?: string[]
}

interface SavedSearch {
  id: string
  name: string
  description?: string
  templateId: string
  parameters: Record<string, any>
  frequency?: 'daily' | 'weekly' | 'monthly' | 'once'
  lastRun?: Date
  nextRun?: Date
  notificationEnabled?: boolean
  automated?: boolean
  query?: string
  resultsCount?: number
}

interface ResearchFolder {
  id: string
  name: string
  description?: string
  color?: string
  icon?: string
  researchCount: number
  itemCount: number
  sharedWith?: string[]
  createdAt: Date
  updatedAt: Date
}

interface BatchOperation {
  id: string
  name: string
  templates: string[]
  targets: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  startedAt?: Date
  completedAt?: Date
  results?: Array<{
    target: string
    templateId: string
    status: 'success' | 'failed'
    researchId?: string
    error?: string
  }>
}

const researchTemplates: ResearchTemplate[] = [
  {
    id: 'executive-profile',
    title: 'Executive Deep Dive',
    description: 'Comprehensive background check and career analysis for C-suite executives and senior leaders',
    icon: <User className="h-6 w-6" />,
    category: 'executive',
    estimatedTime: '10-15 mins',
    popularity: 95,
    proTips: [
      'Include LinkedIn URL for better results',
      'Add company name for context',
      'Check multiple name variations'
    ],
    requiredInputs: ['Executive Name', 'Current Company (Optional)', 'LinkedIn URL (Optional)'],
    deliverables: [
      'Career Timeline & Progression',
      'Educational Background',
      'Previous Companies & Roles',
      'Board Positions & Affiliations',
      'Public Speaking & Publications',
      'Professional Network Analysis'
    ],
    gradient: 'from-blue-500 to-purple-500',
    tags: ['background-check', 'due-diligence', 'leadership'],
    difficulty: 'beginner',
    automationLevel: 85
  },
  {
    id: 'company-intelligence',
    title: 'Company Intelligence Report',
    description: 'In-depth analysis of company culture, growth trajectory, and financial health',
    icon: <Building2 className="h-6 w-6" />,
    category: 'company',
    estimatedTime: '15-20 mins',
    popularity: 88,
    proTips: [
      'Use official company name',
      'Include website URL',
      'Specify industry for better context'
    ],
    requiredInputs: ['Company Name', 'Website URL (Optional)', 'Industry'],
    deliverables: [
      'Company Overview & History',
      'Financial Performance',
      'Leadership Team Analysis',
      'Culture & Values Assessment',
      'Recent News & Developments',
      'Competitive Positioning'
    ],
    gradient: 'from-green-500 to-emerald-500',
    tags: ['company-analysis', 'due-diligence', 'market-research'],
    difficulty: 'intermediate',
    automationLevel: 75
  },
  {
    id: 'competitor-landscape',
    title: 'Competitive Landscape Analysis',
    description: 'Identify and analyze key competitors, market positioning, and differentiation strategies',
    icon: <Target className="h-6 w-6" />,
    category: 'market',
    estimatedTime: '20-25 mins',
    popularity: 76,
    proTips: [
      'Define market segment clearly',
      'Include geographic scope',
      'Specify company size range'
    ],
    requiredInputs: ['Target Company', 'Industry/Market', 'Geographic Region'],
    deliverables: [
      'Top 5-10 Competitors',
      'Market Share Analysis',
      'Competitive Advantages',
      'SWOT Analysis',
      'Talent Movement Patterns',
      'Strategic Recommendations'
    ],
    gradient: 'from-orange-500 to-red-500'
  },
  {
    id: 'talent-market',
    title: 'Talent Market Intelligence',
    description: 'Analyze talent pools, compensation trends, and skill availability in specific markets',
    icon: <Users className="h-6 w-6" />,
    category: 'talent',
    estimatedTime: '15-20 mins',
    popularity: 82,
    proTips: [
      'Be specific about role titles',
      'Include required skills',
      'Define experience level'
    ],
    requiredInputs: ['Role/Title', 'Location', 'Industry', 'Experience Level'],
    deliverables: [
      'Talent Pool Size & Availability',
      'Compensation Benchmarks',
      'Skill Distribution',
      'Top Employers in Market',
      'Talent Movement Trends',
      'Sourcing Recommendations'
    ],
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    id: 'industry-trends',
    title: 'Industry Trends & Insights',
    description: 'Track emerging trends, disruptions, and opportunities in specific industries',
    icon: <TrendingUp className="h-6 w-6" />,
    category: 'market',
    estimatedTime: '10-15 mins',
    popularity: 70,
    proTips: [
      'Focus on specific sub-sectors',
      'Include timeframe',
      'Mention geographic focus'
    ],
    requiredInputs: ['Industry', 'Sub-sector (Optional)', 'Geographic Focus', 'Timeframe'],
    deliverables: [
      'Key Industry Trends',
      'Emerging Technologies',
      'Market Growth Projections',
      'Regulatory Changes',
      'Investment Activity',
      'Future Outlook'
    ],
    gradient: 'from-indigo-500 to-blue-500'
  },
  {
    id: 'relationship-mapping',
    title: 'Professional Network Mapping',
    description: 'Map professional connections and identify warm introduction paths',
    icon: <Network className="h-6 w-6" />,
    category: 'executive',
    estimatedTime: '12-18 mins',
    popularity: 65,
    proTips: [
      'Include multiple targets',
      'Add your company context',
      'Specify relationship types'
    ],
    requiredInputs: ['Target Person/Company', 'Your Company', 'Relationship Context'],
    deliverables: [
      'Connection Map Visualization',
      'Mutual Connections',
      'Introduction Paths',
      'Relationship Strength Analysis',
      'Engagement History',
      'Outreach Recommendations'
    ],
    gradient: 'from-cyan-500 to-blue-500',
    tags: ['networking', 'relationship-intelligence', 'outreach'],
    difficulty: 'advanced',
    automationLevel: 60
  },
  {
    id: 'succession-planning',
    title: 'Succession Planning Analysis',
    description: 'Identify potential successors and analyze leadership pipeline for key positions',
    icon: <GitBranch className="h-6 w-6" />,
    category: 'talent',
    estimatedTime: '20-25 mins',
    popularity: 72,
    proTips: [
      'Specify the role clearly',
      'Include current incumbent details',
      'Define succession timeline'
    ],
    requiredInputs: ['Current Executive', 'Role/Position', 'Company', 'Timeline'],
    deliverables: [
      'Internal Succession Candidates',
      'External Market Candidates',
      'Readiness Assessment',
      'Development Gaps Analysis',
      'Risk Mitigation Strategies',
      'Succession Timeline Roadmap'
    ],
    gradient: 'from-amber-500 to-orange-500',
    tags: ['succession', 'leadership-pipeline', 'talent-planning'],
    difficulty: 'advanced',
    automationLevel: 70
  },
  {
    id: 'deal-intelligence',
    title: 'M&A Deal Intelligence',
    description: 'Analyze merger and acquisition activity, deal terms, and strategic implications',
    icon: <Layers className="h-6 w-6" />,
    category: 'market',
    estimatedTime: '25-30 mins',
    popularity: 68,
    proTips: [
      'Include deal timeframe',
      'Specify deal size range',
      'Focus on specific sectors'
    ],
    requiredInputs: ['Target Companies/Sector', 'Deal Type', 'Timeframe', 'Geography'],
    deliverables: [
      'Recent Deal Activity',
      'Deal Terms & Valuations',
      'Strategic Rationale Analysis',
      'Key Players & Advisors',
      'Market Impact Assessment',
      'Future Deal Predictions'
    ],
    gradient: 'from-violet-500 to-purple-500',
    tags: ['m&a', 'deals', 'market-intelligence'],
    difficulty: 'advanced',
    automationLevel: 65
  },
  {
    id: 'board-composition',
    title: 'Board Composition Research',
    description: 'Analyze board diversity, expertise gaps, and governance best practices',
    icon: <Users className="h-6 w-6" />,
    category: 'company',
    estimatedTime: '15-20 mins',
    popularity: 58,
    proTips: [
      'Include peer companies',
      'Specify board size preferences',
      'Note specific expertise needs'
    ],
    requiredInputs: ['Company Name', 'Industry Peers', 'Board Requirements'],
    deliverables: [
      'Current Board Analysis',
      'Diversity Metrics',
      'Skills Matrix Assessment',
      'Peer Board Comparison',
      'Gap Analysis Report',
      'Candidate Recommendations'
    ],
    gradient: 'from-rose-500 to-pink-500',
    tags: ['board', 'governance', 'diversity'],
    difficulty: 'intermediate',
    automationLevel: 80
  }
]

const mockRecentResearch: RecentResearch[] = [
  {
    id: '1',
    template: 'Executive Deep Dive',
    templateId: 'executive-profile',
    target: 'John Smith - CEO at TechCorp',
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    findings: 47,
    quality: 'high',
    status: 'completed',
    savedToLibrary: true,
    tags: ['c-suite', 'tech-industry', 'priority'],
    exportFormats: ['pdf', 'docx'],
    collaborators: [
      { id: '1', name: 'Sarah Johnson', role: 'owner' },
      { id: '2', name: 'Mike Chen', role: 'viewer' }
    ]
  },
  {
    id: '2',
    template: 'Company Intelligence Report',
    templateId: 'company-intelligence',
    target: 'Innovative Solutions Inc.',
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    findings: 62,
    quality: 'high',
    status: 'completed',
    savedToLibrary: true,
    sharedWith: ['team-alpha'],
    tags: ['acquisition-target', 'fintech']
  },
  {
    id: '3',
    template: 'Talent Market Intelligence',
    templateId: 'talent-market',
    target: 'Senior Financial Advisors - New York',
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    findings: 38,
    quality: 'medium',
    status: 'completed',
    tags: ['talent-mapping', 'q1-2024']
  },
  {
    id: '4',
    template: 'Succession Planning Analysis',
    templateId: 'succession-planning',
    target: 'CFO Position - Morgan Stanley',
    completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    findings: 24,
    quality: 'high',
    status: 'in-progress',
    savedToLibrary: false,
    tags: ['urgent', 'confidential']
  }
]

const mockInsights: ResearchInsight[] = [
  {
    id: '1',
    type: 'trend',
    title: 'Rising demand for AI expertise in Financial Services',
    description: 'Analysis shows 240% increase in AI-related job postings in financial services over the past 6 months.',
    confidence: 92,
    sources: 15,
    impact: 'high',
    actionable: true,
    suggestedActions: [
      'Update job descriptions to highlight AI projects',
      'Partner with AI bootcamps for talent pipeline',
      'Consider upskilling current advisors'
    ],
    relatedResearch: ['2', '3']
  },
  {
    id: '2',
    type: 'opportunity',
    title: 'Untapped talent pool in remote markets',
    description: 'Identified 3,000+ qualified candidates in secondary markets with 30% lower compensation expectations.',
    confidence: 88,
    sources: 12,
    impact: 'high',
    actionable: true,
    suggestedActions: [
      'Launch targeted recruiting campaign in identified markets',
      'Adjust compensation strategy for remote positions',
      'Create virtual onboarding program'
    ]
  },
  {
    id: '3',
    type: 'competitor-move',
    title: 'BlackRock aggressively expanding wealth management team',
    description: 'BlackRock has hired 8 senior advisors from your client and 15 total from top firms in the past quarter.',
    confidence: 95,
    sources: 8,
    impact: 'high',
    actionable: true,
    suggestedActions: [
      'Review and enhance retention packages',
      'Conduct stay interviews with key advisors',
      'Accelerate promotion timeline for high performers'
    ]
  },
  {
    id: '4',
    type: 'alert',
    title: 'New SEC regulations impact advisor compensation',
    description: 'Proposed changes to fiduciary rules may affect commission structures starting Q2 2024.',
    confidence: 85,
    sources: 5,
    impact: 'medium',
    actionable: true,
    suggestedActions: [
      'Schedule compliance review with legal team',
      'Prepare alternative compensation models',
      'Communicate changes to advisor teams'
    ]
  }
]

const mockSavedSearches: SavedSearch[] = [
  {
    id: '1',
    name: 'Weekly C-Suite Moves',
    description: 'Track executive movements in top financial firms',
    templateId: 'executive-profile',
    parameters: {
      companies: ['Goldman Sachs', 'Morgan Stanley', 'JPMorgan'],
      roles: ['CEO', 'CFO', 'CTO', 'President']
    },
    frequency: 'weekly',
    lastRun: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    notificationEnabled: true
  },
  {
    id: '2',
    name: 'Competitor Intelligence Dashboard',
    description: 'Monitor key competitors activities and news',
    templateId: 'company-intelligence',
    parameters: {
      companies: ['Charles Schwab', 'Fidelity', 'Vanguard'],
      topics: ['hiring', 'product launches', 'acquisitions']
    },
    frequency: 'daily',
    lastRun: new Date(Date.now() - 8 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 16 * 60 * 60 * 1000),
    notificationEnabled: true
  }
]

const mockFolders: ResearchFolder[] = [
  {
    id: '1',
    name: 'Q1 2024 Executive Searches',
    description: 'All executive research for current quarter',
    color: 'blue',
    icon: 'folder',
    researchCount: 24,
    itemCount: 24,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: '2',
    name: 'Acquisition Targets',
    description: 'Potential acquisition opportunities',
    color: 'green',
    icon: 'target',
    researchCount: 12,
    itemCount: 12,
    sharedWith: ['team-strategy'],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  }
]

export default function RecruiterIntelligenceHub() {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [recentResearch, setRecentResearch] = useState<RecentResearch[]>([])
  const [insights, setInsights] = useState<ResearchInsight[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [folders, setFolders] = useState<ResearchFolder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false)
  const [selectedResearch, setSelectedResearch] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('templates')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'recent' | 'popularity' | 'name'>('recent')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setRecentResearch(mockRecentResearch)
      setInsights(mockInsights)
      setSavedSearches(mockSavedSearches)
      setFolders(mockFolders)
      setIsLoading(false)
    }, 1000)
  }, [])

  const filteredTemplates = researchTemplates
    .filter(t => selectedCategory === 'all' || t.category === selectedCategory)
    .filter(t => !searchQuery || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .filter(t => filterTags.length === 0 || 
      t.tags?.some(tag => filterTags.includes(tag))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'popularity': return b.popularity - a.popularity
        case 'name': return a.title.localeCompare(b.title)
        case 'recent': return b.popularity - a.popularity // Default to popularity for templates
        default: return 0
      }
    })

  const categories = [
    { id: 'all', label: 'All Research', icon: <Brain className="h-4 w-4" />, count: researchTemplates.length },
    { id: 'executive', label: 'Executive', icon: <User className="h-4 w-4" />, count: researchTemplates.filter(t => t.category === 'executive').length },
    { id: 'company', label: 'Company', icon: <Building2 className="h-4 w-4" />, count: researchTemplates.filter(t => t.category === 'company').length },
    { id: 'market', label: 'Market', icon: <Globe className="h-4 w-4" />, count: researchTemplates.filter(t => t.category === 'market').length },
    { id: 'talent', label: 'Talent', icon: <Users className="h-4 w-4" />, count: researchTemplates.filter(t => t.category === 'talent').length },
    { id: 'custom', label: 'Custom', icon: <Settings className="h-4 w-4" />, count: researchTemplates.filter(t => t.category === 'custom').length }
  ]

  const getInsightIcon = (type: ResearchInsight['type']) => {
    switch (type) {
      case 'trend': return <TrendingUp className="h-4 w-4" />
      case 'opportunity': return <Lightbulb className="h-4 w-4" />
      case 'risk': return <AlertCircle className="h-4 w-4" />
      case 'recommendation': return <Target className="h-4 w-4" />
      case 'alert': return <AlertCircle className="h-4 w-4" />
      case 'competitor-move': return <Activity className="h-4 w-4" />
    }
  }

  const getInsightColor = (type: ResearchInsight['type']) => {
    switch (type) {
      case 'trend': return 'text-blue-400 bg-blue-500/10'
      case 'opportunity': return 'text-green-400 bg-green-500/10'
      case 'risk': return 'text-red-400 bg-red-500/10'
      case 'recommendation': return 'text-purple-400 bg-purple-500/10'
      case 'alert': return 'text-amber-400 bg-amber-500/10'
      case 'competitor-move': return 'text-orange-400 bg-orange-500/10'
    }
  }

  const getStatusColor = (status: RecentResearch['status']) => {
    switch (status) {
      case 'completed': return 'text-green-400 border-green-400/50'
      case 'in-progress': return 'text-blue-400 border-blue-400/50'
      case 'scheduled': return 'text-purple-400 border-purple-400/50'
      case 'failed': return 'text-red-400 border-red-400/50'
    }
  }

  const getDifficultyColor = (difficulty?: ResearchTemplate['difficulty']) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-400 bg-green-500/10'
      case 'intermediate': return 'text-yellow-400 bg-yellow-500/10'
      case 'advanced': return 'text-red-400 bg-red-500/10'
      default: return 'text-gray-400 bg-gray-500/10'
    }
  }

  const formatTimeAgo = (date: Date) => {
    const hours = Math.floor((Date.now() - date.getTime()) / 1000 / 60 / 60)
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const handleTemplateClick = (templateId: string) => {
    router.push(`/dashboard/firecrawl/research/${templateId}`)
  }

  const handleExportResearch = (researchId: string, format: 'pdf' | 'docx' | 'csv') => {
    toast({
      title: 'Export Started',
      description: `Exporting research as ${format.toUpperCase()}...`,
      variant: 'success'
    })
    // Simulate export
    setTimeout(() => {
      toast({
        title: 'Export Complete',
        description: 'Your research has been downloaded.',
        variant: 'success'
      })
    }, 2000)
  }

  const handleShareResearch = (researchId: string) => {
    // Copy shareable link
    navigator.clipboard.writeText(`https://eva.app/research/${researchId}`)
    toast({
      title: 'Link Copied',
      description: 'Shareable link has been copied to clipboard.',
      variant: 'success'
    })
  }

  const handleBatchResearch = (templates: string[], targets: string[]) => {
    const operation: BatchOperation = {
      id: Date.now().toString(),
      name: `Batch Research - ${new Date().toLocaleDateString()}`,
      templates,
      targets,
      status: 'pending',
      progress: 0,
      startedAt: new Date()
    }
    
    toast({
      title: 'Batch Research Started',
      description: `Processing ${targets.length} targets with ${templates.length} templates.`,
      variant: 'success'
    })
    
    setShowBatchDialog(false)
  }

  const handleSaveToFolder = (researchIds: string[], folderId: string) => {
    toast({
      title: 'Saved to Folder',
      description: `${researchIds.length} research items saved to folder.`,
      variant: 'success'
    })
  }

  const handleCreateSavedSearch = (search: Omit<SavedSearch, 'id'>) => {
    const newSearch: SavedSearch = {
      ...search,
      id: Date.now().toString()
    }
    setSavedSearches([...savedSearches, newSearch])
    toast({
      title: 'Search Saved',
      description: 'Your search has been saved and will run automatically.',
      variant: 'success'
    })
  }

  const handleRunSavedSearch = (searchId: string) => {
    const search = savedSearches.find(s => s.id === searchId)
    if (search) {
      router.push(`/dashboard/firecrawl/research/${search.templateId}?saved=${searchId}`)
    }
  }

  const getAllTags = () => {
    const tags = new Set<string>()
    researchTemplates.forEach(t => t.tags?.forEach(tag => tags.add(tag)))
    recentResearch.forEach(r => r.tags?.forEach(tag => tags.add(tag)))
    return Array.from(tags).sort()
  }

  const getTemplateById = (id: string) => {
    return researchTemplates.find(t => t.id === id)
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-100">
                      Intelligence Hub
                    </h1>
                    <p className="text-gray-400 mt-1">
                      AI-powered research for smarter recruiting decisions
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBatchDialog(true)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <Layers className="h-4 w-4 mr-2" />
                  Batch Research
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateFolderDialog(true)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/dashboard/firecrawl/custom-template')}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Create Custom Template
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Research Library
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Research
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="h-4 w-4 mr-2" />
                      Research Settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search templates, research, or insights..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-900/50 border-gray-800 text-gray-100"
                />
              </div>
              
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[150px] bg-gray-900/50 border-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="popularity">Most Popular</SelectItem>
                  <SelectItem value="name">Alphabetical</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 border-l border-gray-800 pl-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        "p-2",
                        viewMode === 'grid' ? "bg-gray-800 text-gray-100" : "text-gray-500"
                      )}
                    >
                      <Layers className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Grid View</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "p-2",
                        viewMode === 'list' ? "bg-gray-800 text-gray-100" : "text-gray-500"
                      )}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>List View</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </motion.div>

          {/* Key Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
          >
            <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Research Completed</p>
                    <p className="text-2xl font-bold text-gray-100 mt-1">247</p>
                    <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      +23% this month
                    </p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <CheckCircle2 className="h-6 w-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Time Saved</p>
                    <p className="text-2xl font-bold text-gray-100 mt-1">82 hrs</p>
                    <p className="text-xs text-blue-400 mt-1">This month</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Clock className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Active Insights</p>
                    <p className="text-2xl font-bold text-gray-100 mt-1">48</p>
                    <p className="text-xs text-amber-400 mt-1">12 critical</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-lg">
                    <Lightbulb className="h-6 w-6 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Saved Searches</p>
                    <p className="text-2xl font-bold text-gray-100 mt-1">{savedSearches.length}</p>
                    <p className="text-xs text-purple-400 mt-1">Auto-running</p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <RefreshCw className="h-6 w-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Team Activity</p>
                    <p className="text-2xl font-bold text-gray-100 mt-1">12</p>
                    <p className="text-xs text-green-400 mt-1">Active now</p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <Users className="h-6 w-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="bg-gray-900/50 border border-gray-800">
                <TabsTrigger value="templates" className="data-[state=active]:bg-gray-800">
                  <Brain className="h-4 w-4 mr-2" />
                  Research Templates
                </TabsTrigger>
                <TabsTrigger value="insights" className="data-[state=active]:bg-gray-800">
                  <Lightbulb className="h-4 w-4 mr-2" />
                  AI Insights
                  {insights.filter(i => i.impact === 'high').length > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 px-1">
                      {insights.filter(i => i.impact === 'high').length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="library" className="data-[state=active]:bg-gray-800">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Research Library
                </TabsTrigger>
                <TabsTrigger value="saved" className="data-[state=active]:bg-gray-800">
                  <Bookmark className="h-4 w-4 mr-2" />
                  Saved Searches
                </TabsTrigger>
                <TabsTrigger value="tools" className="data-[state=active]:bg-gray-800">
                  <Settings className="h-4 w-4 mr-2" />
                  Advanced Tools
                </TabsTrigger>
              </TabsList>

              {/* Tab-specific actions */}
              {activeTab === 'templates' && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-gray-800">
                    {filteredTemplates.length} templates
                  </Badge>
                </div>
              )}
            </div>

            {/* Research Templates Tab */}
            <TabsContent value="templates" className="space-y-6">
              {/* Category Filter with Tags */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {categories.map(category => (
                      <Button
                        key={category.id}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCategory(category.id)}
                        className={cn(
                          "flex items-center gap-2 whitespace-nowrap",
                          selectedCategory === category.id
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                            : "bg-gray-900/50 text-gray-400 border-gray-700 hover:text-gray-300"
                        )}
                      >
                        {category.icon}
                        {category.label}
                        <Badge variant="secondary" className="ml-1 bg-gray-800/50">
                          {category.count}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                      className={cn(
                        "text-gray-400",
                        showOnlyFavorites && "text-amber-400"
                      )}
                    >
                      <Star className={cn(
                        "h-4 w-4",
                        showOnlyFavorites && "fill-current"
                      )} />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-gray-400">
                          <Filter className="h-4 w-4 mr-2" />
                          Filter
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuLabel>Filter by Tags</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {getAllTags().map(tag => (
                          <DropdownMenuItem
                            key={tag}
                            onClick={() => {
                              if (filterTags.includes(tag)) {
                                setFilterTags(filterTags.filter(t => t !== tag))
                              } else {
                                setFilterTags([...filterTags, tag])
                              }
                            }}
                          >
                            <Checkbox
                              checked={filterTags.includes(tag)}
                              className="mr-2"
                            />
                            {tag}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Active Filters */}
                {filterTags.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Active filters:</span>
                    {filterTags.map(tag => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="bg-purple-500/20 text-purple-300 cursor-pointer"
                        onClick={() => setFilterTags(filterTags.filter(t => t !== tag))}
                      >
                        {tag}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilterTags([])}
                      className="text-gray-400 text-xs"
                    >
                      Clear all
                    </Button>
                  </div>
                )}
              </div>

              {/* Template Grid */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTemplates.map((template, index) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card 
                        className="h-full bg-gray-900/50 border-gray-800 hover:border-gray-700 cursor-pointer transition-all hover:shadow-lg hover:shadow-purple-500/10 relative overflow-hidden"
                        onClick={() => handleTemplateClick(template.id)}
                      >
                        {/* Automation Level Indicator */}
                        {template.automationLevel && (
                          <div className="absolute top-0 right-0 w-24 h-24">
                            <div className={cn(
                              "absolute top-2 right-2 w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold",
                              template.automationLevel >= 80 ? "bg-green-500/20 text-green-400" :
                              template.automationLevel >= 60 ? "bg-blue-500/20 text-blue-400" :
                              "bg-amber-500/20 text-amber-400"
                            )}>
                              {template.automationLevel}%
                            </div>
                          </div>
                        )}
                        
                        <CardHeader>
                          <div className="flex items-start justify-between mb-4">
                            <div className={cn(
                              "p-3 rounded-lg bg-gradient-to-br",
                              template.gradient
                            )}>
                              {template.icon}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="secondary" className="bg-gray-800">
                                {template.popularity}% used
                              </Badge>
                              {template.difficulty && (
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-xs", getDifficultyColor(template.difficulty))}
                                >
                                  {template.difficulty}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <CardTitle className="text-lg text-gray-100">
                            {template.title}
                          </CardTitle>
                          <CardDescription className="text-gray-400 line-clamp-2">
                            {template.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Tags */}
                          {template.tags && template.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {template.tags.slice(0, 3).map(tag => (
                                <Badge 
                                  key={tag} 
                                  variant="outline" 
                                  className="text-xs bg-gray-800/50 text-gray-400 border-gray-700"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {template.tags.length > 3 && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs bg-gray-800/50 text-gray-500 border-gray-700"
                                >
                                  +{template.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {template.estimatedTime}
                            </span>
                            <span className="text-gray-500 flex items-center gap-1">
                              <FileSearch className="h-3 w-3" />
                              {template.deliverables.length} deliverables
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-amber-400"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // Toggle favorite
                                    }}
                                  >
                                    <Star className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add to Favorites</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleShareResearch(template.id)
                                    }}
                                  >
                                    <Share2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Share Template</TooltipContent>
                              </Tooltip>
                            </div>
                            <Button size="sm" variant="ghost" className="text-purple-400 hover:text-purple-300">
                              Start Research
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                /* List View */
                <div className="space-y-2">
                  {filteredTemplates.map((template, index) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className="bg-gray-900/50 border-gray-800 hover:border-gray-700 cursor-pointer transition-all"
                        onClick={() => handleTemplateClick(template.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div className={cn(
                                "p-2 rounded-lg bg-gradient-to-br flex-shrink-0",
                                template.gradient
                              )}>
                                {React.cloneElement(template.icon as React.ReactElement, { className: "h-5 w-5" })}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-gray-100">{template.title}</h4>
                                  <Badge variant="secondary" className="text-xs bg-gray-800">
                                    {template.popularity}% used
                                  </Badge>
                                  {template.difficulty && (
                                    <Badge 
                                      variant="outline" 
                                      className={cn("text-xs", getDifficultyColor(template.difficulty))}
                                    >
                                      {template.difficulty}
                                    </Badge>
                                  )}
                                  {template.automationLevel && (
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30"
                                    >
                                      {template.automationLevel}% automated
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400">{template.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm text-gray-500">{template.estimatedTime}</p>
                                <p className="text-xs text-gray-600">{template.deliverables.length} deliverables</p>
                              </div>
                              <Button 
                                size="sm" 
                                className="bg-purple-500 hover:bg-purple-600"
                              >
                                Start
                                <ArrowRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}

            {/* Quick Start Guide */}
            <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-300">
                  <Sparkles className="h-5 w-5" />
                  New to Intelligence Hub?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-300">
                  Get started with these popular research templates:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Star className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-200">Executive Deep Dive</p>
                      <p className="text-sm text-gray-400">Perfect for candidate vetting</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Star className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-200">Company Intelligence</p>
                      <p className="text-sm text-gray-400">Understand target firms</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Star className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-200">Talent Market Intel</p>
                      <p className="text-sm text-gray-400">Find hidden talent pools</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

            {/* AI Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              {/* Insights Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">AI-Generated Insights</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Real-time intelligence from your research activities
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[150px] bg-gray-900/50 border-gray-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Insights</SelectItem>
                      <SelectItem value="high">High Impact</SelectItem>
                      <SelectItem value="actionable">Actionable Only</SelectItem>
                      <SelectItem value="recent">Recent (24h)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Insights Grid */}
              <div className="space-y-4">
                {insights.map((insight, index) => (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className={cn(
                      "bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all",
                      insight.impact === 'high' && "border-l-4 border-l-red-500"
                    )}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "p-3 rounded-lg flex-shrink-0",
                            getInsightColor(insight.type)
                          )}>
                            {getInsightIcon(insight.type)}
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-gray-100 mb-1">
                                  {insight.title}
                                </h3>
                                <div className="flex items-center gap-2">
                                  {insight.impact && (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-xs",
                                        insight.impact === 'high' ? "text-red-400 border-red-400/50" :
                                        insight.impact === 'medium' ? "text-amber-400 border-amber-400/50" :
                                        "text-green-400 border-green-400/50"
                                      )}
                                    >
                                      {insight.impact} impact
                                    </Badge>
                                  )}
                                  {insight.actionable && (
                                    <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/50">
                                      Actionable
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs bg-gray-800">
                                    {insight.confidence}% confidence
                                  </Badge>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Full Analysis
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Share Insight
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Bookmark className="h-4 w-4 mr-2" />
                                    Save for Later
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-400">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Dismiss
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            <p className="text-sm text-gray-400">
                              {insight.description}
                            </p>
                            
                            {insight.suggestedActions && insight.suggestedActions.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-300">Suggested Actions:</p>
                                <div className="space-y-1">
                                  {insight.suggestedActions.map((action, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                      <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5" />
                                      <p className="text-xs text-gray-400">{action}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between pt-2">
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Database className="h-3 w-3" />
                                  {insight.sources} sources
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  2 hours ago
                                </span>
                              </div>
                              <Button size="sm" className="h-7 text-xs bg-purple-500 hover:bg-purple-600">
                                Take Action
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

          {/* Recent Research Tab */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Recent Research</h3>
              <Button variant="outline" size="sm" className="text-gray-400">
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
            </div>
            
            {recentResearch.map((research, index) => (
              <motion.div
                key={research.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-100">{research.template}</h4>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              research.quality === 'high' && "text-green-400 border-green-400/50",
                              research.quality === 'medium' && "text-yellow-400 border-yellow-400/50",
                              research.quality === 'low' && "text-red-400 border-red-400/50"
                            )}
                          >
                            {research.quality} quality
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400">{research.target}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{formatTimeAgo(research.completedAt)}</span>
                          <span>{research.findings} findings</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="text-gray-400">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-gray-400">
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" className="text-purple-400">
                          View Report
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </TabsContent>

          {/* Advanced Tools Tab */}
          <TabsContent value="tools" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100">
                    <Search className="h-5 w-5 text-purple-400" />
                    Custom Web Search
                  </CardTitle>
                  <CardDescription>
                    Advanced search with AI-powered content extraction
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push('/dashboard/firecrawl/search')}
                  >
                    Open Search Tool
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100">
                    <FileSearch className="h-5 w-5 text-blue-400" />
                    Deep Website Analysis
                  </CardTitle>
                  <CardDescription>
                    Crawl and analyze entire websites for insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push('/dashboard/firecrawl/crawl')}
                  >
                    Start Crawling
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100">
                    <Database className="h-5 w-5 text-green-400" />
                    Data Extraction
                  </CardTitle>
                  <CardDescription>
                    Extract structured data from any webpage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push('/dashboard/firecrawl/extract')}
                  >
                    Configure Extraction
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100">
                    <Globe className="h-5 w-5 text-orange-400" />
                    URL Scraper
                  </CardTitle>
                  <CardDescription>
                    Quick scraping for individual pages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push('/dashboard/firecrawl/scrape')}
                  >
                    Scrape URL
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Research Library Tab */}
          <TabsContent value="library" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-gray-100">Research Library</h3>
                <Badge variant="secondary">{savedSearches.length + folders.length} items</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreateFolderDialog(true)}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
              </div>
            </div>

            {/* Folders */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {folders.map((folder) => (
                <Card 
                  key={folder.id}
                  className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all cursor-pointer"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Folder className={cn(
                          "h-8 w-8 mt-1",
                          folder.color === 'purple' && "text-purple-400",
                          folder.color === 'blue' && "text-blue-400",
                          folder.color === 'green' && "text-green-400",
                          folder.color === 'yellow' && "text-yellow-400"
                        )} />
                        <div>
                          <h4 className="font-medium text-gray-100">{folder.name}</h4>
                          <p className="text-sm text-gray-500 mt-1">{folder.itemCount} items</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-400">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Library Items */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400">Recent Saves</h4>
              {recentResearch.filter(r => r.savedToLibrary).map((item) => (
                <Card key={item.id} className="bg-gray-900/50 border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-500" />
                        <div>
                          <h4 className="font-medium text-gray-100">{item.template} - {item.target}</h4>
                          <p className="text-sm text-gray-500">
                            {item.findings} findings • {formatTimeAgo(item.completedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.sharedWith && item.sharedWith.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            Shared
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Saved Searches Tab */}
          <TabsContent value="saved" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Saved Searches</h3>
              <Badge variant="secondary">{savedSearches.length} active</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {savedSearches.map((search) => (
                <Card key={search.id} className="bg-gray-900/50 border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-100">{search.name}</h4>
                          {search.automated && (
                            <Badge variant="outline" className="text-xs">
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Automated
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{search.query}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Last run: {search.lastRun ? formatTimeAgo(search.lastRun) : 'Never'}</span>
                          <span>{search.resultsCount} results</span>
                          {search.frequency && <span>Runs {search.frequency}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={search.automated}
                          onCheckedChange={() => {}}
                          className="data-[state=checked]:bg-purple-500"
                        />
                        <Button size="sm" variant="outline">
                          Run Now
                        </Button>
                        <Button size="sm" variant="ghost">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-purple-900/20 border-purple-800/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-purple-400 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-medium text-gray-100">Pro Tip: Automated Searches</h4>
                    <p className="text-sm text-gray-400">
                      Set up automated searches to run daily, weekly, or monthly. Get notified when new 
                      results match your criteria, perfect for tracking competitors or industry news.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
          <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-100">Batch Research Operation</DialogTitle>
              <DialogDescription>
                Upload a CSV file or paste a list to research multiple targets at once
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="batch-template">Research Template</Label>
                <Select defaultValue="executive-profile">
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive-profile">Executive Profile</SelectItem>
                    <SelectItem value="company-intelligence">Company Intelligence</SelectItem>
                    <SelectItem value="talent-market">Talent Market Analysis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Input Method</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="justify-start">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Paste List
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch-targets">Targets (one per line)</Label>
                <Textarea
                  id="batch-targets"
                  placeholder="John Smith, Goldman Sachs
Jane Doe, Morgan Stanley
..."
                  className="bg-gray-800 border-gray-700 min-h-[150px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
                Cancel
              </Button>
              <Button className="bg-purple-500 hover:bg-purple-600">
                Start Batch Research
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-gray-100">Export Research</DialogTitle>
              <DialogDescription>
                Choose your export format and options
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <RadioGroup defaultValue="pdf">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pdf" id="pdf" />
                    <Label htmlFor="pdf" className="font-normal">PDF Report</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="docx" id="docx" />
                    <Label htmlFor="docx" className="font-normal">Word Document</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="csv" id="csv" />
                    <Label htmlFor="csv" className="font-normal">CSV Data</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Include</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-sources" defaultChecked />
                    <Label htmlFor="include-sources" className="font-normal">Source Links</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-insights" defaultChecked />
                    <Label htmlFor="include-insights" className="font-normal">AI Insights</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-raw" />
                    <Label htmlFor="include-raw" className="font-normal">Raw Data</Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                Cancel
              </Button>
              <Button className="bg-purple-500 hover:bg-purple-600">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
          <DialogContent className="bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-gray-100">Create New Folder</DialogTitle>
              <DialogDescription>
                Organize your research into folders
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="folder-name">Folder Name</Label>
                <Input
                  id="folder-name"
                  placeholder="e.g., Q1 Executive Research"
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {['purple', 'blue', 'green', 'yellow', 'red'].map((color) => (
                    <button
                      key={color}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        color === 'purple' && "bg-purple-500 hover:bg-purple-600",
                        color === 'blue' && "bg-blue-500 hover:bg-blue-600",
                        color === 'green' && "bg-green-500 hover:bg-green-600",
                        color === 'yellow' && "bg-yellow-500 hover:bg-yellow-600",
                        color === 'red' && "bg-red-500 hover:bg-red-600"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)}>
                Cancel
              </Button>
              <Button className="bg-purple-500 hover:bg-purple-600">
                Create Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
    </TooltipProvider>
  )
}

// Utility function
function formatTimeAgo(date: string | Date): string {
  const now = new Date()
  const past = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return past.toLocaleDateString()
}