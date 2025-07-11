'use client';

import React, { useState, useCallback } from 'react';
import { AIContentStudio } from '@/lib/agents/ai-content-studio';
import { useSupabase } from '@/hooks/useSupabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Sparkles, 
  BarChart3, 
  Image, 
  Calendar,
  Copy,
  Download,
  Share2,
  Brain,
  TrendingUp,
  Clock,
  Eye,
  MessageSquare,
  Heart,
  Repeat2,
  Send,
  Palette,
  Layout,
  Target,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ContentVariation {
  content: string;
  style: string;
  emotion: string;
  hooks?: string[];
  ctas?: string[];
  prediction?: {
    engagementRate: number;
    viralityScore: number;
    conversionLikelihood: number;
  };
}

interface GenerationProgress {
  stage: string;
  progress: number;
  message: string;
  agents: {
    market: 'idle' | 'running' | 'complete';
    generation: 'idle' | 'running' | 'complete';
    prediction: 'idle' | 'running' | 'complete';
    visual: 'idle' | 'running' | 'complete';
    scheduling: 'idle' | 'running' | 'complete';
  };
}

export function AIContentCreator() {
  const supabase = useSupabase();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({
    stage: 'idle',
    progress: 0,
    message: '',
    agents: {
      market: 'idle',
      generation: 'idle',
      prediction: 'idle',
      visual: 'idle',
      scheduling: 'idle'
    }
  });
  
  const [formData, setFormData] = useState({
    type: 'social',
    platform: 'linkedin',
    topic: '',
    tone: 'professional',
    length: 'medium',
    keywords: '',
    targetAudience: {
      demographics: '',
      interests: '',
      painPoints: ''
    }
  });
  
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [selectedVariation, setSelectedVariation] = useState<number>(0);

  // Initialize AI Content Studio
  const contentStudio = new AIContentStudio(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
    process.env.FIRECRAWL_API_KEY!
  );

  const updateProgress = (stage: string, agentStatus: Partial<GenerationProgress['agents']>) => {
    setProgress(prev => {
      const newAgents = { ...prev.agents, ...agentStatus };
      const completedAgents = Object.values(newAgents).filter(s => s === 'complete').length;
      const totalAgents = Object.keys(newAgents).length;
      
      return {
        stage,
        progress: (completedAgents / totalAgents) * 100,
        message: getProgressMessage(stage),
        agents: newAgents
      };
    });
  };

  const getProgressMessage = (stage: string): string => {
    const messages = {
      'market_analysis': '🔍 Analyzing market trends and competitors...',
      'content_generation': '✍️ Generating content variations...',
      'performance_prediction': '📊 Predicting performance metrics...',
      'visual_media': '🎨 Creating visual recommendations...',
      'scheduling_strategy': '📅 Optimizing distribution strategy...',
      'orchestration': '🎯 Finalizing your content...'
    };
    return messages[stage as keyof typeof messages] || 'Processing...';
  };

  const generateContent = async () => {
    setLoading(true);
    setGeneratedContent(null);
    
    try {
      // Start all agents in parallel
      updateProgress('market_analysis', { 
        market: 'running',
        generation: 'running' 
      });

      // Simulate agent progress (in real implementation, this would be event-driven)
      setTimeout(() => updateProgress('market_analysis', { market: 'complete' }), 2000);
      setTimeout(() => updateProgress('content_generation', { generation: 'complete' }), 3000);
      setTimeout(() => updateProgress('performance_prediction', { prediction: 'running' }), 3500);
      setTimeout(() => updateProgress('visual_media', { visual: 'running' }), 4000);
      setTimeout(() => updateProgress('performance_prediction', { prediction: 'complete' }), 5000);
      setTimeout(() => updateProgress('scheduling_strategy', { scheduling: 'running' }), 5500);
      setTimeout(() => updateProgress('visual_media', { visual: 'complete' }), 6000);
      setTimeout(() => updateProgress('scheduling_strategy', { scheduling: 'complete' }), 7000);

      const result = await contentStudio.generateContent({
        type: formData.type as any,
        platform: formData.platform,
        topic: formData.topic,
        tone: formData.tone,
        keywords: formData.keywords.split(',').map((k: string) => k.trim()).filter(Boolean),
        targetAudience: {
          demographics: formData.targetAudience.demographics,
          interests: formData.targetAudience.interests.split(',').map((i: string) => i.trim()),
          painPoints: formData.targetAudience.painPoints.split(',').map((p: string) => p.trim())
        }
      });

      setGeneratedContent(result);
      
      toast({
        title: 'Content Generated! 🎉',
        description: `Created ${result.variations?.length || 1} variations with performance predictions`,
      });
    } catch (error) {
      console.error('Content generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setProgress({
        stage: 'idle',
        progress: 0,
        message: '',
        agents: {
          market: 'idle',
          generation: 'idle',
          prediction: 'idle',
          visual: 'idle',
          scheduling: 'idle'
        }
      });
    }
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied!',
      description: 'Content copied to clipboard',
    });
  };

  const renderAgentStatus = () => {
    const agents = [
      { key: 'market', name: 'Market Analysis', icon: TrendingUp },
      { key: 'generation', name: 'Content Generation', icon: Brain },
      { key: 'prediction', name: 'Performance Prediction', icon: BarChart3 },
      { key: 'visual', name: 'Visual Media', icon: Palette },
      { key: 'scheduling', name: 'Scheduling Strategy', icon: Calendar }
    ];

    return (
      <div className="grid grid-cols-5 gap-4 mb-6">
        {agents.map((agent: { key: string; name: string; icon: any }) => {
          const status = progress.agents[agent.key as keyof typeof progress.agents];
          const Icon = agent.icon;
          
          return (
            <div
              key={agent.key}
              className={cn(
                "flex flex-col items-center p-4 rounded-lg border transition-all",
                status === 'idle' && "border-gray-200 bg-gray-50",
                status === 'running' && "border-blue-500 bg-blue-50 animate-pulse",
                status === 'complete' && "border-green-500 bg-green-50"
              )}
            >
              <Icon className={cn(
                "h-8 w-8 mb-2",
                status === 'idle' && "text-gray-400",
                status === 'running' && "text-blue-500",
                status === 'complete' && "text-green-500"
              )} />
              <span className="text-xs text-center">{agent.name}</span>
              {status === 'running' && (
                <Loader2 className="h-4 w-4 mt-2 animate-spin text-blue-500" />
              )}
              {status === 'complete' && (
                <span className="text-green-500 mt-2">✓</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderVariationCard = (variation: ContentVariation, index: number) => {
    const isSelected = selectedVariation === index;
    const prediction = variation.prediction || generatedContent?.metadata?.predictedPerformance;
    
    return (
      <Card 
        key={index}
        className={cn(
          "cursor-pointer transition-all",
          isSelected && "ring-2 ring-primary"
        )}
        onClick={() => setSelectedVariation(index)}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{variation.style}</Badge>
              <Badge variant="secondary">{variation.emotion}</Badge>
            </div>
            {prediction && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">
                  {prediction.engagementRate?.toFixed(0)}% engagement
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap mb-4">{variation.content}</p>
          
          {variation.hooks && variation.hooks.length > 0 && (
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground">Hooks</Label>
              <div className="space-y-1 mt-1">
                {variation.hooks.slice(0, 2).map((hook, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {hook}</p>
                ))}
              </div>
            </div>
          )}
          
          {prediction && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <Zap className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
                <span>Virality: {prediction.viralityScore?.toFixed(1)}/10</span>
              </div>
              <div className="text-center">
                <Target className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <span>Convert: {prediction.conversionLikelihood?.toFixed(0)}%</span>
              </div>
              <div className="text-center">
                <Eye className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                <span>Reach: High</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Content Studio</h1>
          <p className="text-muted-foreground">
            5 AI agents working in parallel to create perfect content
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Deep Reasoning Enabled
        </Badge>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>Content Brief</CardTitle>
          <CardDescription>
            Tell our AI agents what content you need
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Content Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="social">Social Media Post</SelectItem>
                  <SelectItem value="blog">Blog Article</SelectItem>
                  <SelectItem value="email">Email Campaign</SelectItem>
                  <SelectItem value="presentation">Presentation</SelectItem>
                  <SelectItem value="video_script">Video Script</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(value) => setFormData({ ...formData, platform: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Topic / Main Message</Label>
            <Textarea
              placeholder="What do you want to communicate? Be specific..."
              value={formData.topic}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, topic: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tone</Label>
              <Select
                value={formData.tone}
                onValueChange={(value) => setFormData({ ...formData, tone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                  <SelectItem value="inspirational">Inspirational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Keywords (comma-separated)</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="AI, innovation, technology..."
                value={formData.keywords}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, keywords: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Target Audience</Label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Demographics (e.g., Tech professionals, 25-45)"
              value={formData.targetAudience.demographics}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ 
                ...formData, 
                targetAudience: { ...formData.targetAudience, demographics: e.target.value }
              })}
            />
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Interests (comma-separated)"
              value={formData.targetAudience.interests}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ 
                ...formData, 
                targetAudience: { ...formData.targetAudience, interests: e.target.value }
              })}
            />
          </div>

          <Button 
            onClick={generateContent} 
            disabled={loading || !formData.topic}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agents Working...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Content with 5 AI Agents
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Agent Status */}
      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>AI Agents Status</CardTitle>
            <CardDescription>{progress.message}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderAgentStatus()}
            <Progress value={progress.progress} className="mt-4" />
          </CardContent>
        </Card>
      )}

      {/* Generated Content */}
      {generatedContent && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Content</CardTitle>
            <CardDescription>
              Choose from {generatedContent.variations?.length || 1} AI-generated variations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="variations">
              <TabsList>
                <TabsTrigger value="variations">Content Variations</TabsTrigger>
                <TabsTrigger value="performance">Performance Predictions</TabsTrigger>
                <TabsTrigger value="visuals">Visual Recommendations</TabsTrigger>
                <TabsTrigger value="schedule">Publishing Schedule</TabsTrigger>
              </TabsList>
              
              <TabsContent value="variations" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generatedContent.variations?.map((variation: ContentVariation, index: number) => 
                    renderVariationCard(variation, index)
                  )}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button 
                    onClick={() => copyContent(generatedContent.variations[selectedVariation].content)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Selected
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export All
                  </Button>
                  <Button variant="outline">
                    <Share2 className="h-4 w-4 mr-2" />
                    Schedule Post
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="performance">
                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertDescription>
                    Performance predictions based on historical data and current trends
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {generatedContent.metadata?.predictedPerformance?.predictions?.[0]?.predictions?.engagementRate?.toFixed(0)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Predicted Engagement</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {generatedContent.metadata?.predictedPerformance?.predictions?.[0]?.predictions?.viralityScore?.toFixed(1)}/10
                      </div>
                      <p className="text-xs text-muted-foreground">Virality Score</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {generatedContent.metadata?.predictedPerformance?.predictions?.[0]?.predictions?.bestPostingTime}
                      </div>
                      <p className="text-xs text-muted-foreground">Best Time to Post</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="visuals">
                <div className="space-y-4">
                  <div>
                    <Label>Recommended Image Style</Label>
                    <p className="text-sm text-muted-foreground">
                      Professional, modern, with brand colors
                    </p>
                  </div>
                  
                  <div>
                    <Label>AI Image Prompts</Label>
                    <div className="space-y-2 mt-2">
                      {['Professional team collaboration', 'Modern tech workspace', 'Data visualization'].map((prompt, i) => (
                        <Card key={i}>
                          <CardContent className="p-3 flex items-center justify-between">
                            <span className="text-sm">{prompt}</span>
                            <Button size="sm" variant="outline">
                              <Image className="h-4 w-4 mr-2" />
                              Generate
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label>Color Palette</Label>
                    <div className="flex gap-2 mt-2">
                      {['#0077B5', '#2C3E50', '#E74C3C', '#F39C12'].map(color => (
                        <div 
                          key={color}
                          className="w-12 h-12 rounded-md"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="schedule">
                <div className="space-y-4">
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Optimal posting time: Tuesday, 10:00 AM EST
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <Label>Publishing Strategy</Label>
                    <div className="space-y-2 mt-2">
                      <Card>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Primary Post</p>
                              <p className="text-sm text-muted-foreground">LinkedIn - Tuesday 10:00 AM</p>
                            </div>
                            <Button size="sm">Schedule</Button>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Cross-post</p>
                              <p className="text-sm text-muted-foreground">Twitter - Tuesday 12:00 PM</p>
                            </div>
                            <Button size="sm" variant="outline">Schedule</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                  
                  <div>
                    <Label>A/B Testing</Label>
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-sm">Test 2 variations for 48 hours</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically promote the best performer
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}