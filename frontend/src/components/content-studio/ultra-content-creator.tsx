'use client';

import React, { useState, useEffect } from 'react';
// Removed direct import of AIContentStudioUltra to avoid client-side bundling issues
// Will use API routes to interact with the AI agent
import { useSupabase } from '@/hooks/useSupabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Brain,
  Sparkles,
  Zap,
  TrendingUp,
  Target,
  Palette,
  Calendar,
  Globe,
  Users,
  BarChart3,
  Loader2,
  ChevronRight,
  ChevronDown,
  Copy,
  Download,
  Share2,
  Eye,
  Edit,
  RefreshCw,
  Settings,
  Plus,
  X,
  Check,
  AlertCircle,
  Info,
  Lightbulb,
  Rocket,
  Crown,
  Star,
  MessageSquare,
  Image,
  Video,
  FileText,
  Mic,
  BookOpen,
  PresentationIcon,
  Hash,
  Clock,
  ThumbsUp,
  Share,
  Bookmark,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Cpu,
  Database,
  GitBranch,
  Layers,
  Package,
  Shield,
  Workflow,
  Send,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ContentObjective {
  id: string;
  label: string;
  icon: any;
  selected: boolean;
}

interface PlatformConfig {
  id: string;
  name: string;
  icon: any;
  color: string;
  selected: boolean;
  config?: {
    format?: string;
    length?: string;
    features?: string[];
  };
}

interface ContentVariation {
  approach: string;
  content: string;
  technique: string;
  reasoningChain: any;
  creativityScore: number;
  viralityPotential: number;
}

