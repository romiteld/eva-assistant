'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Linkedin,
  Twitter,
  Facebook,
  Eye,
  Hash,
  AtSign,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SocialPlatform } from '@/types/post-predictor';

interface RealtimePreviewProps {
  content: string;
  platform: SocialPlatform;
  postType: 'text' | 'image' | 'video' | 'link';
}

export function RealtimePreview({ content, platform, postType }: RealtimePreviewProps) {
  const [processedContent, setProcessedContent] = useState('');
  
  useEffect(() => {
    // Process content for hashtags, mentions, and links
    let processed = content;
    
    // Highlight hashtags
    processed = processed.replace(
      /#[a-zA-Z0-9_]+/g, 
      (match) => `<span class="text-blue-400">${match}</span>`
    );
    
    // Highlight mentions
    processed = processed.replace(
      /@[a-zA-Z0-9_]+/g, 
      (match) => `<span class="text-purple-400">${match}</span>`
    );
    
    // Highlight links
    processed = processed.replace(
      /(https?:\/\/[^\s]+)/g,
      (match) => `<span class="text-cyan-400 underline">${match}</span>`
    );
    
    setProcessedContent(processed);
  }, [content]);

  const platformStyles = {
    linkedin: {
      container: 'bg-white text-gray-900',
      header: 'bg-white border-b border-gray-200',
      avatar: 'bg-blue-600',
      name: 'text-gray-900',
      subtitle: 'text-gray-600',
      content: 'text-gray-800',
      actions: 'border-t border-gray-200 bg-gray-50'
    },
    twitter: {
      container: 'bg-black text-white',
      header: 'bg-black',
      avatar: 'bg-gray-800',
      name: 'text-white',
      subtitle: 'text-gray-400',
      content: 'text-white',
      actions: 'border-t border-gray-800'
    },
    facebook: {
      container: 'bg-white text-gray-900',
      header: 'bg-white',
      avatar: 'bg-blue-500',
      name: 'text-gray-900',
      subtitle: 'text-gray-600',
      content: 'text-gray-800',
      actions: 'border-t border-gray-200 bg-gray-50'
    }
  };

  const style = platformStyles[platform];
  const PlatformIcon = platform === 'linkedin' ? Linkedin : 
                      platform === 'twitter' ? Twitter : Facebook;

  const characterCount = content.length;
  const characterLimits = {
    linkedin: 3000,
    twitter: 280,
    facebook: 63206
  };
  const limit = characterLimits[platform];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Live Preview
        </h3>
        <span className={cn(
          "text-xs",
          characterCount > limit ? "text-red-400" : "text-gray-400"
        )}>
          {characterCount} / {limit}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "rounded-xl overflow-hidden shadow-lg",
          style.container
        )}
      >
        {/* Header */}
        <div className={cn("p-4", style.header)}>
          <div className="flex items-start gap-3">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", style.avatar)}>
              <span className="text-white font-semibold text-lg">YO</span>
            </div>
            <div className="flex-1">
              <p className={cn("font-semibold", style.name)}>Your Organization</p>
              <p className={cn("text-sm", style.subtitle)}>
                {platform === 'linkedin' && '10,000 followers'}
                {platform === 'twitter' && '@yourorg'}
                {platform === 'facebook' && 'Business Page'}
              </p>
              <p className={cn("text-xs mt-1", style.subtitle)}>Just now</p>
            </div>
            <PlatformIcon className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4">
          {content ? (
            <p 
              className={cn("whitespace-pre-wrap", style.content)}
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />
          ) : (
            <p className="text-gray-400 italic">Start typing to see your post preview...</p>
          )}

          {/* Media Placeholder */}
          {postType !== 'text' && content && (
            <div className="mt-3 bg-gray-100 rounded-lg p-8 flex items-center justify-center">
              {postType === 'image' && (
                <div className="text-center text-gray-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Image Preview</p>
                </div>
              )}
              {postType === 'video' && (
                <div className="text-center text-gray-500">
                  <div className="w-16 h-16 mx-auto mb-2 bg-gray-300 rounded-lg flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
                  </div>
                  <p className="text-sm">Video Preview</p>
                </div>
              )}
              {postType === 'link' && (
                <div className="text-center text-gray-500">
                  <LinkIcon className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Link Preview</p>
                  <p className="text-xs mt-1">example.com</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {content && (
          <div className={cn("px-4 py-3 flex items-center justify-between", style.actions)}>
            <div className="flex items-center gap-6">
              <button className="flex items-center gap-1 text-gray-600 hover:text-gray-800">
                <span className="text-sm">Like</span>
              </button>
              <button className="flex items-center gap-1 text-gray-600 hover:text-gray-800">
                <span className="text-sm">Comment</span>
              </button>
              <button className="flex items-center gap-1 text-gray-600 hover:text-gray-800">
                <span className="text-sm">Share</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Quick Stats */}
      {content && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-xs text-gray-400">Hashtags</p>
                <p className="text-sm font-medium text-white">
                  {(content.match(/#[a-zA-Z0-9_]+/g) || []).length}
                </p>
              </div>
            </div>
          </div>
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center gap-2">
              <AtSign className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-xs text-gray-400">Mentions</p>
                <p className="text-sm font-medium text-white">
                  {(content.match(/@[a-zA-Z0-9_]+/g) || []).length}
                </p>
              </div>
            </div>
          </div>
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-cyan-400" />
              <div>
                <p className="text-xs text-gray-400">Links</p>
                <p className="text-sm font-medium text-white">
                  {(content.match(/https?:\/\/[^\s]+/g) || []).length}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}