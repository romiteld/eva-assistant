'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Linkedin,
  Twitter,
  Facebook,
  Sparkles,
  Loader2,
  Info,
  Image,
  Video,
  Link,
  Type,
  Users,
  Briefcase,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RealtimePreview } from './RealtimePreview';
import type { SocialPlatform, PostPredictorRequest } from '@/types/post-predictor';

interface PostPredictorFormProps {
  onSubmit: (request: PostPredictorRequest) => void;
  isLoading?: boolean;
}

export function PostPredictorForm({ onSubmit, isLoading = false }: PostPredictorFormProps) {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('linkedin');
  const [targetAudience, setTargetAudience] = useState('');
  const [industry, setIndustry] = useState('');
  const [postType, setPostType] = useState<'text' | 'image' | 'video' | 'link'>('text');
  const [charCount, setCharCount] = useState(0);
  const [showPreview, setShowPreview] = useState(true);

  const platforms = [
    { id: 'linkedin' as SocialPlatform, name: 'LinkedIn', icon: Linkedin, color: 'from-blue-600 to-blue-700', limit: 3000 },
    { id: 'twitter' as SocialPlatform, name: 'Twitter/X', icon: Twitter, color: 'from-gray-800 to-black', limit: 280 },
    { id: 'facebook' as SocialPlatform, name: 'Facebook', icon: Facebook, color: 'from-blue-500 to-blue-600', limit: 63206 }
  ];

  const postTypes = [
    { id: 'text' as const, name: 'Text', icon: Type },
    { id: 'image' as const, name: 'Image', icon: Image },
    { id: 'video' as const, name: 'Video', icon: Video },
    { id: 'link' as const, name: 'Link', icon: Link }
  ];

  const industries = [
    'Technology',
    'Finance',
    'Healthcare',
    'Education',
    'Marketing',
    'Sales',
    'HR/Recruiting',
    'Consulting',
    'Real Estate',
    'Other'
  ];

  const audienceTypes = [
    'Business Professionals',
    'Entrepreneurs',
    'Job Seekers',
    'Students',
    'Industry Experts',
    'General Audience',
    'Clients/Customers',
    'Team Members',
    'Investors'
  ];

  const selectedPlatform = platforms.find(p => p.id === platform);
  const characterLimit = selectedPlatform?.limit || 3000;

  useEffect(() => {
    setCharCount(content.length);
  }, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    onSubmit({
      content,
      platform,
      target_audience: targetAudience,
      industry,
      post_type: postType
    });
  };

  return (
    <div className="space-y-6">
      {/* Preview Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Create Your Post</h3>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
        >
          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
      {/* Platform Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Select Platform
        </label>
        <div className="grid grid-cols-3 gap-3">
          {platforms.map((p) => (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              className={cn(
                "relative p-4 rounded-xl border transition-all",
                platform === p.id
                  ? "bg-gradient-to-br border-white/20 shadow-lg"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {platform === p.id && (
                <div className={cn("absolute inset-0 bg-gradient-to-br rounded-xl opacity-20", p.color)} />
              )}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <p.icon className="w-6 h-6 text-white" />
                <span className="text-sm font-medium text-white">{p.name}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content Input */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-300">
            Post Content
          </label>
          <span className={cn(
            "text-xs",
            charCount > characterLimit ? "text-red-400" : "text-gray-400"
          )}>
            {charCount} / {characterLimit}
          </span>
        </div>
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`What's on your mind? Write your ${selectedPlatform?.name} post here...`}
            className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
            required
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <motion.button
              type="button"
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Post Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Post Type
        </label>
        <div className="flex gap-2">
          {postTypes.map((type) => (
            <motion.button
              key={type.id}
              type="button"
              onClick={() => setPostType(type.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                postType === type.id
                  ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <type.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{type.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Additional Options */}
      <div className="grid grid-cols-2 gap-4">
        {/* Industry */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Briefcase className="w-4 h-4 inline mr-2" />
            Industry (Optional)
          </label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          >
            <option value="">Select Industry</option>
            {industries.map((ind) => (
              <option key={ind} value={ind} className="bg-gray-900">
                {ind}
              </option>
            ))}
          </select>
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Users className="w-4 h-4 inline mr-2" />
            Target Audience (Optional)
          </label>
          <select
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          >
            <option value="">Select Audience</option>
            {audienceTypes.map((aud) => (
              <option key={aud} value={aud} className="bg-gray-900">
                {aud}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <p className="font-medium mb-1">Pro Tip</p>
          <p className="text-blue-300/80">
            Our AI analyzes your content for sentiment, readability, and engagement potential. 
            The more specific you are about your audience and industry, the more accurate our predictions will be.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isLoading || !content.trim()}
        className={cn(
          "w-full py-3 px-6 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
          isLoading || !content.trim()
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg"
        )}
        whileHover={!isLoading && content.trim() ? { scale: 1.02 } : {}}
        whileTap={!isLoading && content.trim() ? { scale: 0.98 } : {}}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Analyzing Post...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span>Predict Engagement</span>
          </>
        )}
      </motion.button>
    </form>

    {/* Real-time Preview */}
    {showPreview && content && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mt-6 p-4 bg-white/5 border border-white/10 rounded-xl"
      >
        <RealtimePreview 
          content={content}
          platform={platform}
          postType={postType}
        />
      </motion.div>
    )}
    </div>
  );
}