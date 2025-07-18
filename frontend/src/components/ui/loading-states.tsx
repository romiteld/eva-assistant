'use client';

import React from 'react';
import { Loader2, Sparkles, Brain, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';

interface LoadingStateProps {
  variant?: 'default' | 'ai' | 'minimal' | 'skeleton' | 'pulse';
  message?: string;
  submessage?: string;
  progress?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingState({
  variant = 'default',
  message,
  submessage,
  progress,
  size = 'md',
  className
}: LoadingStateProps) {
  const sizeClasses = {
    sm: {
      icon: 'w-6 h-6',
      text: 'text-sm',
      subtext: 'text-xs',
      spacing: 'space-y-2'
    },
    md: {
      icon: 'w-8 h-8',
      text: 'text-base',
      subtext: 'text-sm',
      spacing: 'space-y-3'
    },
    lg: {
      icon: 'w-12 h-12',
      text: 'text-lg',
      subtext: 'text-base',
      spacing: 'space-y-4'
    }
  };

  const sizes = sizeClasses[size];

  if (variant === 'skeleton') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-1/2" />
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="relative">
          <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-25" />
          <div className="relative bg-purple-500 rounded-full w-4 h-4" />
        </div>
      </div>
    );
  }

  const icons = {
    default: <Loader2 className={cn(sizes.icon, 'animate-spin text-purple-500')} />,
    ai: (
      <motion.div
        animate={{ 
          rotate: [0, 180, 360],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Brain className={cn(sizes.icon, 'text-purple-500')} />
      </motion.div>
    ),
    minimal: <Loader2 className={cn(sizes.icon, 'animate-spin text-gray-400')} />
  };

  return (
    <div className={cn('flex flex-col items-center justify-center', sizes.spacing, className)}>
      {icons[variant as keyof typeof icons]}
      
      {message && (
        <p className={cn(sizes.text, 'font-medium text-gray-900 dark:text-gray-100')}>
          {message}
        </p>
      )}
      
      {submessage && (
        <p className={cn(sizes.subtext, 'text-gray-500 dark:text-gray-400 text-center max-w-sm')}>
          {submessage}
        </p>
      )}
      
      {progress !== undefined && (
        <div className="w-full max-w-xs">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-500 mt-1 text-center">{Math.round(progress)}%</p>
        </div>
      )}
    </div>
  );
}

interface PageLoadingProps {
  title?: string;
  description?: string;
}

export function PageLoading({ title, description }: PageLoadingProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingState
        variant="ai"
        message={title || "Loading..."}
        submessage={description}
        size="lg"
      />
    </div>
  );
}

interface ContentLoadingProps {
  lines?: number;
  className?: string;
}

export function ContentLoading({ lines = 3, className }: ContentLoadingProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"
          style={{ width: `${100 - (i * 15)}%` }}
        />
      ))}
    </div>
  );
}

interface ButtonLoadingProps {
  children?: React.ReactNode;
  loadingText?: string;
  className?: string;
}

export function ButtonLoading({ children, loadingText = "Loading...", className }: ButtonLoadingProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Loader2 className="w-4 h-4 animate-spin" />
      {loadingText}
    </span>
  );
}

interface CardLoadingProps {
  className?: string;
}

export function CardLoading({ className }: CardLoadingProps) {
  return (
    <div className={cn('bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm', className)}>
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-4/6" />
        </div>
      </div>
    </div>
  );
}

// AI-specific loading states
interface AILoadingStateProps {
  stage?: string;
  stages?: string[];
  currentStage?: number;
}

export function AILoadingState({ stage, stages, currentStage = 0 }: AILoadingStateProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <motion.div
          className="relative"
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Sparkles className="w-12 h-12 text-purple-500" />
          <motion.div
            className="absolute inset-0"
            animate={{
              rotate: 360
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            <Zap className="w-12 h-12 text-purple-400 opacity-50" />
          </motion.div>
        </motion.div>
      </div>
      
      {stage && (
        <p className="text-center text-gray-600 dark:text-gray-400 font-medium">
          {stage}
        </p>
      )}
      
      {stages && stages.length > 0 && (
        <div className="space-y-2 max-w-md mx-auto">
          {stages.map((s, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-3 text-sm',
                index < currentStage ? 'text-green-600' : 
                index === currentStage ? 'text-purple-600 font-medium' : 
                'text-gray-400'
              )}
            >
              <div className={cn(
                'w-2 h-2 rounded-full',
                index < currentStage ? 'bg-green-600' :
                index === currentStage ? 'bg-purple-600 animate-pulse' :
                'bg-gray-300'
              )} />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Legacy export for backward compatibility
export const LoadingStates = {
  LoadingState,
  PageLoading,
  ContentLoading,
  ButtonLoading,
  CardLoading,
  AILoadingState
}