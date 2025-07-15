'use client'

import { useState, useEffect } from 'react'
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
  Music
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'

interface ResearchTemplate {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  category: 'executive' | 'company' | 'market' | 'talent'
  estimatedTime: string
  popularity: number
  proTips: string[]
  requiredInputs: string[]
  deliverables: string[]
  gradient: string
}

interface RecentResearch {
  id: string
  template: string
  target: string
  completedAt: Date
  findings: number
  quality: 'high' | 'medium' | 'low'
  status: 'completed' | 'in-progress' | 'scheduled'
}

interface ResearchInsight {
  id: string
  type: 'trend' | 'opportunity' | 'risk' | 'recommendation'
  title: string
  description: string
  confidence: number
  sources: number
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
    gradient: 'from-blue-500 to-purple-500'
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
    gradient: 'from-green-500 to-emerald-500'
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
    gradient: 'from-cyan-500 to-blue-500'
  }
]

const mockRecentResearch: RecentResearch[] = [
  {
    id: '1',
    template: 'Executive Deep Dive',
    target: 'John Smith - CEO at TechCorp',
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    findings: 47,
    quality: 'high',
    status: 'completed'
  },
  {
    id: '2',
    template: 'Company Intelligence Report',
    target: 'Innovative Solutions Inc.',
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    findings: 62,
    quality: 'high',
    status: 'completed'
  },
  {
    id: '3',
    template: 'Talent Market Intelligence',
    target: 'Senior Software Engineers - Bay Area',
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    findings: 38,
    quality: 'medium',
    status: 'completed'
  }
]

const mockInsights: ResearchInsight[] = [
  {
    id: '1',
    type: 'trend',
    title: 'Rising demand for AI expertise in Financial Services',
    description: 'Analysis shows 240% increase in AI-related job postings in financial services over the past 6 months.',
    confidence: 92,
    sources: 15
  },
  {
    id: '2',
    type: 'opportunity',
    title: 'Untapped talent pool in remote markets',
    description: 'Identified 3,000+ qualified candidates in secondary markets with 30% lower compensation expectations.',
    confidence: 88,
    sources: 12
  },
  {
    id: '3',
    type: 'risk',
    title: 'Competitor actively recruiting from your client',
    description: 'BlackRock has hired 8 senior advisors from your client in the past quarter.',
    confidence: 95,
    sources: 8
  }
]

export default function RecruiterIntelligenceHub() {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [recentResearch, setRecentResearch] = useState<RecentResearch[]>([])
  const [insights, setInsights] = useState<ResearchInsight[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setRecentResearch(mockRecentResearch)
      setInsights(mockInsights)
      setIsLoading(false)
    }, 1000)
  }, [])

  const filteredTemplates = selectedCategory === 'all' 
    ? researchTemplates 
    : researchTemplates.filter(t => t.category === selectedCategory)

  const categories = [
    { id: 'all', label: 'All Research', icon: <Brain className="h-4 w-4" /> },
    { id: 'executive', label: 'Executive', icon: <User className="h-4 w-4" /> },
    { id: 'company', label: 'Company', icon: <Building2 className="h-4 w-4" /> },
    { id: 'market', label: 'Market', icon: <Globe className="h-4 w-4" /> },
    { id: 'talent', label: 'Talent', icon: <Users className="h-4 w-4" /> }
  ]

  const getInsightIcon = (type: ResearchInsight['type']) => {
    switch (type) {
      case 'trend': return <TrendingUp className="h-4 w-4" />
      case 'opportunity': return <Lightbulb className="h-4 w-4" />
      case 'risk': return <Shield className="h-4 w-4" />
      case 'recommendation': return <Target className="h-4 w-4" />
    }
  }

  const getInsightColor = (type: ResearchInsight['type']) => {
    switch (type) {
      case 'trend': return 'text-blue-400 bg-blue-500/10'
      case 'opportunity': return 'text-green-400 bg-green-500/10'
      case 'risk': return 'text-red-400 bg-red-500/10'
      case 'recommendation': return 'text-purple-400 bg-purple-500/10'
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

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-100">
              Recruiter Intelligence Hub
            </h1>
          </div>
          <p className="text-gray-400">
            AI-powered research templates designed specifically for financial advisor recruiting
          </p>
        </motion.div>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <Card className="bg-gray-900/50 border-gray-800">
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
                <CheckCircle2 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Time Saved</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">82 hrs</p>
                  <p className="text-xs text-blue-400 mt-1">This month</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Insights Generated</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">1,429</p>
                  <p className="text-xs text-purple-400 mt-1">Actionable findings</p>
                </div>
                <Lightbulb className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">94%</p>
                  <p className="text-xs text-green-400 mt-1">High-quality results</p>
                </div>
                <Award className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content */}
        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList className="bg-gray-900/50 border border-gray-800">
            <TabsTrigger value="templates" className="data-[state=active]:bg-gray-800">
              <Brain className="h-4 w-4 mr-2" />
              Research Templates
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-gray-800">
              <Lightbulb className="h-4 w-4 mr-2" />
              Latest Insights
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-gray-800">
              <History className="h-4 w-4 mr-2" />
              Recent Research
            </TabsTrigger>
            <TabsTrigger value="tools" className="data-[state=active]:bg-gray-800">
              <Settings className="h-4 w-4 mr-2" />
              Advanced Tools
            </TabsTrigger>
          </TabsList>

          {/* Research Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            {/* Category Filter */}
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
                </Button>
              ))}
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className="h-full bg-gray-900/50 border-gray-800 hover:border-gray-700 cursor-pointer transition-all hover:shadow-lg hover:shadow-purple-500/10"
                    onClick={() => handleTemplateClick(template.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4">
                        <div className={cn(
                          "p-3 rounded-lg bg-gradient-to-br",
                          template.gradient
                        )}>
                          {template.icon}
                        </div>
                        <Badge variant="secondary" className="bg-gray-800">
                          {template.popularity}% used
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-gray-100">
                        {template.title}
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                        <div className="flex -space-x-2">
                          {template.requiredInputs.slice(0, 3).map((_, i) => (
                            <div
                              key={i}
                              className="w-6 h-6 bg-gray-700 rounded-full border-2 border-gray-900 flex items-center justify-center"
                            >
                              <span className="text-xs text-gray-400">{i + 1}</span>
                            </div>
                          ))}
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

          {/* Latest Insights Tab */}
          <TabsContent value="insights" className="space-y-4">
            {insights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "p-3 rounded-lg",
                        getInsightColor(insight.type)
                      )}>
                        {getInsightIcon(insight.type)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-gray-100">
                            {insight.title}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {insight.confidence}% confidence
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400">
                          {insight.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {insight.sources} sources
                          </span>
                          <Button size="sm" variant="ghost" className="h-6 text-xs text-purple-400">
                            View Details
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
        </Tabs>
      </div>
    </div>
  )
}