'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TranscriptionResult } from '@/types/voice';
import { cn } from '@/lib/utils';

interface TranscriptionDisplayProps {
  transcription: TranscriptionResult;
  isInterim?: boolean;
  className?: string;
}

export function TranscriptionDisplay({
  transcription,
  isInterim = false,
  className,
}: TranscriptionDisplayProps) {
  return (
    <Card className={cn('transition-all duration-200', className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p
              className={cn(
                'text-lg',
                isInterim ? 'text-muted-foreground italic' : 'text-foreground'
              )}
            >
              {transcription.text}
              {isInterim && <span className="animate-pulse ml-1">...</span>}
            </p>
            
            {/* Word-level details if available */}
            {transcription.words && transcription.words.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {transcription.words.map((word, index) => (
                  <span
                    key={index}
                    className="text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded"
                    style={{
                      opacity: word.confidence || 1,
                    }}
                  >
                    {word.text}
                  </span>
                ))}
              </div>
            )}
            
            {/* Alternatives if available */}
            {transcription.alternatives && transcription.alternatives.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">Alternatives:</p>
                {transcription.alternatives.map((alt, index) => (
                  <p key={index} className="text-sm text-muted-foreground">
                    {alt.text} ({Math.round(alt.confidence * 100)}%)
                  </p>
                ))}
              </div>
            )}
          </div>
          
          {/* Confidence indicator */}
          {transcription.confidence !== undefined && !isInterim && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-sm font-semibold">
                {Math.round(transcription.confidence * 100)}%
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}