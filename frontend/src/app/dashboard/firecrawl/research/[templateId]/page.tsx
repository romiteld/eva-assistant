'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft,
  Brain,
  User,
  Building2,
  Target,
  Users,
  TrendingUp,
  Network,
  Info,
  Clock,
  FileSearch,
  Award,
  Shield,
  Lightbulb,
  CheckCircle2
} from 'lucide-react'
import { ResearchWizard } from '@/components/firecrawl/ResearchWizard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface TemplateInfo {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  category: string
  estimatedTime: string
  deliverables: string[]
  proTips: string[]
  gradient: string
}

const templateInfo: Record<string, TemplateInfo> = {
  'executive-profile': {
    id: 'executive-profile',
    title: 'Executive Deep Dive',
    description: 'Comprehensive background check and career analysis for C-suite executives and senior leaders',
    icon: <User className="h-6 w-6" />,
    category: 'Executive Research',
    estimatedTime: '10-15 mins',
    deliverables: [
      'Career Timeline & Progression',
      'Educational Background',
      'Previous Companies & Roles',
      'Board Positions & Affiliations',
      'Public Speaking & Publications',
      'Professional Network Analysis'
    ],
    proTips: [
      'Include LinkedIn URL for better results',
      'Add company name for context',
      'Check multiple name variations'
    ],
    gradient: 'from-blue-500 to-purple-500'
  },
  'company-intelligence': {
    id: 'company-intelligence',
    title: 'Company Intelligence Report',
    description: 'In-depth analysis of company culture, growth trajectory, and financial health',
    icon: <Building2 className="h-6 w-6" />,
    category: 'Company Research',
    estimatedTime: '15-20 mins',
    deliverables: [
      'Company Overview & History',
      'Financial Performance',
      'Leadership Team Analysis',
      'Culture & Values Assessment',
      'Recent News & Developments',
      'Competitive Positioning'
    ],
    proTips: [
      'Use official company name',
      'Include website URL',
      'Specify industry for better context'
    ],
    gradient: 'from-green-500 to-emerald-500'
  },
  'competitor-landscape': {
    id: 'competitor-landscape',
    title: 'Competitive Landscape Analysis',
    description: 'Identify and analyze key competitors, market positioning, and differentiation strategies',
    icon: <Target className="h-6 w-6" />,
    category: 'Market Research',
    estimatedTime: '20-25 mins',
    deliverables: [
      'Top 5-10 Competitors',
      'Market Share Analysis',
      'Competitive Advantages',
      'SWOT Analysis',
      'Talent Movement Patterns',
      'Strategic Recommendations'
    ],
    proTips: [
      'Define market segment clearly',
      'Include geographic scope',
      'Specify company size range'
    ],
    gradient: 'from-orange-500 to-red-500'
  },
  'talent-market': {
    id: 'talent-market',
    title: 'Talent Market Intelligence',
    description: 'Analyze talent pools, compensation trends, and skill availability in specific markets',
    icon: <Users className="h-6 w-6" />,
    category: 'Talent Research',
    estimatedTime: '15-20 mins',
    deliverables: [
      'Talent Pool Size & Availability',
      'Compensation Benchmarks',
      'Skill Distribution',
      'Top Employers in Market',
      'Talent Movement Trends',
      'Sourcing Recommendations'
    ],
    proTips: [
      'Be specific about role titles',
      'Include required skills',
      'Define experience level'
    ],
    gradient: 'from-purple-500 to-pink-500'
  },
  'industry-trends': {
    id: 'industry-trends',
    title: 'Industry Trends & Insights',
    description: 'Track emerging trends, disruptions, and opportunities in specific industries',
    icon: <TrendingUp className="h-6 w-6" />,
    category: 'Market Research',
    estimatedTime: '10-15 mins',
    deliverables: [
      'Key Industry Trends',
      'Emerging Technologies',
      'Market Growth Projections',
      'Regulatory Changes',
      'Investment Activity',
      'Future Outlook'
    ],
    proTips: [
      'Focus on specific sub-sectors',
      'Include timeframe',
      'Mention geographic focus'
    ],
    gradient: 'from-indigo-500 to-blue-500'
  },
  'relationship-mapping': {
    id: 'relationship-mapping',
    title: 'Professional Network Mapping',
    description: 'Map professional connections and identify warm introduction paths',
    icon: <Network className="h-6 w-6" />,
    category: 'Executive Research',
    estimatedTime: '12-18 mins',
    deliverables: [
      'Connection Map Visualization',
      'Mutual Connections',
      'Introduction Paths',
      'Relationship Strength Analysis',
      'Engagement History',
      'Outreach Recommendations'
    ],
    proTips: [
      'Include multiple targets',
      'Add your company context',
      'Specify relationship types'
    ],
    gradient: 'from-cyan-500 to-blue-500'
  }
}

