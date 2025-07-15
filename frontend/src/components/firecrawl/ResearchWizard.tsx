'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Info,
  Search,
  Building2,
  User,
  Globe,
  MapPin,
  Calendar,
  Briefcase,
  GraduationCap,
  Hash,
  Link2,
  FileText,
  Target,
  Lightbulb,
  Brain,
  Sparkles,
  Loader2,
  Download,
  Share2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  CheckCheck,
  Clock,
  TrendingUp,
  Users,
  Network,
  Shield,
  Award,
  MessageSquare,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useToast } from '@/hooks/use-toast'
import { getResearchSystem } from '@/lib/firecrawl/research-system'

interface ResearchWizardProps {
  templateId: string
  onComplete?: (results: any) => void
  onCancel?: () => void
}

interface StepConfig {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  fields: FieldConfig[]
}

interface FieldConfig {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'url' | 'multiselect'
  placeholder?: string
  required: boolean
  options?: { value: string; label: string }[]
  helpText?: string
  validation?: (value: any) => string | null
}

interface ResearchProgress {
  phase: string
  progress: number
  currentAction: string
  sources: number
  findings: number
}

const templateConfigs: Record<string, { steps: StepConfig[]; estimatedTime: number }> = {
  'executive-profile': {
    estimatedTime: 15,
    steps: [
      {
        id: 'target',
        title: 'Executive Information',
        description: 'Tell us about the executive you want to research',
        icon: <User className="h-5 w-5" />,
        fields: [
          {
            id: 'executiveName',
            label: 'Executive Name',
            type: 'text',
            placeholder: 'e.g., John Smith',
            required: true,
            helpText: 'Full name as it appears professionally'
          },
          {
            id: 'currentCompany',
            label: 'Current Company',
            type: 'text',
            placeholder: 'e.g., Goldman Sachs',
            required: false,
            helpText: 'Helps narrow down results for common names'
          },
          {
            id: 'currentTitle',
            label: 'Current Title',
            type: 'text',
            placeholder: 'e.g., Managing Director',
            required: false
          },
          {
            id: 'linkedinUrl',
            label: 'LinkedIn Profile URL',
            type: 'url',
            placeholder: 'https://linkedin.com/in/...',
            required: false,
            helpText: 'Provides the most accurate results'
          }
        ]
      },
      {
        id: 'scope',
        title: 'Research Scope',
        description: 'What aspects should we focus on?',
        icon: <Target className="h-5 w-5" />,
        fields: [
          {
            id: 'researchAreas',
            label: 'Research Areas',
            type: 'checkbox',
            required: true,
            options: [
              { value: 'career', label: 'Career History & Progression' },
              { value: 'education', label: 'Educational Background' },
              { value: 'leadership', label: 'Leadership & Management Style' },
              { value: 'network', label: 'Professional Network & Connections' },
              { value: 'publications', label: 'Publications & Thought Leadership' },
              { value: 'compensation', label: 'Compensation Indicators' },
              { value: 'reputation', label: 'Industry Reputation' },
              { value: 'mobility', label: 'Job Mobility Patterns' }
            ]
          },
          {
            id: 'timeframe',
            label: 'Focus Period',
            type: 'select',
            required: false,
            options: [
              { value: 'all', label: 'Entire Career' },
              { value: '5y', label: 'Last 5 Years' },
              { value: '10y', label: 'Last 10 Years' },
              { value: 'current', label: 'Current Role Only' }
            ]
          }
        ]
      },
      {
        id: 'context',
        title: 'Additional Context',
        description: 'Any specific information to guide the research?',
        icon: <Info className="h-5 w-5" />,
        fields: [
          {
            id: 'specificQuestions',
            label: 'Specific Questions',
            type: 'textarea',
            placeholder: 'e.g., What is their experience with digital transformation? Have they managed teams larger than 100?',
            required: false,
            helpText: 'We\'ll prioritize finding answers to these questions'
          },
          {
            id: 'nameVariations',
            label: 'Name Variations',
            type: 'text',
            placeholder: 'e.g., John Smith, J. Smith, John R. Smith',
            required: false,
            helpText: 'Other names they might go by'
          }
        ]
      }
    ]
  },
  'company-intelligence': {
    estimatedTime: 20,
    steps: [
      {
        id: 'company',
        title: 'Company Details',
        description: 'Which company should we analyze?',
        icon: <Building2 className="h-5 w-5" />,
        fields: [
          {
            id: 'companyName',
            label: 'Company Name',
            type: 'text',
            placeholder: 'e.g., Morgan Stanley',
            required: true,
            helpText: 'Official company name'
          },
          {
            id: 'websiteUrl',
            label: 'Company Website',
            type: 'url',
            placeholder: 'https://www.example.com',
            required: false,
            helpText: 'Helps ensure we analyze the correct company'
          },
          {
            id: 'industry',
            label: 'Industry',
            type: 'select',
            required: true,
            options: [
              { value: 'financial-services', label: 'Financial Services' },
              { value: 'wealth-management', label: 'Wealth Management' },
              { value: 'investment-banking', label: 'Investment Banking' },
              { value: 'private-equity', label: 'Private Equity' },
              { value: 'asset-management', label: 'Asset Management' },
              { value: 'insurance', label: 'Insurance' },
              { value: 'fintech', label: 'FinTech' },
              { value: 'other', label: 'Other' }
            ]
          },
          {
            id: 'companySize',
            label: 'Company Size',
            type: 'select',
            required: false,
            options: [
              { value: 'startup', label: 'Startup (1-50)' },
              { value: 'small', label: 'Small (51-200)' },
              { value: 'medium', label: 'Medium (201-1000)' },
              { value: 'large', label: 'Large (1001-5000)' },
              { value: 'enterprise', label: 'Enterprise (5000+)' }
            ]
          }
        ]
      },
      {
        id: 'focus',
        title: 'Analysis Focus',
        description: 'What aspects are most important?',
        icon: <Target className="h-5 w-5" />,
        fields: [
          {
            id: 'analysisAreas',
            label: 'Key Areas to Analyze',
            type: 'checkbox',
            required: true,
            options: [
              { value: 'culture', label: 'Company Culture & Values' },
              { value: 'financial', label: 'Financial Performance' },
              { value: 'leadership', label: 'Leadership Team' },
              { value: 'growth', label: 'Growth Trajectory' },
              { value: 'competitors', label: 'Competitive Position' },
              { value: 'technology', label: 'Technology & Innovation' },
              { value: 'talent', label: 'Talent & Hiring Trends' },
              { value: 'news', label: 'Recent News & Developments' }
            ]
          },
          {
            id: 'comparisons',
            label: 'Compare Against',
            type: 'text',
            placeholder: 'e.g., JPMorgan, Bank of America',
            required: false,
            helpText: 'Comma-separated list of competitors'
          }
        ]
      }
    ]
  },
  'talent-market': {
    estimatedTime: 15,
    steps: [
      {
        id: 'role',
        title: 'Role Definition',
        description: 'What type of talent are you researching?',
        icon: <Briefcase className="h-5 w-5" />,
        fields: [
          {
            id: 'roleTitle',
            label: 'Role/Title',
            type: 'text',
            placeholder: 'e.g., Financial Advisor, Wealth Manager',
            required: true
          },
          {
            id: 'seniorityLevel',
            label: 'Seniority Level',
            type: 'select',
            required: true,
            options: [
              { value: 'entry', label: 'Entry Level (0-2 years)' },
              { value: 'mid', label: 'Mid Level (3-5 years)' },
              { value: 'senior', label: 'Senior Level (6-10 years)' },
              { value: 'lead', label: 'Lead/Principal (10-15 years)' },
              { value: 'executive', label: 'Executive (15+ years)' }
            ]
          },
          {
            id: 'specializations',
            label: 'Specializations',
            type: 'multiselect',
            required: false,
            options: [
              { value: 'hnw', label: 'High Net Worth' },
              { value: 'uhnw', label: 'Ultra High Net Worth' },
              { value: 'retirement', label: 'Retirement Planning' },
              { value: 'estate', label: 'Estate Planning' },
              { value: 'tax', label: 'Tax Planning' },
              { value: 'alternative', label: 'Alternative Investments' },
              { value: 'institutional', label: 'Institutional' }
            ]
          }
        ]
      },
      {
        id: 'location',
        title: 'Geographic Focus',
        description: 'Where are you looking for talent?',
        icon: <MapPin className="h-5 w-5" />,
        fields: [
          {
            id: 'locations',
            label: 'Target Locations',
            type: 'text',
            placeholder: 'e.g., New York, San Francisco, Boston',
            required: true,
            helpText: 'Comma-separated list of cities or regions'
          },
          {
            id: 'remoteOpen',
            label: 'Remote Consideration',
            type: 'radio',
            required: true,
            options: [
              { value: 'onsite', label: 'On-site Only' },
              { value: 'hybrid', label: 'Hybrid Acceptable' },
              { value: 'remote', label: 'Fully Remote OK' }
            ]
          }
        ]
      },
      {
        id: 'requirements',
        title: 'Key Requirements',
        description: 'What qualifications are important?',
        icon: <Award className="h-5 w-5" />,
        fields: [
          {
            id: 'certifications',
            label: 'Required Certifications',
            type: 'checkbox',
            required: false,
            options: [
              { value: 'cfp', label: 'CFP (Certified Financial Planner)' },
              { value: 'cfa', label: 'CFA (Chartered Financial Analyst)' },
              { value: 'chfc', label: 'ChFC (Chartered Financial Consultant)' },
              { value: 'cpa', label: 'CPA (Certified Public Accountant)' },
              { value: 'series7', label: 'Series 7' },
              { value: 'series66', label: 'Series 66' }
            ]
          },
          {
            id: 'aum',
            label: 'Minimum AUM',
            type: 'select',
            required: false,
            options: [
              { value: 'none', label: 'No Minimum' },
              { value: '25m', label: '$25M+' },
              { value: '50m', label: '$50M+' },
              { value: '100m', label: '$100M+' },
              { value: '250m', label: '$250M+' },
              { value: '500m', label: '$500M+' }
            ]
          }
        ]
      }
    ]
  }
}

