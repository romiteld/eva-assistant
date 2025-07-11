'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp,
  Users,
  Calendar,
  FileText,
  BarChart3,
  Zap,
  Target,
  Lightbulb,
  Activity,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PostPrediction, SocialPlatform } from '@/types/post-predictor';

interface PlatformInsightsProps {
  platform: SocialPlatform;
  insights: PostPrediction['platform_insights'];
}

export function PlatformInsights({ platform, insights }: PlatformInsightsProps) {
  const platformColors = {
    linkedin: { primary: 'from-blue-600 to-blue-700', secondary: 'blue' },
    twitter: { primary: 'from-gray-800 to-black', secondary: 'gray' },
    facebook: { primary: 'from-blue-500 to-blue-600', secondary: 'blue' }
  };

  const colors = platformColors[platform];

  const platformTips = {
    linkedin: [
      'Professional tone resonates best with LinkedIn audience',
      'Include industry insights and thought leadership',
      'Native videos get 5x more engagement than links',
      'Posts with 3-5 hashtags perform optimally',
      'Personal stories with professional lessons drive engagement'
    ],
    twitter: [
      'Keep tweets concise and punchy for maximum impact',
      'Use threads for complex topics to boost engagement',
      'Tweet during commute hours for better visibility',
      'Include relevant GIFs or images for 2x engagement',
      'Engage with replies to boost algorithm ranking'
    ],
    facebook: [
      'Visual content performs 65% better than text-only',
      'Ask questions to encourage comments and discussion',
      'Share behind-the-scenes content for authenticity',
      'Facebook Live videos get 6x more engagement',
      'Post when your audience is most active online'
    ]
  };

  const tips = platformTips[platform] || [];

  return (
    <div className="space-y-6">
      {/* Trending Topics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm"
      >
        <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          Trending Topics on {platform === 'linkedin' ? 'LinkedIn' : platform === 'twitter' ? 'Twitter/X' : 'Facebook'}
        </h4>

        <div className="flex flex-wrap gap-2">
          {insights.trending_topics.map((topic, index) => (
            <motion.span
              key={topic}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium",
                "bg-gradient-to-r text-white shadow-sm",
                colors.primary
              )}
            >
              <Hash className="w-3 h-3 inline mr-1" />
              {topic}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Competitor Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm"
      >
        <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          Competitor Activity Analysis
        </h4>

        <div className="space-y-3">
          {insights.competitor_activity.map((activity, index) => (
            <motion.div
              key={activity.topic}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
            >
              <span className="text-sm text-gray-300">{activity.topic}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${activity.engagement}%` }}
                    transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                    className={cn(
                      "h-full bg-gradient-to-r",
                      activity.engagement > 80 ? "from-green-500 to-green-600" :
                      activity.engagement > 60 ? "from-yellow-500 to-yellow-600" :
                      "from-blue-500 to-blue-600"
                    )}
                  />
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">
                  {activity.engagement}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Audience Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Content Types */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-purple-400" />
            <p className="text-sm font-medium text-gray-300">Popular Content</p>
          </div>
          <div className="space-y-1">
            {insights.audience_preferences.content_types.map((type, index) => (
              <p key={index} className="text-xs text-gray-400 capitalize">
                • {type}
              </p>
            ))}
          </div>
        </div>

        {/* Posting Frequency */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-medium text-gray-300">Ideal Frequency</p>
          </div>
          <p className="text-sm text-white font-medium">
            {insights.audience_preferences.posting_frequency}
          </p>
        </div>

        {/* Engagement Pattern */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-green-400" />
            <p className="text-sm font-medium text-gray-300">Best Times</p>
          </div>
          <p className="text-xs text-gray-400">
            {insights.audience_preferences.engagement_patterns}
          </p>
        </div>
      </motion.div>

      {/* Platform-Specific Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className={cn(
          "p-5 border rounded-xl backdrop-blur-sm",
          "bg-gradient-to-br",
          colors.secondary === 'blue' ? "from-blue-600/10 to-blue-700/10 border-blue-500/20" :
          "from-gray-600/10 to-gray-700/10 border-gray-500/20"
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className={cn(
            "w-5 h-5",
            colors.secondary === 'blue' ? "text-blue-400" : "text-gray-400"
          )} />
          <h4 className="text-md font-semibold text-white">
            {platform === 'linkedin' ? 'LinkedIn' : platform === 'twitter' ? 'Twitter/X' : 'Facebook'} Pro Tips
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tips.map((tip, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.05 }}
              className="flex items-start gap-2"
            >
              <Zap className={cn(
                "w-4 h-4 flex-shrink-0 mt-0.5",
                colors.secondary === 'blue' ? "text-blue-400" : "text-gray-400"
              )} />
              <p className="text-sm text-gray-300">{tip}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl"
      >
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-purple-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-300">Action Items</p>
            <p className="text-xs text-purple-300/80 mt-1">
              Consider incorporating &quot;{insights.trending_topics[0]}&quot; into your content and posting 
              {' '}{insights.audience_preferences.posting_frequency.toLowerCase()} for optimal engagement.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}