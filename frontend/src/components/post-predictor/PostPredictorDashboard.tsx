'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3,
  TrendingUp,
  Target,
  Calendar,
  Clock,
  Hash,
  Zap,
  Award,
  Lightbulb,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { PostPredictorService } from '@/lib/services/post-predictor';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AnalyticsData {
  totalPredictions: number;
  averageEngagementRate: number;
  platformBreakdown: Record<string, number>;
  sentimentBreakdown: Record<string, number>;
  topKeywords: string[];
  engagementTrends: Array<{ date: string; engagement: number }>;
  bestPerformingPlatform: string;
  improvementSuggestions: string[];
}

interface PostPredictorDashboardProps {
  userId: string;
}

export function PostPredictorDashboard({ userId }: PostPredictorDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'trends' | 'insights'>('overview');
  const { toast } = useToast();
  const postPredictorService = useMemo(() => new PostPredictorService(), []);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await postPredictorService.getAnalytics(userId, timeRange);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, timeRange, postPredictorService, toast]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleRefresh = () => {
    loadAnalytics();
  };

  const handleExport = () => {
    if (!analytics) return;
    
    const exportData = {
      generatedAt: new Date().toISOString(),
      timeRange: `${timeRange} days`,
      ...analytics
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `post-predictor-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Export Complete',
      description: 'Analytics data has been exported successfully.',
    });
  };

  const timeRangeOptions = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 365, label: '1 year' }
  ];

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'trends' as const, label: 'Trends', icon: TrendingUp },
    { id: 'insights' as const, label: 'Insights', icon: Lightbulb }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics || analytics.totalPredictions === 0) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No Prediction Data</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          Start creating post predictions to see your analytics and engagement insights here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Post Predictor Analytics</h2>
          <p className="text-gray-400 mt-1">
            Insights from your {analytics.totalPredictions} predictions over the last {timeRange} days
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
          >
            {timeRangeOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-gray-900">
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={handleExport}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Download className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2',
              selectedTab === tab.id
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-white'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {selectedTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Average Engagement</p>
                    <p className="text-2xl font-bold text-white">
                      {analytics.averageEngagementRate.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(analytics.averageEngagementRate * 20, 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-600/20 rounded-lg">
                    <Award className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Best Platform</p>
                    <p className="text-2xl font-bold text-white capitalize">
                      {analytics.bestPerformingPlatform || 'N/A'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Highest average engagement rate
                </p>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-600/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Predictions</p>
                    <p className="text-2xl font-bold text-white">
                      {analytics.totalPredictions}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Posts analyzed this period
                </p>
              </div>
            </div>

            {/* Platform Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-4">Platform Usage</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.platformBreakdown).map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <span className="text-gray-300 capitalize">{platform}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                            style={{ width: `${(count / analytics.totalPredictions) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-4">Sentiment Analysis</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.sentimentBreakdown).map(([sentiment, count]) => (
                    <div key={sentiment} className="flex items-center justify-between">
                      <span className={cn(
                        "capitalize",
                        sentiment === 'positive' ? 'text-green-400' :
                        sentiment === 'negative' ? 'text-red-400' : 'text-gray-400'
                      )}>
                        {sentiment}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full",
                              sentiment === 'positive' ? 'bg-green-500' :
                              sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-500'
                            )}
                            style={{ width: `${(count / analytics.totalPredictions) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {selectedTab === 'trends' && (
          <motion.div
            key="trends"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Engagement Trends Chart */}
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Engagement Trends</h3>
              <div className="h-64 flex items-end gap-2">
                {analytics.engagementTrends.map((trend, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-gradient-to-t from-purple-600 to-blue-600 rounded-t-sm min-h-[4px]"
                      style={{ height: `${Math.max((trend.engagement / 10) * 100, 4)}%` }}
                    />
                    <span className="text-xs text-gray-400 mt-2 transform -rotate-45 origin-left">
                      {new Date(trend.date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Keywords */}
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Hash className="w-5 h-5 text-purple-400" />
                Top Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {analytics.topKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-600/20 border border-purple-500/30 rounded-full text-sm text-purple-300"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {selectedTab === 'insights' && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Improvement Suggestions */}
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                Improvement Suggestions
              </h3>
              <div className="space-y-3">
                {analytics.improvementSuggestions.length > 0 ? (
                  analytics.improvementSuggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-300">{suggestion}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Award className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <p className="text-green-400 font-medium">Great job!</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Your posts are performing well. Keep up the excellent work!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-md font-semibold text-white mb-3">Content Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Best performing sentiment:</span>
                    <span className="text-white capitalize">
                      {Object.entries(analytics.sentimentBreakdown).reduce((a, b) => 
                        analytics.sentimentBreakdown[a[0]] > analytics.sentimentBreakdown[b[0]] ? a : b
                      )[0]}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Most used keywords:</span>
                    <span className="text-white">{analytics.topKeywords.slice(0, 3).join(', ')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Platform diversity:</span>
                    <span className="text-white">{Object.keys(analytics.platformBreakdown).length} platforms</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-md font-semibold text-white mb-3">Posting Patterns</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Predictions per day:</span>
                    <span className="text-white">{(analytics.totalPredictions / timeRange).toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Most active day:</span>
                    <span className="text-white">
                      {analytics.engagementTrends.length > 0 ? 
                        new Date(analytics.engagementTrends[0].date).toLocaleDateString('en-US', { weekday: 'long' }) : 
                        'N/A'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Engagement consistency:</span>
                    <span className="text-white">
                      {analytics.engagementTrends.length > 1 ? 'Variable' : 'Stable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}