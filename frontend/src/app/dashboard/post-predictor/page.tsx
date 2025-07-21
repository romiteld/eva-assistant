'use client';

import React, { useState } from 'react';
import { PostPredictorForm } from '@/components/post-predictor/PostPredictorForm';
import { PredictionResults } from '@/components/post-predictor/PredictionResults';
import { OptimalTimingChart } from '@/components/post-predictor/OptimalTimingChart';
import { ContentOptimizer } from '@/components/post-predictor/ContentOptimizer';
import { PlatformInsights } from '@/components/post-predictor/PlatformInsights';
import { PostPredictorDashboard } from '@/components/post-predictor/PostPredictorDashboard';
import { PostPredictorService } from '@/lib/services/post-predictor';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/browser';
import { 
  Sparkles,
  BarChart3,
  Clock,
  Lightbulb,
  Target,
  History,
  Download,
  Share2,
  TrendingUp
} from 'lucide-react';
import type { PostPredictorRequest, PostPredictorResponse } from '@/types/post-predictor';

export default function PostPredictorPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [predictionData, setPredictionData] = useState<PostPredictorResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'results' | 'timing' | 'optimizer' | 'insights'>('results');
  const [currentView, setCurrentView] = useState<'predict' | 'dashboard'>('predict');
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const postPredictorService = new PostPredictorService();

  React.useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUserId();
  }, []);

  const handlePredict = async (request: PostPredictorRequest) => {
    setIsLoading(true);
    try {
      const response = await postPredictorService.predictEngagement(request);
      setPredictionData(response);
      setActiveTab('results');
      
      toast({
        title: 'Prediction Complete',
        description: `Your ${request.platform} post has been analyzed successfully!`,
      });
    } catch (error) {
      console.error('Error predicting engagement:', error);
      toast({
        title: 'Prediction Failed',
        description: 'Unable to analyze your post. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyOptimization = (optimizedContent: string) => {
    // In a real app, this would update the form with the optimized content
    toast({
      title: 'Optimization Applied',
      description: 'The optimized content has been copied to your clipboard.',
    });
    navigator.clipboard.writeText(optimizedContent);
  };

  const tabs = [
    { id: 'results' as const, label: 'Predictions', icon: BarChart3 },
    { id: 'timing' as const, label: 'Optimal Timing', icon: Clock },
    { id: 'optimizer' as const, label: 'Content Optimizer', icon: Sparkles },
    { id: 'insights' as const, label: 'Platform Insights', icon: Lightbulb }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            Post Predictor
          </h1>
          <div className="flex items-center gap-2 justify-end">
            <button 
              onClick={() => setCurrentView(currentView === 'predict' ? 'dashboard' : 'predict')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'dashboard' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <span className="hidden sm:inline">
                {currentView === 'predict' ? 'View Analytics' : 'Create Prediction'}
              </span>
              <span className="sm:hidden">
                {currentView === 'predict' ? 'Analytics' : 'Create'}
              </span>
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <Download className="w-5 h-5 text-gray-400" />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <Share2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
        <p className="text-gray-400">
          Predict social media engagement with AI-powered analytics and optimization
        </p>
      </motion.div>

      {currentView === 'predict' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column - Form */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="order-2 lg:order-1"
          >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 h-full min-h-[600px] flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-400" />
                Create Your Post
              </h2>
              <div className="flex-1">
                <PostPredictorForm onSubmit={handlePredict} isLoading={isLoading} />
              </div>
            </div>
          </motion.div>

          {/* Right Column - Results */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="order-1 lg:order-2"
          >
            {predictionData ? (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl h-full min-h-[600px] flex flex-col">
                {/* Tabs */}
                <div className="border-b border-white/10 p-4 flex-shrink-0">
                    <div className="flex gap-2 flex-wrap">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`
                            flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${activeTab === tab.id 
                              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
                          `}
                        >
                          <tab.icon className="w-4 h-4" />
                          <span className="hidden sm:inline">{tab.label}</span>
                          <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <AnimatePresence mode="wait">
                      {activeTab === 'results' && (
                        <motion.div
                          key="results"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex-1"
                        >
                          <PredictionResults prediction={predictionData.prediction} />
                        </motion.div>
                      )}

                      {activeTab === 'timing' && (
                        <motion.div
                          key="timing"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex-1"
                        >
                          <OptimalTimingChart prediction={predictionData.prediction} />
                        </motion.div>
                      )}

                      {activeTab === 'optimizer' && (
                        <motion.div
                          key="optimizer"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex-1"
                        >
                          <ContentOptimizer 
                            optimization={predictionData.optimization}
                            suggestions={predictionData.prediction.suggestions}
                            onApplyOptimization={handleApplyOptimization}
                          />
                        </motion.div>
                      )}

                      {activeTab === 'insights' && (
                        <motion.div
                          key="insights"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex-1"
                        >
                          <PlatformInsights 
                            platform={predictionData.prediction.platform}
                            insights={predictionData.prediction.platform_insights}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 h-full min-h-[600px] flex items-center justify-center">
                  <div className="text-center max-w-lg">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-12 h-12 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">
                      Start Predicting Engagement
                    </h3>
                    <p className="text-gray-400 mb-6 leading-relaxed">
                      Enter your social media post content and let our AI analyze its potential engagement, 
                      suggest improvements, and find the optimal posting time.
                    </p>
                    
                    {/* Feature Highlights */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-3"
                    >
                      {[
                        { icon: BarChart3, label: 'Engagement Prediction', value: 'AI-Powered', color: 'from-purple-600/20 to-purple-700/20' },
                        { icon: Clock, label: 'Best Posting Time', value: 'Data-Driven', color: 'from-blue-600/20 to-blue-700/20' },
                        { icon: Sparkles, label: 'Content Optimization', value: 'Real-Time', color: 'from-green-600/20 to-green-700/20' },
                        { icon: Target, label: 'Platform Insights', value: 'Actionable', color: 'from-orange-600/20 to-orange-700/20' }
                      ].map((feature, index) => (
                        <motion.div 
                          key={feature.label}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                          className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-colors"
                        >
                          <div className={`p-2 bg-gradient-to-br ${feature.color} rounded-lg`}>
                            <feature.icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{feature.label}</p>
                            <p className="text-xs text-gray-400">{feature.value}</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                </div>
              )}
            </motion.div>

          {/* Bottom Section - Tips & Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Pro Tips */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                Pro Tips for Better Engagement
              </h3>
              <div className="space-y-3">
                {[
                  { tip: "Use questions to encourage comments and discussions", platform: "All platforms" },
                  { tip: "Post when your audience is most active (typically 9-11 AM)", platform: "LinkedIn" },
                  { tip: "Include relevant hashtags (3-5 for LinkedIn, 1-2 for Twitter)", platform: "Social media" },
                  { tip: "Add personal stories or experiences to increase relatability", platform: "Content strategy" },
                  { tip: "Use emojis strategically to add personality and visual appeal", platform: "Engagement" }
                ].map((item, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm text-white mb-1">{item.tip}</p>
                      <p className="text-xs text-gray-400">{item.platform}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Platform Benchmarks
              </h3>
              <div className="space-y-4">
                {[
                  { platform: "LinkedIn", avgEngagement: "2.3%", bestTime: "9-11 AM", color: "from-blue-500 to-blue-600" },
                  { platform: "Twitter/X", avgEngagement: "1.8%", bestTime: "1-3 PM", color: "from-gray-600 to-gray-700" },
                  { platform: "Facebook", avgEngagement: "1.5%", bestTime: "6-9 PM", color: "from-blue-400 to-blue-500" }
                ].map((stat, index) => (
                  <motion.div 
                    key={stat.platform}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.0 + index * 0.1 }}
                    className="p-4 bg-white/5 rounded-xl border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-white">{stat.platform}</h4>
                      <div className={`px-2 py-1 bg-gradient-to-r ${stat.color} rounded-full text-xs font-medium text-white`}>
                        {stat.avgEngagement}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Avg. Engagement</span>
                      <span>Best Time: {stat.bestTime}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
                <p className="text-xs text-purple-300 font-medium mb-1">💡 Did you know?</p>
                <p className="text-xs text-purple-200">
                  Posts with personal stories get 30% more engagement than pure business content.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {userId ? (
              <PostPredictorDashboard userId={userId} />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">Loading user data...</p>
              </div>
            )}
          </motion.div>
        )}

      </div>
  );
}