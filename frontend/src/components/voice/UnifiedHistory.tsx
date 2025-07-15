'use client';

import React, { useState } from 'react';
import { UnifiedSession } from '@/types/communication';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare,
  Video,
  Mic,
  Trash2,
  Search,
  RefreshCw,
  Clock,
  Users,
  Film
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UnifiedHistoryProps {
  sessions: UnifiedSession[];
  currentSessionId?: string;
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRefresh: () => void;
}

export function UnifiedHistory({
  sessions,
  currentSessionId,
  isLoading,
  onSelectSession,
  onDeleteSession,
  onRefresh,
}: UnifiedHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'chat' | 'stream' | 'voice'>('all');

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = filterMode === 'all' || session.mode === filterMode;
    return matchesSearch && matchesMode;
  });

  const getModeIcon = (mode: UnifiedSession['mode']) => {
    switch (mode) {
      case 'chat':
        return <MessageSquare className="w-4 h-4" />;
      case 'stream':
        return <Video className="w-4 h-4" />;
      case 'voice':
        return <Mic className="w-4 h-4" />;
    }
  };

  const getModeColor = (mode: UnifiedSession['mode']) => {
    switch (mode) {
      case 'chat':
        return 'text-blue-400';
      case 'stream':
        return 'text-green-400';
      case 'voice':
        return 'text-purple-400';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filter */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
          {(['all', 'chat', 'stream', 'voice'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={cn(
                "flex-1 px-2 py-1 text-xs rounded transition-colors",
                filterMode === mode
                  ? "bg-purple-600/20 text-purple-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Refresh Button */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="w-full text-gray-400 hover:text-white"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">
            Loading sessions...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            {searchQuery || filterMode !== 'all'
              ? 'No sessions found'
              : 'No sessions yet'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group p-3 rounded-lg cursor-pointer transition-all",
                  currentSessionId === session.id
                    ? "bg-purple-600/20 border border-purple-500/30"
                    : "bg-white/5 hover:bg-white/10 border border-transparent"
                )}
                onClick={() => onSelectSession(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={getModeColor(session.mode)}>
                        {getModeIcon(session.mode)}
                      </span>
                      <p className="text-sm text-white font-medium truncate">
                        {session.title}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(session.created_at), 'MMM d, h:mm a')}
                      </span>
                      
                      {session.message_count > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {session.message_count}
                        </span>
                      )}
                      
                      {session.participant_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {session.participant_count}
                        </span>
                      )}
                      
                      {session.recording_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          {session.recording_count}
                        </span>
                      )}
                    </div>

                    {session.media_metadata && (
                      <div className="flex items-center gap-2 mt-1">
                        {session.media_metadata.has_video && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                            Video
                          </span>
                        )}
                        {session.media_metadata.has_screen_share && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                            Screen
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}