export default function ResearchTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const templateId = params.templateId as string
  const [showWizard, setShowWizard] = useState(false)

  const template = templateInfo[templateId]

  if (!template) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6">
              <p className="text-gray-400">Template not found</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => router.push('/dashboard/firecrawl')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Intelligence Hub
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const handleComplete = (results: any) => {
    // Handle completion - could redirect to results page
    console.log('Research completed:', results)
  }

  const handleCancel = () => {
    setShowWizard(false)
  }

  if (showWizard) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => setShowWizard(false)}
                className="text-gray-400 hover:text-gray-300"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Overview
              </Button>
            </div>
            
            <ResearchWizard
              templateId={templateId}
              onComplete={handleComplete}
              onCancel={handleCancel}
            />
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/firecrawl')}
            className="mb-6 text-gray-400 hover:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Intelligence Hub
          </Button>

          <div className="flex items-start gap-6">
            <div className={cn(
              "p-4 rounded-xl bg-gradient-to-br",
              template.gradient
            )}>
              {template.icon}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-100">
                  {template.title}
                </h1>
                <Badge variant="secondary" className="bg-gray-800">
                  {template.category}
                </Badge>
              </div>
              <p className="text-gray-400 text-lg">
                {template.description}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {template.estimatedTime}
                </span>
                <span className="flex items-center gap-1">
                  <FileSearch className="h-4 w-4" />
                  {template.deliverables.length} deliverables
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Deliverables & Tips */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    What You'll Receive
                  </CardTitle>
                  <CardDescription>
                    Comprehensive research deliverables from our AI analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {template.deliverables.map((deliverable, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                      >
                        <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                          <span className="text-xs text-green-400">{index + 1}</span>
                        </div>
                        <span className="text-sm text-gray-300">{deliverable}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-100">
                    <Lightbulb className="h-5 w-5 text-yellow-400" />
                    Pro Tips
                  </CardTitle>
                  <CardDescription>
                    Get the most accurate results with these best practices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {template.proTips.map((tip, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs text-yellow-400">!</span>
                        </div>
                        <p className="text-sm text-gray-300">{tip}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Action Card */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-100">Ready to Start?</CardTitle>
                  <CardDescription>
                    Launch the research wizard to begin
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Shield className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">100% Secure & Confidential</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Award className="h-4 w-4 text-blue-400" />
                      <span className="text-gray-300">AI-Powered Analysis</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Brain className="h-4 w-4 text-purple-400" />
                      <span className="text-gray-300">Real-time Processing</span>
                    </div>
                  </div>

                  <Separator className="bg-gray-700" />

                  <Button 
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    size="lg"
                    onClick={() => setShowWizard(true)}
                  >
                    Start Research Wizard
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    Takes approximately {template.estimatedTime}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Alert className="bg-blue-900/20 border-blue-800/50">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-gray-300 text-sm">
                  Our AI analyzes 100+ sources including company websites, news articles, 
                  social media, and professional databases to provide comprehensive insights.
                </AlertDescription>
              </Alert>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}