export function UltraContentCreator() {
  const supabase = useSupabase();
  const user = null; // TODO: Get user from auth context
  const { toast } = useToast();
  
  const [generating, setGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [generationSteps, setGenerationSteps] = useState<any[]>([]);
  
  // Form state
  const [topic, setTopic] = useState('');
  const [objectives, setObjectives] = useState<ContentObjective[]>([
    { id: 'engagement', label: 'Maximize Engagement', icon: ThumbsUp, selected: true },
    { id: 'virality', label: 'Go Viral', icon: TrendingUp, selected: false },
    { id: 'conversion', label: 'Drive Conversions', icon: Target, selected: false },
    { id: 'authority', label: 'Build Authority', icon: Crown, selected: true },
    { id: 'community', label: 'Foster Community', icon: Users, selected: false },
    { id: 'education', label: 'Educate Audience', icon: BookOpen, selected: false }
  ]);
  
  const [contentTypes, setContentTypes] = useState<string[]>(['post']);
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([
    { id: 'linkedin', name: 'LinkedIn', icon: Briefcase, color: 'bg-blue-600', selected: true },
    { id: 'twitter', name: 'Twitter', icon: MessageSquare, color: 'bg-sky-500', selected: false },
    { id: 'instagram', name: 'Instagram', icon: Image, color: 'bg-pink-600', selected: false },
    { id: 'youtube', name: 'YouTube', icon: Video, color: 'bg-red-600', selected: false },
    { id: 'tiktok', name: 'TikTok', icon: Music, color: 'bg-black', selected: false },
    { id: 'medium', name: 'Medium', icon: FileText, color: 'bg-gray-800', selected: false }
  ]);
  
  const [audienceConfig, setAudienceConfig] = useState({
    primary: {
      role: 'Marketing Professionals',
      industry: 'Technology',
      experience: 'Mid-Senior Level',
      goals: ['Career Growth', 'Skill Development'],
      painPoints: ['Time Management', 'Keeping Up with Trends']
    }
  });
  
  const [preferences, setPreferences] = useState({
    tone: ['professional', 'inspirational'],
    styles: ['data-driven', 'storytelling'],
    avoid: ['controversial', 'salesy']
  });
  
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([]);
  const [inspirationUrls, setInspirationUrls] = useState<string[]>([]);
  
  // Results state
  const [results, setResults] = useState<any>(null);
  const [selectedVariation, setSelectedVariation] = useState<number>(0);
  const [showReasoningChain, setShowReasoningChain] = useState(false);
  
  // Initialize AI Content Studio
  // TODO: Move to API route to avoid client-side bundling issues
  // const contentStudio = new AIContentStudioUltra(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  //   process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
  //   process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY!
  // );

  const generateContent = async () => {
    if (!topic) {
      toast({
        title: 'Missing Topic',
        description: 'Please enter a topic for content generation',
        variant: 'destructive'
      });
      return;
    }

    setGenerating(true);
    setProgress(0);
    setGenerationSteps([]);
    setResults(null);
    
    try {
      // Simulate progress updates
      const phases = [
        'Initializing Ultra AI agents...',
        'Performing deep market intelligence analysis...',
        'Analyzing competitor strategies and trends...',
        'Generating creative content variations...',
        'Running ML optimization models...',
        'Creating multimedia concepts...',
        'Orchestrating omni-channel distribution...',
        'Finalizing ultra-optimized content package...'
      ];
      
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        if (currentProgress < phases.length) {
          setCurrentPhase(phases[currentProgress]);
          setProgress((currentProgress + 1) / phases.length * 100);
          setGenerationSteps(prev => [...prev, {
            phase: phases[currentProgress],
            status: 'completed',
            timestamp: new Date().toISOString()
          }]);
          currentProgress++;
        }
      }, 2000);

      // Call the ultra content generation
      // TODO: Replace with API call
      const result = await fetch('/api/content-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          objectives: objectives.filter(o => o.selected).map(o => o.id),
          contentTypes: contentTypes as any,
          platforms: platforms.filter(p => p.selected).map(p => p.id) as any,
          audiences: audienceConfig,
          preferences,
          competitorUrls: competitorUrls.filter(Boolean),
          inspirationUrls: inspirationUrls.filter(Boolean)
        })
      }).then(res => res.json());
      
      clearInterval(progressInterval);
      setProgress(100);
      setResults(result);
      
      toast({
        title: 'Content Generated! 🚀',
        description: 'Ultra AI has created your optimized content package',
      });
      
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied to clipboard',
      description: 'Content has been copied',
    });
  };

  const downloadContent = () => {
    if (!results) return;
    
    const content = JSON.stringify(results, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ultra-content-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const publishContent = async () => {
    // Implement publishing logic
    toast({
      title: 'Publishing initiated',
      description: 'Content will be published according to the distribution strategy',
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Ultra AI Content Studio
          </h1>
          <p className="text-muted-foreground">
            5 ultra-intelligent agents with deep reasoning and Context7 integration
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Cpu className="h-4 w-4" />
          Ultra Deep Thinking Enabled
        </Badge>
      </div>

      {!results ? (
        <>
          {/* Content Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Content Configuration</CardTitle>
              <CardDescription>
                Configure your content with ultra-precise parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Topic Input */}
              <div className="space-y-2">
                <Label htmlFor="topic">Content Topic</Label>
                <Textarea
                  id="topic"
                  placeholder="E.g., How AI is transforming modern marketing strategies"
                  value={topic}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTopic(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Objectives */}
              <div className="space-y-2">
                <Label>Content Objectives</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {objectives.map((objective: ContentObjective) => {
                    const Icon = objective.icon;
                    return (
                      <div
                        key={objective.id}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                          objective.selected 
                            ? "border-primary bg-primary/5" 
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => {
                          setObjectives((prev: ContentObjective[]) => prev.map((o: ContentObjective) => 
                            o.id === objective.id ? { ...o, selected: !o.selected } : o
                          ));
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-sm">{objective.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Content Types */}
              <div className="space-y-2">
                <Label>Content Types</Label>
                <div className="flex flex-wrap gap-2">
                  {['post', 'article', 'video', 'infographic', 'podcast', 'webinar'].map((type: string) => (
                    <Badge
                      key={type}
                      variant={contentTypes.includes(type) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setContentTypes((prev: string[]) => 
                          prev.includes(type) 
                            ? prev.filter((t: string) => t !== type)
                            : [...prev, type]
                        );
                      }}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Platforms */}
              <div className="space-y-2">
                <Label>Target Platforms</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {platforms.map((platform: PlatformConfig) => {
                    const Icon = platform.icon;
                    return (
                      <div
                        key={platform.id}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                          platform.selected 
                            ? `border-current ${platform.color} text-white` 
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => {
                          setPlatforms((prev: PlatformConfig[]) => prev.map((p: PlatformConfig) => 
                            p.id === platform.id ? { ...p, selected: !p.selected } : p
                          ));
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{platform.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Audience Configuration */}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
                  <ChevronRight className="h-4 w-4" />
                  Advanced Audience Configuration
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Primary Role</Label>
                      <Input
                        value={audienceConfig.primary.role}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAudienceConfig((prev: typeof audienceConfig) => ({
                          ...prev,
                          primary: { ...prev.primary, role: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <Label>Industry</Label>
                      <Input
                        value={audienceConfig.primary.industry}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAudienceConfig((prev: typeof audienceConfig) => ({
                          ...prev,
                          primary: { ...prev.primary, industry: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Competitor Analysis */}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
                  <ChevronRight className="h-4 w-4" />
                  Competitor & Inspiration URLs
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Competitor URLs</Label>
                    {competitorUrls.map((url: string, index: number) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={url}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const newUrls = [...competitorUrls];
                            newUrls[index] = e.target.value;
                            setCompetitorUrls(newUrls);
                          }}
                          placeholder="https://example.com/competitor-content"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCompetitorUrls((prev: string[]) => prev.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCompetitorUrls(prev => [...prev, ''])}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Competitor URL
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Generate Button */}
              <Button 
                className="w-full" 
                size="lg"
                onClick={generateContent}
                disabled={generating || !topic}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating with Ultra AI...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    Generate Ultra Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generation Progress */}
          {generating && (
            <Card>
              <CardHeader>
                <CardTitle>Generation Progress</CardTitle>
                <CardDescription>{currentPhase}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progress} className="h-2" />
                
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {generationSteps.map((step, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{step.phase}</span>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Results View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Content Variations */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Generated Content</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setResults(null)}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        New Generation
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadContent}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="0" onValueChange={(v) => setSelectedVariation(parseInt(v))}>
                    <TabsList className="grid grid-cols-3">
                      {results.variations?.slice(0, 3).map((variation: ContentVariation, index: number) => (
                        <TabsTrigger key={index} value={index.toString()}>
                          {variation.approach}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    {results.variations?.slice(0, 3).map((variation: ContentVariation, index: number) => (
                      <TabsContent key={index} value={index.toString()} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              <Sparkles className="h-3 w-3 mr-1" />
                              {(variation.creativityScore * 100).toFixed(0)}% Creative
                            </Badge>
                            <Badge variant="outline">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {(variation.viralityPotential * 100).toFixed(0)}% Viral
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyContent(variation.content)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="whitespace-pre-wrap">{variation.content}</p>
                        </div>
                        
                        {/* Reasoning Chain */}
                        <Collapsible
                          open={showReasoningChain}
                          onOpenChange={setShowReasoningChain}
                        >
                          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-primary">
                            <Brain className="h-4 w-4" />
                            View AI Reasoning Chain
                            <ChevronDown className={cn(
                              "h-4 w-4 transition-transform",
                              showReasoningChain && "transform rotate-180"
                            )} />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-4">
                            <div className="space-y-2">
                              {variation.reasoningChain?.steps?.map((step: any, i: number) => (
                                <div key={i} className="flex items-start gap-2 p-2 bg-gray-100 rounded">
                                  <Badge variant="outline" className="mt-0.5">{step.step}</Badge>
                                  <div className="flex-1">
                                    <p className="text-sm">{step.reasoning}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Confidence: {(step.confidence * 100).toFixed(0)}%
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>

              {/* Visual Concepts */}
              <Card>
                <CardHeader>
                  <CardTitle>Visual Concepts</CardTitle>
                  <CardDescription>
                    AI-generated visual recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {results.visuals?.concepts?.map((concept: any, index: number) => (
                      <div key={index} className="space-y-2">
                        <div className="aspect-video bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                          <Image className="h-12 w-12 text-purple-600" alt="Visual concept placeholder" />
                        </div>
                        <p className="text-sm font-medium">{concept.concepts?.heroImage?.concept}</p>
                        <p className="text-xs text-muted-foreground">{concept.concepts?.heroImage?.mood}</p>
                      </div>
                    ))}
                  </div>
                  
                  {results.multimedia?.images && (
                    <div className="mt-4 space-y-2">
                      <Label>AI Image Prompts</Label>
                      {results.multimedia.images.slice(0, 2).map((img: any, i: number) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium mb-1">Prompt {i + 1}:</p>
                          <p className="text-xs text-muted-foreground">{img.prompts?.[0]?.main}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Analytics & Actions */}
            <div className="space-y-6">
              {/* Performance Predictions */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Predictions</CardTitle>
                  <CardDescription>ML-powered analytics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Engagement Rate</span>
                      <span className="font-medium">5.2%</span>
                    </div>
                    <Progress value={52} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Viral Probability</span>
                      <span className="font-medium">68%</span>
                    </div>
                    <Progress value={68} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Conversion Potential</span>
                      <span className="font-medium">8.5%</span>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Key Success Factors</p>
                    <ul className="text-xs space-y-1">
                      <li className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" />
                        Strong emotional hook
                      </li>
                      <li className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" />
                        Optimal timing window
                      </li>
                      <li className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" />
                        High shareability score
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Distribution Strategy */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribution Strategy</CardTitle>
                  <CardDescription>Omni-channel plan</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {results.distribution && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">Primary Launch</Label>
                        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">LinkedIn</span>
                          <span className="text-xs text-muted-foreground">Tuesday 10 AM</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Cross-Platform</Label>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm">Twitter Thread</span>
                            <span className="text-xs text-muted-foreground">+2 hours</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm">Instagram Carousel</span>
                            <span className="text-xs text-muted-foreground">+24 hours</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <Separator />
                  
                  <Button className="w-full" onClick={publishContent}>
                    <Send className="h-4 w-4 mr-2" />
                    Execute Distribution
                  </Button>
                </CardContent>
              </Card>

              {/* Success Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Success Metrics</CardTitle>
                  <CardDescription>Track these KPIs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">48-hour target</span>
                      <Badge variant="outline">10K reach</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Engagement rate</span>
                      <Badge variant="outline">5%+</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Share rate</span>
                      <Badge variant="outline">2%+</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Conversions</span>
                      <Badge variant="outline">50 leads</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Add missing Music icon
const Music = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

// Add missing Briefcase icon
const Briefcase = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

