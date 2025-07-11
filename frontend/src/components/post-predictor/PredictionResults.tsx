'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ThumbsUp,
  Share2,
  MessageSquare,
  TrendingUp,
  Eye,
  Users,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PostPrediction } from '@/types/post-predictor';

interface PredictionResultsProps {
  prediction: PostPrediction;
}

export function PredictionResults({ prediction }: PredictionResultsProps) {
  const engagementMetrics = [
    { 
      label: 'Likes', 
      value: prediction.predictions.likes, 
      icon: ThumbsUp, 
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20'
    },
    { 
      label: 'Shares', 
      value: prediction.predictions.shares, 
      icon: Share2, 
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20'
    },
    { 
      label: 'Comments', 
      value: prediction.predictions.comments, 
      icon: MessageSquare, 
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20'
    },
    { 
      label: 'Reach', 
      value: prediction.predictions.reach, 
      icon: Users, 
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20'
    }
  ];

  const overallMetrics = [
    { 
      label: 'Engagement Rate', 
      value: `${prediction.predictions.engagement_rate.toFixed(2)}%`, 
      icon: TrendingUp,
      description: 'Expected interaction rate'
    },
    { 
      label: 'Impressions', 
      value: prediction.predictions.impressions.toLocaleString(), 
      icon: Eye,
      description: 'Times your post will be seen'
    }
  ];

  const sentimentColors = {
    positive: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' },
    negative: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
    neutral: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-400' }
  };

  const sentiment = sentimentColors[prediction.content_analysis.sentiment];

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Predicted Engagement</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {engagementMetrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative p-4 rounded-xl border backdrop-blur-sm",
                metric.bgColor,
                metric.borderColor
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">{metric.label}</p>
                  <p className="text-2xl font-bold text-white">
                    {metric.value.toLocaleString()}
                  </p>
                </div>
                <div className={cn("p-2 rounded-lg bg-gradient-to-br", metric.color)}>
                  <metric.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Overall Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {overallMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className="p-5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                <metric.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-400">{metric.label}</p>
                <p className="text-2xl font-bold text-white">{metric.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{metric.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Content Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm"
      >
        <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          Content Analysis
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sentiment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Sentiment</span>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border",
                sentiment.bg,
                sentiment.border,
                sentiment.text
              )}>
                {prediction.content_analysis.sentiment}
              </span>
            </div>
            
            {/* Readability */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Readability Score</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${prediction.content_analysis.readability_score}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                  />
                </div>
                <span className="text-sm text-white font-medium">
                  {prediction.content_analysis.readability_score}
                </span>
              </div>
            </div>
            
            {/* Tone */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Tone</span>
              <span className="text-sm text-white capitalize">
                {prediction.content_analysis.tone}
              </span>
            </div>
          </div>

          {/* Keywords & Hashtags */}
          <div className="space-y-3">
            {/* Keywords */}
            {prediction.content_analysis.keywords.length > 0 && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Top Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {prediction.content_analysis.keywords.slice(0, 5).map((keyword, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-md text-xs text-purple-300"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags */}
            {prediction.content_analysis.hashtags.length > 0 && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Hashtags</p>
                <div className="flex flex-wrap gap-2">
                  {prediction.content_analysis.hashtags.map((hashtag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-blue-300"
                    >
                      {hashtag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Emotions */}
        {prediction.content_analysis.emotions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-sm text-gray-400 mb-3">Emotional Impact</p>
            <div className="space-y-2">
              {prediction.content_analysis.emotions.slice(0, 3).map((emotion, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 capitalize">{emotion.emotion}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${emotion.score * 100}%` }}
                        transition={{ duration: 1, delay: 0.8 + index * 0.1 }}
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {Math.round(emotion.score * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Performance Indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
        className={cn(
          "p-4 rounded-xl border flex items-center gap-3",
          prediction.predictions.engagement_rate > 5 
            ? "bg-green-500/10 border-green-500/20"
            : prediction.predictions.engagement_rate > 2
            ? "bg-yellow-500/10 border-yellow-500/20"
            : "bg-red-500/10 border-red-500/20"
        )}
      >
        {prediction.predictions.engagement_rate > 5 ? (
          <>
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-400">Excellent Performance Expected</p>
              <p className="text-xs text-green-400/80 mt-0.5">
                This post is predicted to perform well above average
              </p>
            </div>
          </>
        ) : prediction.predictions.engagement_rate > 2 ? (
          <>
            <Info className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-yellow-400">Good Performance Expected</p>
              <p className="text-xs text-yellow-400/80 mt-0.5">
                This post should perform at or above average levels
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-400">Below Average Performance</p>
              <p className="text-xs text-red-400/80 mt-0.5">
                Consider optimizing your content for better engagement
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}