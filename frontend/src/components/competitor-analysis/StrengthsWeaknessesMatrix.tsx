'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCompetitorAnalysisService } from '@/lib/services/competitor-analysis';
import { CompetitorAnalysis, CompetitorInsight, Competitor } from '@/types/competitor-analysis';
import { supabase } from '@/lib/supabase/browser';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Target,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Brain,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Download,
  Loader2,
  Plus,
  Minus,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StrengthsWeaknessesMatrixProps {
  competitorIds: string[];
}

// SWOT Quadrant Component
function SwotQuadrant({
  title,
  items,
  type,
  icon: Icon,
  color
}: {
  title: string;
  items: string[];
  type: 'strength' | 'weakness' | 'opportunity' | 'threat';
  icon: any;
  color: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? items : items.slice(0, 3);

  return (
    <Card className={cn("h-full", `border-${color}-200`)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", `bg-${color}-100`)}>
              <Icon className={cn("h-4 w-4", `text-${color}-600`)} />
            </div>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Badge variant="outline" className={cn(`text-${color}-600`)}>
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-2">
            <AnimatePresence mode="wait">
              {displayItems.map((item, index) => (
                <motion.div
                  key={`${type}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-2"
                >
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                    type === 'strength' && "bg-green-500",
                    type === 'weakness' && "bg-red-500",
                    type === 'opportunity' && "bg-blue-500",
                    type === 'threat' && "bg-orange-500"
                  )} />
                  <p className="text-sm">{item}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {items.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <Minus className="h-3 w-3 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  Show {items.length - 3} More
                </>
              )}
            </Button>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Insight Card Component
function InsightCard({ insight }: { insight: CompetitorInsight }) {
  const getIcon = () => {
    switch (insight.type) {
      case 'strength': return CheckCircle;
      case 'weakness': return XCircle;
      case 'opportunity': return TrendingUp;
      case 'threat': return AlertTriangle;
    }
  };

  const getColor = () => {
    switch (insight.type) {
      case 'strength': return 'text-green-600';
      case 'weakness': return 'text-red-600';
      case 'opportunity': return 'text-blue-600';
      case 'threat': return 'text-orange-600';
    }
  };

  const Icon = getIcon();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="p-4 border rounded-lg hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg bg-muted", getColor())}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <h4 className="font-medium">{insight.title}</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {insight.confidence}% confidence
              </Badge>
              {insight.actionable && (
                <Badge variant="default" className="text-xs">
                  Actionable
                </Badge>
              )}
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">{insight.description}</p>
          
          {insight.evidence.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium mb-1">Evidence:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {insight.evidence.map((ev, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-muted-foreground">•</span>
                    {ev}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {insight.actionable && insight.suggestedActions && (
            <div className="mt-3 p-3 bg-muted/50 rounded">
              <p className="text-xs font-medium mb-1 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Suggested Actions:
              </p>
              <ul className="text-xs space-y-1">
                {insight.suggestedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <ArrowRight className="h-3 w-3 text-primary mt-0.5" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function StrengthsWeaknessesMatrix({ competitorIds }: StrengthsWeaknessesMatrixProps) {
  const [analyses, setAnalyses] = useState<Map<string, CompetitorAnalysis>>(new Map());
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [insights, setInsights] = useState<CompetitorInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all');
  
  const service = getCompetitorAnalysisService();

  useEffect(() => {
    loadAnalyses();
  }, [competitorIds]);

  const loadAnalyses = async () => {
    setLoading(true);
    try {
      // Load competitors
      const { data: competitorData } = await supabase
        .from('competitors')
        .select('*')
        .in('id', competitorIds);

      if (competitorData) {
        setCompetitors(competitorData);
      }

      // Load or generate analyses
      const analysesMap = new Map<string, CompetitorAnalysis>();
      const allInsights: CompetitorInsight[] = [];

      for (const competitorId of competitorIds) {
        // In production, this would fetch real analysis
        const analysis: CompetitorAnalysis = {
          id: `analysis_${competitorId}`,
          competitorId,
          timestamp: new Date().toISOString(),
          strengths: [
            'Strong brand recognition in target market',
            'Established customer base with high retention',
            'Innovative product features ahead of market',
            'Robust financial backing and resources',
            'Experienced leadership team'
          ],
          weaknesses: [
            'Limited geographic presence',
            'Higher pricing compared to competitors',
            'Slow adoption of new technologies',
            'Customer service response times',
            'Limited product diversification'
          ],
          opportunities: [
            'Expanding into emerging markets',
            'Strategic partnerships with tech companies',
            'Growing demand for sustainable solutions',
            'Digital transformation initiatives',
            'New customer segments opening up'
          ],
          threats: [
            'New market entrants with disruptive tech',
            'Changing regulatory landscape',
            'Economic uncertainty affecting budgets',
            'Shifting customer preferences',
            'Supply chain vulnerabilities'
          ],
          keyDifferentiators: [
            'Proprietary technology platform',
            'Superior customer experience',
            'Industry-leading expertise'
          ],
          marketPosition: 'challenger',
          competitiveAdvantages: [
            'First-mover advantage in key segments',
            'Strong intellectual property portfolio',
            'Efficient operational model'
          ],
          riskFactors: [
            'Dependency on key suppliers',
            'Market concentration risk',
            'Technology obsolescence'
          ]
        };

        analysesMap.set(competitorId, analysis);

        // Generate insights
        const competitorInsights: CompetitorInsight[] = [
          {
            type: 'strength',
            title: 'Market Leadership Position',
            description: 'Strong brand recognition provides competitive advantage in customer acquisition',
            evidence: ['#1 market share in 3 key segments', '85% brand awareness among target audience'],
            confidence: 92,
            actionable: true,
            suggestedActions: ['Leverage brand strength for premium pricing', 'Expand into adjacent markets'],
            impact: 'high'
          },
          {
            type: 'weakness',
            title: 'Geographic Limitations',
            description: 'Limited presence in high-growth markets presents expansion challenges',
            evidence: ['Only 15% revenue from international markets', 'No presence in APAC region'],
            confidence: 88,
            actionable: true,
            suggestedActions: ['Develop international expansion strategy', 'Consider strategic acquisitions'],
            impact: 'medium'
          },
          {
            type: 'opportunity',
            title: 'Digital Transformation',
            description: 'Industry shift to digital presents significant growth opportunity',
            evidence: ['Digital market growing at 25% CAGR', 'Competitors slow to adapt'],
            confidence: 85,
            actionable: true,
            suggestedActions: ['Accelerate digital product development', 'Invest in digital talent'],
            impact: 'high'
          },
          {
            type: 'threat',
            title: 'Disruptive Technology',
            description: 'Emerging AI technologies could disrupt traditional business model',
            evidence: ['3 AI startups targeting same market', 'VC funding in space increased 200%'],
            confidence: 78,
            actionable: true,
            suggestedActions: ['Develop AI strategy', 'Partner with or acquire AI capabilities'],
            impact: 'high'
          }
        ];

        allInsights.push(...competitorInsights);
      }

      setAnalyses(analysesMap);
      setInsights(allInsights);
    } catch (error) {
      console.error('Failed to load analyses:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportAnalysis = () => {
    const data = {
      competitors: competitors.map(c => ({
        name: c.name,
        analysis: analyses.get(c.id)
      })),
      insights,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swot-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCompetitorName = (competitorId: string): string => {
    return competitors.find(c => c.id === competitorId)?.name || 'Unknown';
  };

  // Aggregate SWOT data
  const aggregatedSwot = selectedCompetitor === 'all'
    ? {
        strengths: Array.from(analyses.values()).flatMap(a => a.strengths),
        weaknesses: Array.from(analyses.values()).flatMap(a => a.weaknesses),
        opportunities: Array.from(analyses.values()).flatMap(a => a.opportunities),
        threats: Array.from(analyses.values()).flatMap(a => a.threats)
      }
    : analyses.get(selectedCompetitor) || {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: []
      };

  // Filter insights
  const filteredInsights = selectedCompetitor === 'all'
    ? insights
    : insights.filter(i => i.type === selectedCompetitor);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>SWOT Analysis</CardTitle>
              <CardDescription>
                Comprehensive strengths, weaknesses, opportunities, and threats analysis
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportAnalysis}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="matrix">
            <div className="flex items-center justify-between mb-6">
              <TabsList>
                <TabsTrigger value="matrix">SWOT Matrix</TabsTrigger>
                <TabsTrigger value="insights">AI Insights</TabsTrigger>
                <TabsTrigger value="comparison">Comparison</TabsTrigger>
              </TabsList>
              
              <select
                value={selectedCompetitor}
                onChange={(e) => setSelectedCompetitor(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm bg-background"
              >
                <option value="all">All Competitors</option>
                {competitors.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                ))}
              </select>
            </div>

            <TabsContent value="matrix" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SwotQuadrant
                  title="Strengths"
                  items={aggregatedSwot.strengths}
                  type="strength"
                  icon={Shield}
                  color="green"
                />
                <SwotQuadrant
                  title="Weaknesses"
                  items={aggregatedSwot.weaknesses}
                  type="weakness"
                  icon={AlertTriangle}
                  color="red"
                />
                <SwotQuadrant
                  title="Opportunities"
                  items={aggregatedSwot.opportunities}
                  type="opportunity"
                  icon={TrendingUp}
                  color="blue"
                />
                <SwotQuadrant
                  title="Threats"
                  items={aggregatedSwot.threats}
                  type="threat"
                  icon={Target}
                  color="orange"
                />
              </div>

              {/* Key Differentiators */}
              {selectedCompetitor !== 'all' && analyses.get(selectedCompetitor) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Key Differentiators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analyses.get(selectedCompetitor)!.keyDifferentiators.map((diff, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          <Zap className="h-3 w-3" />
                          {diff}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="insights" className="space-y-4">
              {filteredInsights.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No insights available for the selected filter
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredInsights.map((insight, index) => (
                    <InsightCard key={index} insight={insight} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="comparison" className="space-y-6">
              {competitors.length > 1 ? (
                <div className="space-y-6">
                  {/* Comparison table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Aspect</th>
                          {competitors.map(comp => (
                            <th key={comp.id} className="text-center p-3">
                              {comp.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">Market Position</td>
                          {competitors.map(comp => (
                            <td key={comp.id} className="p-3 text-center">
                              <Badge variant="outline">
                                {analyses.get(comp.id)?.marketPosition || 'Unknown'}
                              </Badge>
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">Strengths Count</td>
                          {competitors.map(comp => (
                            <td key={comp.id} className="p-3 text-center">
                              <span className="font-medium text-green-600">
                                {analyses.get(comp.id)?.strengths.length || 0}
                              </span>
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">Weaknesses Count</td>
                          {competitors.map(comp => (
                            <td key={comp.id} className="p-3 text-center">
                              <span className="font-medium text-red-600">
                                {analyses.get(comp.id)?.weaknesses.length || 0}
                              </span>
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">Risk Level</td>
                          {competitors.map(comp => {
                            const riskCount = analyses.get(comp.id)?.riskFactors.length || 0;
                            return (
                              <td key={comp.id} className="p-3 text-center">
                                <Badge
                                  variant={riskCount > 3 ? "destructive" : riskCount > 1 ? "default" : "secondary"}
                                >
                                  {riskCount > 3 ? "High" : riskCount > 1 ? "Medium" : "Low"}
                                </Badge>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Competitive advantages */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {competitors.map(comp => {
                      const analysis = analyses.get(comp.id);
                      if (!analysis) return null;
                      
                      return (
                        <Card key={comp.id}>
                          <CardHeader>
                            <CardTitle className="text-base">{comp.name}</CardTitle>
                            <CardDescription>Competitive Advantages</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {analysis.competitiveAdvantages.map((advantage, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                  {advantage}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Select multiple competitors to see comparison
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}