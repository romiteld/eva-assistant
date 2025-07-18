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
    <>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              Post Predictor
            </h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentView(currentView === 'predict' ? 'dashboard' : 'predict')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'dashboard' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {currentView === 'predict' ? 'View Analytics' : 'Create Prediction'}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Form */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-1"
            >
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Create Your Post
                </h2>
                <PostPredictorForm onSubmit={handlePredict} isLoading={isLoading} />
              </div>
            </motion.div>

            {/* Right Column - Results */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2"
            >
              {predictionData ? (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                  {/* Tabs */}
                  <div className="border-b border-white/10 p-4">
                    <div className="flex gap-2">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${activeTab === tab.id 
                              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
                          `}
                        >
                          <tab.icon className="w-4 h-4" />
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="p-6">
                    <AnimatePresence mode="wait">
                      {activeTab === 'results' && (
                        <motion.div
                          key="results"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
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
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-12">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-12 h-12 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Start Predicting Engagement
                    </h3>
                    <p className="text-gray-400 max-w-md mx-auto">
                      Enter your social media post content and let our AI analyze its potential engagement, 
                      suggest improvements, and find the optimal posting time.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
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

        {/* Feature Highlights */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {[
            { icon: BarChart3, label: 'Engagement Prediction', value: 'AI-Powered' },
            { icon: Clock, label: 'Best Posting Time', value: 'Data-Driven' },
            { icon: Sparkles, label: 'Content Optimization', value: 'Real-Time' },
            { icon: Target, label: 'Platform Insights', value: 'Actionable' }
          ].map((feature, index) => (
            <div 
              key={feature.label}
              className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3"
            >
              <div className="p-2 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg">
                <feature.icon className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{feature.label}</p>
                <p className="text-xs text-gray-400">{feature.value}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </>
  );
}