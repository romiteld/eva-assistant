'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface AudioLevelIndicatorProps {
  level: number; // 0-1
  isActive: boolean;
  type?: 'circular' | 'linear' | 'dots';
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export function AudioLevelIndicator({
  level,
  isActive,
  type = 'circular',
  size = 'md',
  color = 'rgb(239, 68, 68)', // red-500
  className,
}: AudioLevelIndicatorProps) {
  const normalizedLevel = Math.max(0, Math.min(1, level));

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  if (type === 'circular') {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full',
          sizeClasses[size],
          className
        )}
      >
        {/* Background ring */}
        <div className="absolute inset-0 rounded-full border-2 border-gray-300 dark:border-gray-600" />
        
        {/* Level indicator ring */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-full transition-all duration-100"
            style={{
              background: `conic-gradient(${color} ${normalizedLevel * 360}deg, transparent 0deg)`,
              transform: 'rotate(-90deg)',
            }}
          />
        )}
        
        {/* Inner circle with pulse effect */}
        <div
          className={cn(
            'absolute inset-2 rounded-full transition-all duration-200',
            isActive && normalizedLevel > 0.1 && 'animate-pulse'
          )}
          style={{
            backgroundColor: isActive ? `${color}${Math.floor(normalizedLevel * 255).toString(16).padStart(2, '0')}` : 'transparent',
          }}
        />
        
        {/* Center dot */}
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: isActive ? color : '#9CA3AF',
          }}
        />
      </div>
    );
  }

  if (type === 'linear') {
    return (
      <div className={cn('flex items-center space-x-1', className)}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={cn(
              'w-1 rounded-full transition-all duration-100',
              size === 'sm' ? 'h-4' : size === 'md' ? 'h-6' : 'h-8'
            )}
            style={{
              backgroundColor: isActive && normalizedLevel > i / 10 ? color : '#E5E7EB',
              height: isActive && normalizedLevel > i / 10 
                ? `${20 + (i * 2)}px` 
                : size === 'sm' ? '16px' : size === 'md' ? '24px' : '32px',
            }}
          />
        ))}
      </div>
    );
  }

  if (type === 'dots') {
    const dotCount = 8;
    const activeDots = Math.floor(normalizedLevel * dotCount);

    return (
      <div className={cn('flex items-center space-x-1', className)}>
        {Array.from({ length: dotCount }, (_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-full transition-all duration-100',
              size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
            )}
            style={{
              backgroundColor: isActive && i < activeDots ? color : '#E5E7EB',
              transform: isActive && i < activeDots ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}

interface VoiceActivityIndicatorProps {
  isActive: boolean;
  className?: string;
}

export function VoiceActivityIndicator({ isActive, className }: VoiceActivityIndicatorProps) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <div
        className={cn(
          'w-3 h-3 rounded-full transition-all duration-200',
          isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        )}
      />
      <span className="text-sm text-muted-foreground">
        {isActive ? 'Voice Detected' : 'Listening...'}
      </span>
    </div>
  );
}

interface AudioMetricsDisplayProps {
  inputLevel: number;
  outputLevel: number;
  noiseLevel: number;
  voiceActivity: boolean;
  latency: number;
  className?: string;
}

export function AudioMetricsDisplay({
  inputLevel,
  outputLevel,
  noiseLevel,
  voiceActivity,
  latency,
  className,
}: AudioMetricsDisplayProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-4 text-sm', className)}>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Input:</span>
          <span className="font-mono">{(inputLevel * 100).toFixed(1)}%</span>
        </div>
        <AudioLevelIndicator
          level={inputLevel}
          isActive={true}
          type="linear"
          size="sm"
          color="rgb(34, 197, 94)" // green-500
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Output:</span>
          <span className="font-mono">{(outputLevel * 100).toFixed(1)}%</span>
        </div>
        <AudioLevelIndicator
          level={outputLevel}
          isActive={true}
          type="linear"
          size="sm"
          color="rgb(59, 130, 246)" // blue-500
        />
      </div>
      
      <div className="flex justify-between">
        <span className="text-muted-foreground">Noise:</span>
        <span className="font-mono">{(noiseLevel * 100).toFixed(1)}%</span>
      </div>
      
      <div className="flex justify-between">
        <span className="text-muted-foreground">Latency:</span>
        <span className="font-mono">{latency}ms</span>
      </div>
      
      <div className="col-span-2">
        <VoiceActivityIndicator isActive={voiceActivity} />
      </div>
    </div>
  );
}