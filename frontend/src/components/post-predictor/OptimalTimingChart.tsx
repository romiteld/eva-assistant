'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Clock,
  Calendar,
  TrendingUp,
  Globe,
  AlertCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { cn } from '@/lib/utils';
import type { PostPrediction } from '@/types/post-predictor';

interface OptimalTimingChartProps {
  prediction: PostPrediction;
}

export function OptimalTimingChart({ prediction }: OptimalTimingChartProps) {
  const { optimal_timing } = prediction;

  // Prepare data for the chart
  const hourlyData = optimal_timing.hourly_engagement.map(item => ({
    hour: `${item.hour}:00`,
    engagement: item.engagement,
    label: item.hour === parseInt(optimal_timing.best_time.split(':')[0]) ? 'Best Time' : ''
  }));

  // Days of week data (mock for now, could be enhanced)
  const weeklyData = [
    { day: 'Mon', engagement: 65 },
    { day: 'Tue', engagement: optimal_timing.best_day === 'Tuesday' ? 85 : 70 },
    { day: 'Wed', engagement: optimal_timing.best_day === 'Wednesday' ? 85 : 75 },
    { day: 'Thu', engagement: optimal_timing.best_day === 'Thursday' ? 85 : 72 },
    { day: 'Fri', engagement: 68 },
    { day: 'Sat', engagement: 45 },
    { day: 'Sun', engagement: 40 }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-white/20 rounded-lg p-3 shadow-xl">
          <p className="text-sm text-white font-medium">{label}</p>
          <p className="text-xs text-purple-400 mt-1">
            Engagement: {payload[0].value}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Best Time Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Best Time */}
        <div className="p-4 bg-gradient-to-br from-purple-600/10 to-blue-600/10 border border-purple-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Best Time</p>
              <p className="text-xl font-bold text-white">{optimal_timing.best_time}</p>
              <p className="text-xs text-gray-500 mt-0.5">{optimal_timing.timezone}</p>
            </div>
          </div>
        </div>

        {/* Best Day */}
        <div className="p-4 bg-gradient-to-br from-blue-600/10 to-cyan-600/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Best Day</p>
              <p className="text-xl font-bold text-white">{optimal_timing.best_day}</p>
              <p className="text-xs text-gray-500 mt-0.5">Weekly peak</p>
            </div>
          </div>
        </div>

        {/* Peak Engagement */}
        <div className="p-4 bg-gradient-to-br from-green-600/10 to-emerald-600/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Peak Hours</p>
              <p className="text-xl font-bold text-white">
                {optimal_timing.hourly_engagement.filter(h => h.engagement > 70).length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">High activity periods</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Hourly Engagement Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            24-Hour Engagement Pattern
          </h4>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Globe className="w-4 h-4" />
            <span>{optimal_timing.timezone}</span>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="hour" 
                stroke="#9CA3AF" 
                fontSize={12}
                interval={2}
              />
              <YAxis 
                stroke="#9CA3AF" 
                fontSize={12}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="engagement"
                stroke="#8B5CF6"
                strokeWidth={2}
                fill="url(#engagementGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Weekly Pattern */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm"
      >
        <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          Weekly Engagement Pattern
        </h4>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="day" 
                stroke="#9CA3AF" 
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF" 
                fontSize={12}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="engagement" 
                fill="#3B82F6"
                radius={[8, 8, 0, 0]}
              >
                {weeklyData.map((entry, index) => (
                  <Bar
                    key={`cell-${index}`}
                    fill={entry.day === optimal_timing.best_day.slice(0, 3) ? '#8B5CF6' : '#3B82F6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Timing Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-purple-300">Timing Insights</p>
            <ul className="text-xs text-purple-300/80 space-y-1">
              <li>• Post at {optimal_timing.best_time} {optimal_timing.timezone} for maximum visibility</li>
              <li>• {optimal_timing.best_day}s typically see {Math.round(Math.max(...weeklyData.map(d => d.engagement)))}% engagement rate</li>
              <li>• Avoid posting during off-peak hours (late night and early morning)</li>
              <li>• Consider scheduling posts in advance for optimal timing</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}