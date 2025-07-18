'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Competitor, 
  CompetitorMetrics,
  CompetitorAnalysis 
} from '@/types/competitor-analysis';
import { getCompetitorAnalysisService } from '@/lib/services/competitor-analysis';
import {
  MoreVertical,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Users,
  Globe,
  Shield,
  Activity,
  Calendar,
  BarChart3,
  Eye,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CompetitorCardProps {
  competitor: Competitor;
  selected?: boolean;
  onSelect?: () => void;
  onAnalyze?: () => void;
  onRemove?: () => void;
  compact?: boolean;
}

export function CompetitorCard({
  competitor,
  selected = false,
  onSelect,
  onAnalyze,
  onRemove,
  compact = false
}: CompetitorCardProps) {
  const [metrics, setMetrics] = useState<CompetitorMetrics | null>(null);
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const loadMetrics = async () => {
    try {
      // In a real app, this would fetch from the service
      // For now, using placeholder data
      setMetrics({
        competitorId: competitor.id,
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
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };
  
    loadMetrics();
  }, [competitor.id]);

  // Extract intelligence data from competitor findings (from Firecrawl scraping)
  const getIntelligenceData = () => {
    if (!competitor.description) return null;
    
    try {
      // Try to parse if it's JSON (from our scraping)
      const parsed = JSON.parse(competitor.description);
      return parsed;
    } catch {
      // If not JSON, return as text
      return { description: competitor.description };
    }
  };

  const intelligenceData = getIntelligenceData();

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      if (onAnalyze) {
        await onAnalyze();
      }
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusColor = (status: Competitor['status']) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'monitoring': return 'text-blue-500';
      case 'archived': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: Competitor['status']) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'monitoring': return Eye;
      case 'archived': return XCircle;
      default: return AlertCircle;
    }
  };

  const StatusIcon = getStatusIcon(competitor.status);

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card className={cn(
          "cursor-pointer transition-all",
          selected && "ring-2 ring-primary"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {onSelect && (
                  <Checkbox
                    checked={selected}
                    onCheckedChange={onSelect}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div>
                  <h4 className="font-medium">{competitor.name}</h4>
                  <p className="text-sm text-muted-foreground">{competitor.domain}</p>
                </div>
              </div>
              <Badge variant="outline" className="gap-1">
                <StatusIcon className={cn("h-3 w-3", getStatusColor(competitor.status))} />
                {competitor.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className={cn(
        "relative overflow-hidden transition-all",
        selected && "ring-2 ring-primary shadow-lg"
      )}>
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
        
        <CardHeader className="relative">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {onSelect && (
                <Checkbox
                  checked={selected}
                  onCheckedChange={onSelect}
                  className="mt-1"
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{competitor.name}</h3>
                  <a
                    href={`https://${competitor.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <p className="text-sm text-muted-foreground">{competitor.domain}</p>
                {competitor.description && (
                  <p className="text-sm mt-1 line-clamp-2">{competitor.description}</p>
                )}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleAnalyze} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Analyze Now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setExpanded(!expanded)}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onRemove}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline" className="gap-1">
              <StatusIcon className={cn("h-3 w-3", getStatusColor(competitor.status))} />
              {competitor.status}
            </Badge>
            {competitor.industry && (
              <Badge variant="secondary">{competitor.industry}</Badge>
            )}
            {competitor.lastAnalyzed && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(competitor.lastAnalyzed).toLocaleDateString()}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="relative space-y-4">
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {metrics && (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Market Share</span>
                    <span className="text-sm font-medium">{metrics.marketShare.toFixed(1)}%</span>
                  </div>
                  <Progress value={metrics.marketShare} className="h-1.5" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Growth</span>
                    <span className={cn(
                      "text-sm font-medium flex items-center gap-1",
                      metrics.growthRate > 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {metrics.growthRate > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(metrics.growthRate).toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.abs(metrics.growthRate)} 
                    className={cn(
                      "h-1.5",
                      metrics.growthRate > 0 ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"
                    )}
                  />
                </div>
              </div>

              {/* Online Presence */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Online Presence
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Traffic</span>
                    <span className="font-medium">{formatNumber(metrics.onlinePresence.websiteTraffic)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">DA</span>
                    <span className="font-medium">{metrics.onlinePresence.domainAuthority}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Social</span>
                    <span className="font-medium">
                      {formatNumber(
                        Object.values(metrics.onlinePresence.socialMediaFollowers).reduce((a, b) => a + b, 0)
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">SEO Rank</span>
                    <span className="font-medium">#{metrics.onlinePresence.seoRanking}</span>
                  </div>
                </div>
              </div>

              {/* Performance Scores */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Performance Scores
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Customer Satisfaction</span>
                    <div className="flex items-center gap-2">
                      <Progress value={metrics.customerSatisfaction} className="w-20 h-1.5" />
                      <span className="text-sm font-medium">{metrics.customerSatisfaction.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Brand Strength</span>
                    <div className="flex items-center gap-2">
                      <Progress value={metrics.brandStrength} className="w-20 h-1.5" />
                      <span className="text-sm font-medium">{metrics.brandStrength.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Innovation</span>
                    <div className="flex items-center gap-2">
                      <Progress value={metrics.innovationScore} className="w-20 h-1.5" />
                      <span className="text-sm font-medium">{metrics.innovationScore.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Intelligence Data from Firecrawl */}
          {intelligenceData && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Intelligence Data
              </p>
              
              {intelligenceData.keyServices && intelligenceData.keyServices.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Key Services:</span>
                  <div className="flex flex-wrap gap-1">
                    {intelligenceData.keyServices.map((service: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {intelligenceData.technologies && intelligenceData.technologies.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Technologies:</span>
                  <div className="flex flex-wrap gap-1">
                    {intelligenceData.technologies.map((tech: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {intelligenceData.pricingMentions && intelligenceData.pricingMentions.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Pricing Mentions:</span>
                  <div className="text-xs text-muted-foreground">
                    {intelligenceData.pricingMentions.slice(0, 2).join(', ')}
                  </div>
                </div>
              )}

              {intelligenceData.socialLinks && intelligenceData.socialLinks.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Social Presence:</span>
                  <div className="flex gap-1">
                    {intelligenceData.socialLinks.slice(0, 3).map((link: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {link.includes('linkedin') ? 'LinkedIn' : 
                         link.includes('twitter') ? 'Twitter' : 
                         link.includes('facebook') ? 'Facebook' : 'Social'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {intelligenceData.scrapedAt && (
                <div className="text-xs text-muted-foreground">
                  Last analyzed: {new Date(intelligenceData.scrapedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Quick Analysis
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              <BarChart3 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}