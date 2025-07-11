'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCompetitorAnalysisService } from '@/lib/services/competitor-analysis';
import { ComparisonMatrix, Competitor, CompetitorMetrics } from '@/types/competitor-analysis';
import { supabase } from '@/lib/supabase/browser';
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Shield,
  Zap,
  Globe,
  DollarSign,
  Award,
  Activity,
  Loader2,
  Download,
  Filter,
  ChevronUp,
  ChevronDown,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ComparisonChartProps {
  competitorIds: string[];
}

// Radar chart component for visual comparison
function RadarChart({ data, categories }: { data: any[], categories: string[] }) {
  const centerX = 200;
  const centerY = 200;
  const radius = 150;
  const angleStep = (2 * Math.PI) / categories.length;

  // Calculate points for each competitor
  const competitorPaths = data.map((competitor, index) => {
    const points = categories.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const value = competitor.values[i] / 100; // Normalize to 0-1
      const x = centerX + radius * value * Math.cos(angle);
      const y = centerY + radius * value * Math.sin(angle);
      return { x, y };
    });

    const pathData = points
      .map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ') + ' Z';

    return {
      path: pathData,
      color: competitor.color,
      name: competitor.name
    };
  });

  // Grid lines
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];

  return (
    <div className="relative">
      <svg width="400" height="400" className="mx-auto">
        {/* Grid circles */}
        {gridLevels.map((level, i) => (
          <circle
            key={i}
            cx={centerX}
            cy={centerY}
            r={radius * level}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeDasharray="2 2"
          />
        ))}

        {/* Axis lines */}
        {categories.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={centerX}
              y1={centerY}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.1"
            />
          );
        })}

        {/* Category labels */}
        {categories.map((category, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = centerX + (radius + 20) * Math.cos(angle);
          const y = centerY + (radius + 20) * Math.sin(angle);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-current text-muted-foreground"
            >
              {category}
            </text>
          );
        })}

        {/* Competitor paths */}
        {competitorPaths.map((competitor, i) => (
          <motion.path
            key={i}
            d={competitor.path}
            fill={competitor.color}
            fillOpacity="0.2"
            stroke={competitor.color}
            strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, delay: i * 0.2 }}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {competitorPaths.map((competitor, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: competitor.color }}
            />
            <span className="text-sm">{competitor.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComparisonChart({ competitorIds }: ComparisonChartProps) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonMatrix | null>(null);
  const [metrics, setMetrics] = useState<Map<string, CompetitorMetrics>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const service = getCompetitorAnalysisService();

  useEffect(() => {
    loadComparisonData();
  }, [competitorIds]);

  const loadComparisonData = async () => {
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

      // Load comparison matrix
      const matrix = await service.compareCompetitors(competitorIds);
      setComparisonData(matrix);

      // Load metrics for each competitor
      const metricsMap = new Map<string, CompetitorMetrics>();
      for (const id of competitorIds) {
        // In production, this would fetch real metrics
        metricsMap.set(id, {
          competitorId: id,
          marketShare: Math.random() * 30,
          growthRate: Math.random() * 50 - 10,
          customerSatisfaction: 70 + Math.random() * 20,
          brandStrength: 60 + Math.random() * 30,
          innovationScore: 50 + Math.random() * 40,
          onlinePresence: {
            websiteTraffic: Math.floor(Math.random() * 1000000),
            socialMediaFollowers: {
              linkedin: Math.floor(Math.random() * 50000),
              twitter: Math.floor(Math.random() * 100000),
              facebook: Math.floor(Math.random() * 200000),
              instagram: Math.floor(Math.random() * 150000)
            },
            seoRanking: Math.floor(Math.random() * 100),
            domainAuthority: 30 + Math.floor(Math.random() * 60)
          }
        });
      }
      setMetrics(metricsMap);
    } catch (error) {
      console.error('Failed to load comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompetitorName = (competitorId: string): string => {
    return competitors.find(c => c.id === competitorId)?.name || 'Unknown';
  };

  const getCompetitorColor = (index: number): string => {
    const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    return colors[index % colors.length];
  };

  const exportComparison = () => {
    if (!comparisonData) return;

    const csv = [
      ['Feature', 'Category', ...competitorIds.map(id => getCompetitorName(id))],
      ...comparisonData.features.map(feature => [
        feature.name,
        feature.category,
        ...feature.competitors.map(c => c.quality?.toString() || 'N/A')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competitor-comparison-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const categories = Array.from(new Set(comparisonData?.features.map(f => f.category) || []));
  const filteredFeatures = comparisonData?.features.filter(
    f => selectedCategory === 'all' || f.category === selectedCategory
  ) || [];

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
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {comparisonData?.overallComparison.map((comp, index) => (
          <Card key={comp.competitorId} className="relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundColor: getCompetitorColor(index) }}
            />
            <CardHeader className="relative pb-3">
              <CardTitle className="text-lg">{getCompetitorName(comp.competitorId)}</CardTitle>
              <div className="flex items-center justify-between">
                <Badge variant="outline">Rank #{comp.rank}</Badge>
                <span className="text-2xl font-bold">{comp.overallScore.toFixed(0)}</span>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <Progress value={comp.overallScore} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">Overall Score</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detailed Comparison</CardTitle>
              <CardDescription>
                Side-by-side analysis of key features and capabilities
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportComparison}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="table">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="radar">Radar Chart</TabsTrigger>
              <TabsTrigger value="metrics">Key Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="mt-6">
              <ScrollArea className="h-[600px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-3">Feature</th>
                      <th className="text-left p-3">Category</th>
                      {competitors.map((comp, i) => (
                        <th key={comp.id} className="text-center p-3">
                          <div
                            className="font-medium"
                            style={{ color: getCompetitorColor(i) }}
                          >
                            {comp.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeatures.map((feature, index) => (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3 font-medium">{feature.name}</td>
                        <td className="p-3">
                          <Badge variant="outline">{feature.category}</Badge>
                        </td>
                        {feature.competitors.map((comp, i) => (
                          <td key={i} className="p-3 text-center">
                            {comp.hasFeature ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1">
                                  {comp.quality && comp.quality >= 8 ? (
                                    <ChevronUp className="h-4 w-4 text-green-500" />
                                  ) : comp.quality && comp.quality <= 4 ? (
                                    <ChevronDown className="h-4 w-4 text-red-500" />
                                  ) : (
                                    <Minus className="h-4 w-4 text-yellow-500" />
                                  )}
                                  <span className="font-medium">{comp.quality}/10</span>
                                </div>
                                {comp.notes && (
                                  <span className="text-xs text-muted-foreground">
                                    {comp.notes}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="radar" className="mt-6">
              <RadarChart
                data={competitors.map((comp, i) => ({
                  name: comp.name,
                  color: getCompetitorColor(i),
                  values: [
                    metrics.get(comp.id)?.marketShare || 0,
                    metrics.get(comp.id)?.customerSatisfaction || 0,
                    metrics.get(comp.id)?.brandStrength || 0,
                    metrics.get(comp.id)?.innovationScore || 0,
                    metrics.get(comp.id)?.onlinePresence.domainAuthority || 0,
                    (metrics.get(comp.id)?.growthRate || 0) + 50 // Normalize to 0-100
                  ]
                }))}
                categories={[
                  'Market Share',
                  'Customer Satisfaction',
                  'Brand Strength',
                  'Innovation',
                  'Domain Authority',
                  'Growth Rate'
                ]}
              />
            </TabsContent>

            <TabsContent value="metrics" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Market Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Market Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {competitors.map((comp, i) => {
                      const compMetrics = metrics.get(comp.id);
                      return (
                        <div key={comp.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span
                              className="font-medium"
                              style={{ color: getCompetitorColor(i) }}
                            >
                              {comp.name}
                            </span>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Market Share</p>
                                <p className="font-medium">{compMetrics?.marketShare.toFixed(1)}%</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Growth</p>
                                <p className={cn(
                                  "font-medium",
                                  (compMetrics?.growthRate || 0) > 0 ? "text-green-500" : "text-red-500"
                                )}>
                                  {(compMetrics?.growthRate || 0) > 0 ? '+' : ''}
                                  {compMetrics?.growthRate.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          </div>
                          <Progress
                            value={compMetrics?.marketShare || 0}
                            className="h-2"
                            style={{
                              '--progress-background': getCompetitorColor(i)
                            } as any}
                          />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Digital Presence */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Digital Presence</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {competitors.map((comp, i) => {
                      const compMetrics = metrics.get(comp.id);
                      const totalSocial = compMetrics?.onlinePresence.socialMediaFollowers
                        ? Object.values(compMetrics.onlinePresence.socialMediaFollowers).reduce((a, b) => a + b, 0)
                        : 0;
                      
                      return (
                        <div key={comp.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span
                              className="font-medium"
                              style={{ color: getCompetitorColor(i) }}
                            >
                              {comp.name}
                            </span>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">DA</p>
                                <p className="font-medium">{compMetrics?.onlinePresence.domainAuthority}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Social</p>
                                <p className="font-medium">
                                  {totalSocial >= 1000000
                                    ? `${(totalSocial / 1000000).toFixed(1)}M`
                                    : totalSocial >= 1000
                                    ? `${(totalSocial / 1000).toFixed(1)}K`
                                    : totalSocial}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}