export function ResearchWizard({ templateId, onComplete, onCancel }: ResearchWizardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isResearching, setIsResearching] = useState(false)
  const [researchProgress, setResearchProgress] = useState<ResearchProgress>({
    phase: '',
    progress: 0,
    currentAction: '',
    sources: 0,
    findings: 0
  })
  const [researchResults, setResearchResults] = useState<any>(null)

  const config = templateConfigs[templateId]
  if (!config) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-6">
          <p className="text-gray-400">Template configuration not found</p>
        </CardContent>
      </Card>
    )
  }

  const currentStepConfig = config.steps[currentStep]
  const totalSteps = config.steps.length

  const validateStep = () => {
    const stepErrors: Record<string, string> = {}
    
    currentStepConfig.fields.forEach(field => {
      const value = formData[field.id]
      
      if (field.required && !value) {
        stepErrors[field.id] = `${field.label} is required`
      }
      
      if (field.validation && value) {
        const error = field.validation(value)
        if (error) {
          stepErrors[field.id] = error
        }
      }
      
      if (field.type === 'url' && value) {
        try {
          new URL(value)
        } catch {
          stepErrors[field.id] = 'Please enter a valid URL'
        }
      }
    })
    
    setErrors(stepErrors)
    return Object.keys(stepErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < totalSteps - 1) {
        setCurrentStep(currentStep + 1)
      } else {
        startResearch()
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const updateField = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })
    }
  }

  const startResearch = async () => {
    setIsResearching(true)
    const researchSystem = getResearchSystem()

    try {
      // Simulate research progress
      const progressInterval = setInterval(() => {
        setResearchProgress(prev => {
          const newProgress = Math.min(prev.progress + 5, 95)
          const phases = [
            { min: 0, max: 20, phase: 'Initializing research', action: 'Setting up research parameters...' },
            { min: 20, max: 40, phase: 'Searching sources', action: 'Scanning web for relevant information...' },
            { min: 40, max: 60, phase: 'Analyzing data', action: 'Processing and extracting insights...' },
            { min: 60, max: 80, phase: 'Validating findings', action: 'Cross-referencing sources...' },
            { min: 80, max: 95, phase: 'Generating report', action: 'Compiling comprehensive analysis...' }
          ]
          
          const currentPhase = phases.find(p => newProgress >= p.min && newProgress <= p.max)
          
          return {
            ...prev,
            progress: newProgress,
            phase: currentPhase?.phase || prev.phase,
            currentAction: currentPhase?.action || prev.currentAction,
            sources: Math.floor(newProgress / 10) + 3,
            findings: Math.floor(newProgress / 5) + 2
          }
        })
      }, 500)

      // Call the appropriate research method based on template
      let results
      switch (templateId) {
        case 'executive-profile':
          results = await researchSystem.executiveProfiles(
            formData.executiveName,
            formData.currentCompany
          )
          break
        case 'company-intelligence':
          results = await researchSystem.companyIntelligence(
            formData.companyName,
            { depth: 2 }
          )
          break
        case 'talent-market':
          // This would need a new method in research-system.ts
          results = {
            id: `research_${Date.now()}`,
            findings: {
              summary: 'Talent market analysis completed',
              keyPoints: ['Mock finding 1', 'Mock finding 2'],
              sources: [],
              entities: { companies: [], people: [], locations: [], dates: [] },
              insights: ['Mock insight 1', 'Mock insight 2']
            }
          }
          break
        default:
          throw new Error('Unknown template')
      }

      clearInterval(progressInterval)
      setResearchProgress(prev => ({ ...prev, progress: 100, phase: 'Complete', currentAction: 'Research finished!' }))
      setResearchResults(results)
      
      toast({
        title: 'Research Complete',
        description: `Found ${results.findings.keyPoints.length} key insights from ${results.findings.sources.length} sources`,
        variant: 'success'
      })

      if (onComplete) {
        onComplete(results)
      }
    } catch (error) {
      console.error('Research failed:', error)
      toast({
        title: 'Research Failed',
        description: 'An error occurred during research. Please try again.',
        variant: 'destructive'
      })
      setIsResearching(false)
    }
  }

  const renderField = (field: FieldConfig) => {
    const value = formData[field.id] || ''
    const error = errors[field.id]

    switch (field.type) {
      case 'text':
      case 'url':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-gray-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type === 'url' ? 'url' : 'text'}
              value={value}
              onChange={(e) => updateField(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={cn(
                "bg-gray-800 border-gray-700 text-gray-100",
                error && "border-red-500"
              )}
            />
            {field.helpText && !error && (
              <p className="text-xs text-gray-500">{field.helpText}</p>
            )}
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-gray-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              value={value}
              onChange={(e) => updateField(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={cn(
                "bg-gray-800 border-gray-700 text-gray-100 min-h-[100px]",
                error && "border-red-500"
              )}
            />
            {field.helpText && !error && (
              <p className="text-xs text-gray-500">{field.helpText}</p>
            )}
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        )

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-gray-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(v) => updateField(field.id, v)}>
              <SelectTrigger className={cn(
                "bg-gray-800 border-gray-700 text-gray-100",
                error && "border-red-500"
              )}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        )

      case 'radio':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-gray-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            <RadioGroup value={value} onValueChange={(v) => updateField(field.id, v)}>
              {field.options?.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`${field.id}-${option.value}`} />
                  <Label htmlFor={`${field.id}-${option.value}`} className="text-gray-400 font-normal">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        )

      case 'checkbox':
        const checkedValues = Array.isArray(value) ? value : []
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-gray-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {field.options?.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${option.value}`}
                    checked={checkedValues.includes(option.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updateField(field.id, [...checkedValues, option.value])
                      } else {
                        updateField(field.id, checkedValues.filter(v => v !== option.value))
                      }
                    }}
                  />
                  <Label 
                    htmlFor={`${field.id}-${option.value}`} 
                    className="text-gray-400 font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (isResearching) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <Brain className="h-5 w-5 text-purple-400 animate-pulse" />
            Research in Progress
          </CardTitle>
          <CardDescription>
            Analyzing multiple sources to compile comprehensive insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{researchProgress.phase}</span>
              <span className="text-gray-400">{researchProgress.progress}%</span>
            </div>
            <Progress value={researchProgress.progress} className="h-2" />
            <p className="text-xs text-gray-500">{researchProgress.currentAction}</p>
          </div>

          {/* Live Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Sources Analyzed</p>
                    <p className="text-2xl font-bold text-gray-100">{researchProgress.sources}</p>
                  </div>
                  <Globe className="h-8 w-8 text-blue-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Insights Found</p>
                    <p className="text-2xl font-bold text-gray-100">{researchProgress.findings}</p>
                  </div>
                  <Lightbulb className="h-8 w-8 text-yellow-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Research Phases */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">Research Phases</Label>
            <div className="space-y-1">
              {['Initializing', 'Searching sources', 'Analyzing data', 'Validating findings', 'Generating report'].map((phase, index) => {
                const phaseProgress = Math.max(0, Math.min(100, (researchProgress.progress - index * 20) * 5))
                return (
                  <div key={phase} className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                      phaseProgress === 100 
                        ? "bg-green-500/20 text-green-400" 
                        : phaseProgress > 0
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-gray-800 text-gray-600"
                    )}>
                      {phaseProgress === 100 ? <CheckCheck className="h-3 w-3" /> : index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm",
                          phaseProgress > 0 ? "text-gray-300" : "text-gray-600"
                        )}>
                          {phase}
                        </span>
                        {phaseProgress > 0 && phaseProgress < 100 && (
                          <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tips */}
          <Alert className="bg-purple-900/20 border-purple-800/50">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <AlertDescription className="text-gray-300 text-sm">
              Pro tip: Our AI is analyzing {researchProgress.sources} sources simultaneously to provide 
              you with the most comprehensive and accurate insights. This typically takes {config.estimatedTime} minutes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (researchResults) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-100">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              Research Complete
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Results preview - this would be expanded */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">Sources Analyzed</p>
                  <p className="text-xl font-bold text-gray-100">
                    {researchResults.findings?.sources?.length || 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">Key Findings</p>
                  <p className="text-xl font-bold text-gray-100">
                    {researchResults.findings?.keyPoints?.length || 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">Confidence</p>
                  <p className="text-xl font-bold text-gray-100">
                    {Math.round((researchResults.metadata?.confidence || 0) * 100)}%
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <Button 
              className="w-full"
              onClick={() => router.push(`/dashboard/firecrawl/results/${researchResults.id}`)}
            >
              View Full Report
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-gray-100">{currentStepConfig.title}</CardTitle>
            <CardDescription>{currentStepConfig.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {currentStepConfig.icon}
            <Badge variant="secondary" className="bg-gray-800">
              Step {currentStep + 1} of {totalSteps}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <Progress value={(currentStep / (totalSteps - 1)) * 100} className="h-2" />

        {/* Form Fields */}
        <div className="space-y-4">
          {currentStepConfig.fields.map(renderField)}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={currentStep === 0 ? onCancel : handleBack}
            className="text-gray-400"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  index === currentStep
                    ? "bg-purple-500"
                    : index < currentStep
                    ? "bg-purple-500/50"
                    : "bg-gray-700"
                )}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {currentStep === totalSteps - 1 ? 'Start Research' : 'Next'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}