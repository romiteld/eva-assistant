'use client';

import React from 'react';
import { CommunicationMode } from '@/types/communication';
import { MessageSquare, Video, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeSelectorProps {
  currentMode: CommunicationMode;
  onModeChange: (mode: CommunicationMode) => void;
  disabled?: boolean;
}

const modes: { value: CommunicationMode; label: string; icon: React.ElementType }[] = [
  { value: 'chat', label: 'Chat', icon: MessageSquare },
  { value: 'stream', label: 'Stream', icon: Video },
  { value: 'voice', label: 'Voice', icon: Mic },
];

export function ModeSelector({ currentMode, onModeChange, disabled }: ModeSelectorProps) {
  return (
    <div className="flex items-center bg-white/5 rounded-lg p-1 w-full sm:w-auto">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.value;
        
        return (
          <button
            key={mode.value}
            onClick={() => !disabled && onModeChange(mode.value)}
            disabled={disabled}
            className={cn(
              "flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-md transition-all duration-200",
              "text-xs sm:text-sm font-medium flex-1 sm:flex-initial",
              isActive
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-white/5",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}