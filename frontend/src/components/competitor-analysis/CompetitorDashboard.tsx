'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCompetitorAnalysisService } from '@/lib/services/competitor-analysis';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Competitor, 
  CompetitorAlert,
  MarketTrend,
  CompetitorDiscovery
} from '@/types/competitor-analysis';
import {
  Search,
  Plus,
  TrendingUp,
  Shield,
  AlertCircle,
  BarChart3,
  Users,
  Target,
  Zap,
  Eye,
  RefreshCw,
  Download,
  Settings,
  Bell,
  Globe,
  DollarSign,
  FileText,
  Share2,
  Brain,
  Loader2,
  ChevronRight,
  ExternalLink,
  Calendar,
  Filter,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { CompetitorCard } from './CompetitorCard';
import { ComparisonChart } from './ComparisonChart';
import { MarketShareVisualization } from './MarketShareVisualization';
import { StrengthsWeaknessesMatrix } from './StrengthsWeaknessesMatrix';
import { CompetitorTracker } from './CompetitorTracker';
import { cn } from '@/lib/utils';

// Glassmorphic card component
function GlassCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CompetitorDashboard() {
  const { toast } = useToast();
  const [service] = useState(() => getCompetitorAnalysisService());
  
  // State
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<CompetitorAlert[]>([]);
  const [marketTrends, setMarketTrends] = useState<MarketTrend[]>([]);
  const [discoveryResults, setDiscoveryResults] = useState<CompetitorDiscovery | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Discovery form
  const [industry, setIndustry] = useState('');
  const [keywords, setKeywords] = useState('');
  const [currentDomain, setCurrentDomain] = useState('');

  // Load initial data
  useEffect(() => {
    loadCompetitors();
    loadAlerts();
    
    // Setup event listeners
    service.on('competitor:added', handleCompetitorAdded);
    service.on('competitor:updated', handleCompetitorUpdated);
    service.on('alert:new', handleNewAlert);
    service.on('analysis:started', () => setAnalysisInProgress(true));
    service.on('analysis:completed', () => setAnalysisInProgress(false));
    service.on('analysis:error', handleAnalysisError);

    return () => {
      service.removeAllListeners();
    };
  }, [service]);

  // Load competitors
  const loadCompetitors = async () => {
    try {
      const data = await service.getCompetitors();
      setCompetitors(data);
    } catch (error) {
      toast({
        title: 'Failed to load competitors',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  // Load alerts
  const loadAlerts = async () => {
    try {
      const data = await service.getAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  // Event handlers
  const handleCompetitorAdded = (competitor: Competitor) => {
    setCompetitors(prev => [competitor, ...prev]);
    toast({
      title: 'Competitor added',
      description: `${competitor.name} has been added to tracking`
    });
  };

  const handleCompetitorUpdated = (competitor: Competitor) => {
    setCompetitors(prev => prev.map(c => c.id === competitor.id ? competitor : c));
  };

  const handleNewAlert = (alert: CompetitorAlert) => {
    setAlerts(prev => [alert, ...prev]);
    toast({
      title: 'New competitor alert',
      description: alert.title,
      variant: alert.severity === 'critical' ? 'destructive' : 'default'
    });
  };

  const handleAnalysisError = (error: any) => {
    toast({
      title: 'Analysis failed',
      description: error.message || 'An error occurred during analysis',
      variant: 'destructive'
    });
    setAnalysisInProgress(false);
  };

  // Discover competitors
  const discoverCompetitors = async () => {
    if (!industry || !keywords) {
      toast({
        title: 'Missing information',
        description: 'Please provide industry and keywords',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const results = await service.discoverCompetitors(
        industry,
        keywords.split(',').map(k => k.trim()),
        currentDomain
      );
      setDiscoveryResults(results);
      toast({
        title: 'Discovery complete',
        description: `Found ${results.suggestedCompetitors.length} potential competitors`
      });
    } catch (error) {
      toast({
        title: 'Discovery failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Add competitor from discovery
  const addCompetitorFromDiscovery = async (suggestion: any) => {
    try {
      await service.addCompetitor({
        name: suggestion.name,
        domain: suggestion.domain,
        industry,
        status: 'active'
      });
    } catch (error) {
      toast({
        title: 'Failed to add competitor',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  // Analyze selected competitors
  const analyzeSelected = async () => {
    if (selectedCompetitors.length === 0) {
      toast({
        title: 'No competitors selected',
        description: 'Please select competitors to analyze',
        variant: 'destructive'
      });
      return;
    }

    setAnalysisInProgress(true);
    try {
      for (const competitorId of selectedCompetitors) {
        await service.analyzeCompetitor(competitorId);
      }
      toast({
        title: 'Analysis complete',
        description: 'Competitor analysis has been updated'
      });
    } catch (error) {
      // Error handled by event listener
    }
  };

  // Load market trends
  const loadMarketTrends = async () => {
    if (!industry) return;
    
    setLoading(true);
    try {
      const trends = await service.getMarketTrends(industry);
      setMarketTrends(trends);
    } catch (error) {
      console.error('Failed to load trends:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle competitor selection
  const toggleCompetitorSelection = (competitorId: string) => {
    setSelectedCompetitors(prev => 
      prev.includes(competitorId)
        ? prev.filter(id => id !== competitorId)
        : [...prev, competitorId]
    );
  };

  // Filter critical alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
  const unreadAlerts = alerts.filter(a => a.actionRequired);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Competitor Analysis
          </h1>
          <p className="text-muted-foreground">
            AI-powered competitive intelligence and market insights
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadCompetitors}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={analyzeSelected} disabled={analysisInProgress}>
            {analysisInProgress ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Analyze Selected
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''} require your attention
            </span>
            <Button size="sm" variant="ghost" onClick={() => setActiveTab('alerts')}>
              View Alerts
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="overview" className="relative">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="competitors" className="relative">
            <Users className="h-4 w-4 mr-2" />
            Competitors
            {competitors.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1">
                {competitors.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="comparison">
            <Target className="h-4 w-4 mr-2" />
            Comparison
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Brain className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            <Bell className="h-4 w-4 mr-2" />
            Alerts
            {unreadAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger value="discovery">
            <Search className="h-4 w-4 mr-2" />
            Discovery
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tracked Competitors</p>
                  <p className="text-2xl font-bold">{competitors.length}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </GlassCard>
            
            <GlassCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Alerts</p>
                  <p className="text-2xl font-bold">{unreadAlerts.length}</p>
                </div>
                <Bell className="h-8 w-8 text-blue-500" />
              </div>
            </GlassCard>
            
            <GlassCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Market Position</p>
                  <p className="text-2xl font-bold">Challenger</p>
                </div>
                <Target className="h-8 w-8 text-green-500" />
              </div>
            </GlassCard>
            
            <GlassCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Threat Level</p>
                  <p className="text-2xl font-bold">Medium</p>
                </div>
                <Shield className="h-8 w-8 text-orange-500" />
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MarketShareVisualization competitors={competitors} />
            <CompetitorTracker competitors={competitors} alerts={alerts} />
          </div>

          {selectedCompetitors.length > 0 && (
            <StrengthsWeaknessesMatrix competitorIds={selectedCompetitors} />
          )}
        </TabsContent>

        {/* Competitors Tab */}
        <TabsContent value="competitors" className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCompetitors(competitors.map(c => c.id))}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCompetitors([])}
              >
                Clear Selection
              </Button>
            </div>
            <Badge variant="outline">
              {selectedCompetitors.length} selected
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitors.map(competitor => (
              <CompetitorCard
                key={competitor.id}
                competitor={competitor}
                selected={selectedCompetitors.includes(competitor.id)}
                onSelect={() => toggleCompetitorSelection(competitor.id)}
                onAnalyze={() => service.analyzeCompetitor(competitor.id)}
                onRemove={() => {
                  service.removeCompetitor(competitor.id);
                  loadCompetitors();
                }}
              />
            ))}
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          {selectedCompetitors.length < 2 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Select at least 2 competitors to compare
              </AlertDescription>
            </Alert>
          ) : (
            <ComparisonChart competitorIds={selectedCompetitors} />
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Market Trends</CardTitle>
              <CardDescription>
                AI-identified trends in your industry
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!industry ? (
                <Alert>
                  <AlertDescription>
                    Set your industry in the Discovery tab to see market trends
                  </AlertDescription>
                </Alert>
              ) : (
                <Button onClick={loadMarketTrends} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading trends...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Load Market Trends
                    </>
                  )}
                </Button>
              )}

              {marketTrends.length > 0 && (
                <div className="mt-6 space-y-4">
                  {marketTrends.map(trend => (
                    <div key={trend.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{trend.trend}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Impact: {trend.impact} • Relevance: {trend.relevance.toFixed(0)}%
                          </p>
                        </div>
                        <Badge variant={trend.impact === 'positive' ? 'default' : 'secondary'}>
                          {trend.category}
                        </Badge>
                      </div>
                      {trend.recommendations.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-1">Recommendations:</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {trend.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <StrengthsWeaknessesMatrix competitorIds={selectedCompetitors} />
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Competitor Alerts</CardTitle>
                  <CardDescription>
                    Real-time notifications about competitor activities
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Alert Settings
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {alerts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No alerts yet. Alerts will appear when competitors make significant changes.
                    </p>
                  ) : (
                    alerts.map(alert => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-4 border rounded-lg",
                          alert.severity === 'critical' && "border-red-500 bg-red-500/10",
                          alert.severity === 'high' && "border-orange-500 bg-orange-500/10"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant={
                                  alert.severity === 'critical' ? 'destructive' :
                                  alert.severity === 'high' ? 'default' :
                                  'secondary'
                                }
                              >
                                {alert.severity}
                              </Badge>
                              <Badge variant="outline">{alert.type}</Badge>
                              {alert.actionRequired && (
                                <Badge variant="outline" className="text-orange-500">
                                  Action Required
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-medium">{alert.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.description}
                            </p>
                            {alert.suggestedResponse && (
                              <div className="mt-3 p-3 bg-secondary/50 rounded">
                                <p className="text-sm font-medium mb-1">Suggested Response:</p>
                                <p className="text-sm text-muted-foreground">
                                  {alert.suggestedResponse}
                                </p>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(alert.detectedAt).toLocaleString()}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discovery Tab */}
        <TabsContent value="discovery" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Discover Competitors</CardTitle>
              <CardDescription>
                AI-powered competitor discovery and market analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Industry</label>
                  <Input
                    placeholder="e.g., Financial Services"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Keywords</label>
                  <Input
                    placeholder="e.g., advisor, recruitment, fintech"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Your Domain (Optional)</label>
                  <Input
                    placeholder="e.g., yourcompany.com"
                    value={currentDomain}
                    onChange={(e) => setCurrentDomain(e.target.value)}
                  />
                </div>
              </div>
              
              <Button onClick={discoverCompetitors} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Discovering competitors...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Discover Competitors
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {discoveryResults && (
            <Card>
              <CardHeader>
                <CardTitle>Discovery Results</CardTitle>
                <CardDescription>
                  Found {discoveryResults.suggestedCompetitors.length} potential competitors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {discoveryResults.suggestedCompetitors.map((suggestion, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{suggestion.name}</h4>
                          <p className="text-sm text-muted-foreground">{suggestion.domain}</p>
                          <p className="text-sm mt-2">{suggestion.reason}</p>
                          <div className="flex items-center gap-4 mt-3">
                            <Badge variant="outline">
                              {suggestion.similarityScore.toFixed(0)}% match
                            </Badge>
                            {suggestion.sharedKeywords.length > 0 && (
                              <div className="flex gap-1">
                                {suggestion.sharedKeywords.slice(0, 3).map((kw, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => addCompetitorFromDiscovery(suggestion)}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}