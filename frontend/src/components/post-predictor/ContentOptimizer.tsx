'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles,
  ChevronRight,
  Check,
  Copy,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Zap,
  Target,
  TrendingUp,
  Hash,
  AtSign,
  Type,
  Smile
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentOptimization, PostPrediction } from '@/types/post-predictor';

interface ContentOptimizerProps {
  optimization?: ContentOptimization;
  suggestions: PostPrediction['suggestions'];
  onApplyOptimization?: (content: string) => void;
}

export function ContentOptimizer({ optimization, suggestions, onApplyOptimization }: ContentOptimizerProps) {
  const [showOptimized, setShowOptimized] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedOptimized, setCopiedOptimized] = useState(false);

  const handleCopy = async (text: string, type: 'original' | 'optimized') => {
    await navigator.clipboard.writeText(text);
    if (type === 'original') {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    } else {
      setCopiedOptimized(true);
      setTimeout(() => setCopiedOptimized(false), 2000);
    }
  };

  const priorityColors = {
    high: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: 'text-red-500' },
    medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', icon: 'text-yellow-500' },
    low: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: 'text-blue-500' }
  };

  const suggestionIcons = {
    content: Type,
    timing: AlertCircle,
    hashtag: Hash,
    format: Zap,
    length: Target
  };

  // Sort suggestions by priority and impact
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.impact - a.impact;
  });

  return (
    <div className="space-y-6">
      {/* AI Suggestions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm"
      >
        <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          AI-Powered Suggestions
        </h4>

        <div className="space-y-3">
          {sortedSuggestions.map((suggestion, index) => {
            const colors = priorityColors[suggestion.priority];
            const Icon = suggestionIcons[suggestion.type] || AlertCircle;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "p-4 rounded-lg border flex items-start gap-3",
                  colors.bg,
                  colors.border
                )}
              >
                <div className={cn("p-2 rounded-lg bg-white/10", colors.icon)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-sm font-medium capitalize", colors.text)}>
                      {suggestion.type} • {suggestion.priority} Priority
                    </span>
                    <span className="text-xs text-gray-400">
                      +{suggestion.impact}% impact
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{suggestion.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Content Optimization */}
      {optimization && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-md font-semibold text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              Optimized Version
            </h4>
            {optimization.score_improvement > 0 && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400 font-medium">
                  +{optimization.score_improvement}% improvement
                </span>
              </div>
            )}
          </div>

          {/* Toggle View */}
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-lg">
            <button
              onClick={() => setShowOptimized(false)}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
                !showOptimized
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              Original
            </button>
            <button
              onClick={() => setShowOptimized(true)}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
                showOptimized
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              Optimized
            </button>
          </div>

          {/* Content Display */}
          <AnimatePresence mode="wait">
            {!showOptimized ? (
              <motion.div
                key="original"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="relative p-4 bg-white/5 border border-white/10 rounded-xl"
              >
                <p className="text-sm text-gray-300 whitespace-pre-wrap">
                  {optimization.original_content}
                </p>
                <button
                  onClick={() => handleCopy(optimization.original_content, 'original')}
                  className="absolute top-3 right-3 p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {copiedOriginal ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="optimized"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative p-4 bg-gradient-to-br from-purple-600/10 to-blue-600/10 border border-purple-500/20 rounded-xl"
              >
                <p className="text-sm text-gray-300 whitespace-pre-wrap">
                  {optimization.optimized_content}
                </p>
                <button
                  onClick={() => handleCopy(optimization.optimized_content, 'optimized')}
                  className="absolute top-3 right-3 p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {copiedOptimized ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Apply Optimization Button */}
          {showOptimized && onApplyOptimization && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onApplyOptimization(optimization.optimized_content)}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Sparkles className="w-5 h-5" />
              Apply Optimized Version
            </motion.button>
          )}

          {/* Changes Made */}
          {optimization.changes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="p-4 bg-white/5 border border-white/10 rounded-xl"
            >
              <p className="text-sm font-medium text-gray-300 mb-3">Changes Applied:</p>
              <div className="space-y-2">
                {optimization.changes.map((change, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="flex items-start gap-2 text-xs"
                  >
                    <ArrowRight className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-gray-400">{change.type}:</span>
                      <span className="text-gray-300 ml-1">{change.description}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Optimization Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl"
      >
        <div className="flex items-start gap-3">
          <Smile className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-300">Quick Optimization Tips</p>
            <ul className="text-xs text-blue-300/80 space-y-1">
              <li>• Use 1-3 relevant hashtags for better discoverability</li>
              <li>• Add a clear call-to-action to encourage engagement</li>
              <li>• Include emojis to make your post more visually appealing</li>
              <li>• Ask questions to spark conversations in comments</li>
              <li>• Keep sentences short and paragraphs scannable</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}