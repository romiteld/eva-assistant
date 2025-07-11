'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Users, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Brain,
  MessageSquare,
  BarChart3,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  FileText,
  Download,
  RefreshCw,
  Mic,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSendMessage } from '@/hooks/useSendMessage';
import { AgentType } from '@/lib/agents/base/types';

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  detail?: string;
}

interface InsightItem {
  type: 'opportunity' | 'risk' | 'action' | 'info';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable?: {
    label: string;
    action: () => void;
  };
}

export function CEOIntelDashboard() {
  const [loading, setLoading] = useState(true);
  const [executiveSummary, setExecutiveSummary] = useState<any>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const { toast } = useToast();
  const sendMessage = useSendMessage();

  // Simulated real-time metrics
  const [metrics, setMetrics] = useState<MetricCard[]>([
    {
      title: "Monthly Revenue",
      value: "$2.45M",
      change: 12.5,
      trend: 'up',
      icon: <DollarSign className="h-6 w-6" />,
      detail: "Target: $2.5M"
    },
    {
      title: "Active Recruiters",
      value: 48,
      change: -4.2,
      trend: 'down',
      icon: <Users className="h-6 w-6" />,
      detail: "3 at risk"
    },
    {
      title: "Fill Rate",
      value: "78%",
      change: 5.3,
      trend: 'up',
      icon: <Target className="h-6 w-6" />,
      detail: "Industry avg: 65%"
    },
    {
      title: "Avg Time to Fill",
      value: "32 days",
      change: -8.1,
      trend: 'up',
      icon: <Activity className="h-6 w-6" />,
      detail: "Improved by 3 days"
    }
  ]);

  const initializeDashboard = async () => {
    try {
      setLoading(true);
      
      // Request executive summary
      const summaryResponse = await sendMessage(
        AgentType.RECRUITER_INTEL,
        'generate_executive_summary',
        {
          format: 'brief',
          focus_areas: ['revenue', 'efficiency', 'risk', 'growth'],
          time_range: 30
        }
      );

      if (summaryResponse && typeof summaryResponse === 'object' && 'success' in summaryResponse && summaryResponse.success) {
        const data = (summaryResponse as any).data;
        setExecutiveSummary(data);
        generateInsights(data);
      }

      // Request anomaly detection
      const anomalyResponse = await sendMessage(
        AgentType.RECRUITER_INTEL,
        'detect_anomalies',
        {
          scope: 'company-wide',
          sensitivity: 'high'
        }
      );

      if (anomalyResponse && typeof anomalyResponse === 'object' && 'success' in anomalyResponse && (anomalyResponse as any).success && (anomalyResponse as any).data?.anomalies) {
        processAnomalies((anomalyResponse as any).data.anomalies);
      }

    } catch (error) {
      console.error('Error initializing dashboard:', error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Error',
        description: 'Failed to load executive dashboard',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMetrics = async () => {
    // Simulate real-time metric updates
    setMetrics(prev => prev.map(metric => ({
      ...metric,
      change: metric.change + (Math.random() - 0.5) * 2,
      trend: metric.change > 0 ? 'up' : metric.change < 0 ? 'down' : 'neutral'
    })));
  };

  const generateInsights = (summary: any) => {
    const newInsights: InsightItem[] = [];

    // Extract insights from summary
    if (summary.critical_issues) {
      summary.critical_issues.forEach((issue: any) => {
        newInsights.push({
          type: 'risk',
          title: issue.title || 'Critical Issue',
          description: issue.description,
          impact: 'high',
          actionable: issue.action ? {
            label: issue.action.label,
            action: () => handleActionClick(issue.action)
          } : undefined
        });
      });
    }

    if (summary.opportunities) {
      summary.opportunities.forEach((opp: any) => {
        newInsights.push({
          type: 'opportunity',
          title: opp.title || 'Growth Opportunity',
          description: opp.description,
          impact: opp.impact || 'medium',
          actionable: opp.action ? {
            label: opp.action.label,
            action: () => handleActionClick(opp.action)
          } : undefined
        });
      });
    }

    setInsights(newInsights);
  };

  const processAnomalies = (anomalies: any) => {
    if (!anomalies.items) return;

    anomalies.items.forEach((anomaly: any) => {
      if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
        setInsights(prev => [...prev, {
          type: 'risk',
          title: `Anomaly Detected: ${anomaly.description}`,
          description: anomaly.potential_impact,
          impact: anomaly.severity === 'critical' ? 'high' : 'medium',
          actionable: {
            label: 'Investigate',
            action: () => investigateAnomaly(anomaly)
          }
        }]);
      }
    });
  };

  const handleNaturalLanguageQuery = async () => {
    if (!query.trim()) return;

    try {
      setConversation(prev => [...prev, { role: 'user', content: query }]);
      
      const response = await sendMessage(
        AgentType.RECRUITER_INTEL,
        'natural_language_query',
        {
          query,
          context: {
            current_metrics: metrics,
            recent_insights: insights
          }
        }
      );

      if (response && typeof response === 'object' && 'success' in response && (response as any).success) {
        const responseData = (response as any).data;
        setConversation(prev => [...prev, { 
          role: 'assistant', 
          content: typeof responseData.response === 'string' 
            ? responseData.response 
            : responseData.response?.content || 'No response available'
        }]);
      }

      setQuery('');
    } catch (error) {
      console.error('Error processing query:', error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Error',
        description: 'Failed to process your question',
        variant: 'destructive',
      });
    }
  };

  const handleVoiceInput = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        handleNaturalLanguageQuery();
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognition.start();
    } else {
      toast({
        title: 'Not supported',
        description: 'Voice input is not supported in your browser',
        variant: 'destructive',
      });
    }
  };

  const generateReport = async (format: 'detailed' | 'presentation') => {
    try {
      const response = await sendMessage(
        AgentType.RECRUITER_INTEL,
        'generate_executive_summary',
        {
          format,
          focus_areas: ['revenue', 'efficiency', 'quality', 'growth', 'risk'],
          time_range: 90
        }
      );

      if (response && typeof response === 'object' && 'success' in response && (response as any).success) {
        // In a real implementation, this would generate and download a file
        toast({
          title: 'Report Generated',
          description: `Your ${format} report is ready for download`,
        });
      }
    } catch (error) {
      console.error('Error generating report:', error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      });
    }
  };

  const handleActionClick = (action: any) => {
    // Handle different action types
    console.log('Action clicked:', action);
  };

  const investigateAnomaly = (anomaly: any) => {
    // Open detailed anomaly investigation
    console.log('Investigating anomaly:', anomaly);
  };

  const insightIcons = {
    opportunity: <TrendingUp className="h-5 w-5 text-green-600" />,
    risk: <AlertTriangle className="h-5 w-5 text-red-600" />,
    action: <Zap className="h-5 w-5 text-blue-600" />,
    info: <FileText className="h-5 w-5 text-gray-600" />
  };

  const impactColors = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-yellow-200 bg-yellow-50',
    low: 'border-blue-200 bg-blue-50'
  };

  useEffect(() => {
    initializeDashboard();
    // Set up real-time updates
    const interval = setInterval(updateMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CEO Intelligence Dashboard</h1>
          <p className="text-muted-foreground">Real-time insights and strategic analytics</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => generateReport('detailed')}>
            <FileText className="mr-2 h-4 w-4" />
            Detailed Report
          </Button>
          <Button variant="outline" onClick={() => generateReport('presentation')}>
            <Download className="mr-2 h-4 w-4" />
            Board Deck
          </Button>
          <Button onClick={initializeDashboard}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              {metric.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center justify-between mt-2">
                <div className={cn(
                  "flex items-center text-xs",
                  metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                )}>
                  {metric.trend === 'up' ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  <span>{Math.abs(metric.change).toFixed(1)}%</span>
                </div>
                {metric.detail && (
                  <span className="text-xs text-muted-foreground">{metric.detail}</span>
                )}
              </div>
              <Progress 
                value={metric.trend === 'up' ? 50 + metric.change : 50 - metric.change} 
                className="mt-2 h-1"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Strategic Insights */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Strategic Insights
              </CardTitle>
              <CardDescription>AI-powered analysis and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {insights.map((insight, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-4 rounded-lg border",
                        impactColors[insight.impact]
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {insightIcons[insight.type]}
                          <div className="flex-1">
                            <h4 className="font-medium">{insight.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {insight.description}
                            </p>
                          </div>
                        </div>
                        {insight.actionable && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={insight.actionable.action}
                          >
                            {insight.actionable.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Executive Summary */}
          {executiveSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
                <CardDescription>Key takeaways from the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {executiveSummary.content ? (
                    <div dangerouslySetInnerHTML={{ __html: executiveSummary.content }} />
                  ) : (
                    <div className="space-y-3">
                      {executiveSummary.key_metrics && (
                        <div>
                          <h4 className="font-medium mb-2">Key Metrics</h4>
                          <ul className="list-disc pl-5 space-y-1">
                            {Object.entries(executiveSummary.key_metrics).map(([key, value]) => (
                              <li key={key}>
                                <span className="capitalize">{key.replace(/_/g, ' ')}</span>: {String(value)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {executiveSummary.recommended_actions && (
                        <div>
                          <h4 className="font-medium mb-2">Recommended Actions</h4>
                          <ol className="list-decimal pl-5 space-y-1">
                            {executiveSummary.recommended_actions.map((action: string, idx: number) => (
                              <li key={idx}>{action}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Assistant */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              AI Assistant
            </CardTitle>
            <CardDescription>Ask anything about your recruiting operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-4">
                  {conversation.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Ask me anything about your recruiting business</p>
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium">Try asking:</p>
                        <div className="space-y-1">
                          <button
                            onClick={() => setQuery("Who are my top performing recruiters this month?")}
                            className="text-xs text-blue-600 hover:underline block mx-auto"
                          >
                            &quot;Who are my top performing recruiters?&quot;
                          </button>
                          <button
                            onClick={() => setQuery("What's our revenue trend?")}
                            className="text-xs text-blue-600 hover:underline block mx-auto"
                          >
                            &quot;What&apos;s our revenue trend?&quot;
                          </button>
                          <button
                            onClick={() => setQuery("Are there any risks I should know about?")}
                            className="text-xs text-blue-600 hover:underline block mx-auto"
                          >
                            &quot;Any risks I should know about?&quot;
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    conversation.map((msg, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-3 rounded-lg",
                          msg.role === 'user' 
                            ? "bg-primary/10 ml-8" 
                            : "bg-muted mr-8"
                        )}
                      >
                        <p className="text-sm font-medium mb-1">
                          {msg.role === 'user' ? 'You' : 'Assistant'}
                        </p>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question..."
                  value={query}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                  onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleNaturalLanguageQuery()}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleVoiceInput}
                  disabled={isListening}
                >
                  <Mic className={cn("h-4 w-4", isListening && "animate-pulse text-red-600")} />
                </Button>
                <Button
                  size="icon"
                  onClick={handleNaturalLanguageQuery}
                  disabled={!query.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}