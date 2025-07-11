'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Competitor, CompetitorMetrics } from '@/types/competitor-analysis';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Globe,
  DollarSign,
  Activity,
  ArrowUp,
  ArrowDown,
  Info,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketShareVisualizationProps {
  competitors: Competitor[];
}

// Donut chart component
function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = -90; // Start from top

  return (
    <div className="relative w-64 h-64 mx-auto">
      <svg width="256" height="256" viewBox="0 0 256 256">
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const angle = (percentage / 100) * 360;
          const largeArcFlag = angle > 180 ? 1 : 0;
          
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          
          const startX = 128 + 90 * Math.cos((startAngle * Math.PI) / 180);
          const startY = 128 + 90 * Math.sin((startAngle * Math.PI) / 180);
          const endX = 128 + 90 * Math.cos((endAngle * Math.PI) / 180);
          const endY = 128 + 90 * Math.sin((endAngle * Math.PI) / 180);
          
          currentAngle = endAngle;

          return (
            <motion.path
              key={index}
              d={`
                M 128 128
                L ${startX} ${startY}
                A 90 90 0 ${largeArcFlag} 1 ${endX} ${endY}
                Z
              `}
              fill={item.color}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            >
              <title>{`${item.name}: ${item.value.toFixed(1)}%`}</title>
            </motion.path>
          );
        })}
        
        {/* Inner circle for donut effect */}
        <circle
          cx="128"
          cy="128"
          r="50"
          fill="hsl(var(--background))"
        />
        
        {/* Center text */}
        <text
          x="128"
          y="128"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current text-2xl font-bold"
        >
          {data.length}
        </text>
        <text
          x="128"
          y="148"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current text-sm text-muted-foreground"
        >
          Competitors
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-6 space-y-2">
        {data.map((item, index) => (
          <motion.div
            key={index}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium">{item.name}</span>
            </div>
            <span className="text-sm text-muted-foreground">{item.value.toFixed(1)}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Bar chart component
function BarChart({ data }: { data: { name: string; value: number; growth: number }[] }) {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <motion.div
          key={index}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: index * 0.1 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{item.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{item.value.toFixed(1)}%</span>
              <div className={cn(
                "flex items-center gap-1 text-xs",
                item.growth > 0 ? "text-green-500" : "text-red-500"
              )}>
                {item.growth > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(item.growth).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="relative">
            <Progress
              value={(item.value / maxValue) * 100}
              className="h-6"
            />
            <motion.div
              className="absolute inset-0 flex items-center px-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 + 0.3 }}
            >
              <span className="text-xs text-white mix-blend-difference">
                {item.value.toFixed(1)}%
              </span>
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function MarketShareVisualization({ competitors }: MarketShareVisualizationProps) {
  const [metrics, setMetrics] = useState<Map<string, CompetitorMetrics>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'share' | 'growth' | 'trends'>('share');

  useEffect(() => {
    loadMetrics();
  }, [competitors]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // In production, this would fetch real metrics
      const metricsMap = new Map<string, CompetitorMetrics>();
      let remainingShare = 100;
      
      competitors.forEach((comp, index) => {
        const share = index === competitors.length - 1 
          ? remainingShare 
          : Math.random() * (remainingShare / (competitors.length - index));
        remainingShare -= share;

        metricsMap.set(comp.id, {
          competitorId: comp.id,
          marketShare: share,
          growthRate: Math.random() * 40 - 10,
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
      });
      
      setMetrics(metricsMap);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompetitorColor = (index: number): string => {
    const colors = [
      '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
    ];
    return colors[index % colors.length];
  };

  const chartData = competitors.map((comp, index) => ({
    name: comp.name,
    value: metrics.get(comp.id)?.marketShare || 0,
    growth: metrics.get(comp.id)?.growthRate || 0,
    color: getCompetitorColor(index)
  })).sort((a, b) => b.value - a.value);

  const totalMarketSize = chartData.reduce((sum, item) => sum + item.value, 0);
  const averageGrowth = chartData.reduce((sum, item) => sum + item.growth, 0) / chartData.length;

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Market Share Analysis</CardTitle>
            <CardDescription>
              Competitive landscape and market positioning
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {competitors.length} Competitors
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Activity className="h-3 w-3" />
              {averageGrowth > 0 ? '+' : ''}{averageGrowth.toFixed(1)}% Avg Growth
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedView} onValueChange={(v: any) => setSelectedView(v)}>
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="share">Market Share</TabsTrigger>
            <TabsTrigger value="growth">Growth Rates</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium mb-4 text-center">Market Share Distribution</h3>
                <DonutChart data={chartData} />
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-4">Market Position</h3>
                <BarChart
                  data={chartData.map((item, index) => ({
                    ...item,
                    growth: metrics.get(competitors[index]?.id)?.growthRate || 0
                  }))}
                />
              </div>
            </div>

            {/* Market insights */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>{chartData[0]?.name}</strong> leads the market with{' '}
                    <strong>{chartData[0]?.value.toFixed(1)}%</strong> share
                  </p>
                  <p className="text-muted-foreground">
                    Top 3 competitors control{' '}
                    {chartData.slice(0, 3).reduce((sum, item) => sum + item.value, 0).toFixed(1)}%
                    {' '}of the market
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="growth" className="mt-6">
            <div className="space-y-6">
              {/* Growth comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Fastest Growing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const fastest = chartData.reduce((prev, current) => 
                        current.growth > prev.growth ? current : prev
                      );
                      return (
                        <div>
                          <p className="font-medium">{fastest.name}</p>
                          <div className="flex items-center gap-1 text-green-500">
                            <ArrowUp className="h-4 w-4" />
                            <span className="text-2xl font-bold">
                              +{fastest.growth.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Market Average</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">Overall Growth</p>
                    <div className={cn(
                      "flex items-center gap-1",
                      averageGrowth > 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {averageGrowth > 0 ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                      <span className="text-2xl font-bold">
                        {averageGrowth > 0 ? '+' : ''}{averageGrowth.toFixed(1)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Declining</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const declining = chartData.filter(c => c.growth < 0);
                      return (
                        <div>
                          <p className="font-medium">{declining.length} Competitors</p>
                          <div className="flex items-center gap-1 text-red-500">
                            <ArrowDown className="h-4 w-4" />
                            <span className="text-2xl font-bold">
                              {((declining.length / chartData.length) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Growth chart */}
              <div>
                <h3 className="text-sm font-medium mb-4">Growth Rate Comparison</h3>
                <div className="space-y-3">
                  {chartData
                    .sort((a, b) => b.growth - a.growth)
                    .map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {item.value.toFixed(1)}% share
                          </span>
                          <div className={cn(
                            "flex items-center gap-1 font-medium",
                            item.growth > 0 ? "text-green-500" : "text-red-500"
                          )}>
                            {item.growth > 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            {item.growth > 0 ? '+' : ''}{item.growth.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="mt-6">
            <div className="space-y-6">
              {/* Market trends visualization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Market Concentration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Top 3 Market Share</span>
                          <span className="font-medium">
                            {chartData.slice(0, 3).reduce((sum, item) => sum + item.value, 0).toFixed(1)}%
                          </span>
                        </div>
                        <Progress
                          value={chartData.slice(0, 3).reduce((sum, item) => sum + item.value, 0)}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Market Leader Share</span>
                          <span className="font-medium">{chartData[0]?.value.toFixed(1)}%</span>
                        </div>
                        <Progress value={chartData[0]?.value || 0} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Market Dynamics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Market Volatility</span>
                        <Badge variant={averageGrowth > 5 ? "default" : "secondary"}>
                          {averageGrowth > 5 ? "High" : averageGrowth > 0 ? "Medium" : "Low"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Competition Level</span>
                        <Badge variant={chartData.length > 5 ? "default" : "secondary"}>
                          {chartData.length > 5 ? "Intense" : "Moderate"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Market Maturity</span>
                        <Badge variant="outline">
                          {averageGrowth < 5 ? "Mature" : "Growing"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trend indicators */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Key Market Indicators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-500">
                        {chartData.length}
                      </div>
                      <p className="text-sm text-muted-foreground">Active Competitors</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">
                        {chartData.filter(c => c.growth > 0).length}
                      </div>
                      <p className="text-sm text-muted-foreground">Growing</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">
                        {chartData.filter(c => c.value > 10).length}
                      </div>
                      <p className="text-sm text-muted-foreground">Major Players</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-500">
                        {Math.abs(
                          Math.max(...chartData.map(c => c.growth)) - 
                          Math.min(...chartData.map(c => c.growth))
                        ).toFixed(0)}%
                      </div>
                      <p className="text-sm text-muted-foreground">Growth Gap</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}