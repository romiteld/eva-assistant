'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Clock, 
  MessageSquare, 
  Wrench, 
  Calendar,
  Search,
  Trash2,
  Download,
  Play,
  Pause,
  User,
  Bot,
  Loader2,
  FolderOpen,
  Database
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { voiceHistoryService, VoiceSession, SessionSummary } from '@/lib/services/voice-history-service';
import { supabase } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAudioCache } from '@/hooks/useAudioCache';

export default function VoiceHistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<VoiceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storageUsage, setStorageUsage] = useState<any>(null);
  const { toast } = useToast();
  const { playAudio, stopAudio, isPlaying } = useAudioCache();

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
    loadStorageUsage();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to view your voice history",
          variant: "destructive",
        });
        return;
      }

      const userSessions = await voiceHistoryService.listUserSessions(user.id);
      setSessions(userSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast({
        title: "Error loading sessions",
        description: "Failed to load your voice history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStorageUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const usage = await voiceHistoryService.getUserStorageUsage(user.id);
      setStorageUsage(usage);
    } catch (error) {
      console.error('Error loading storage usage:', error);
    }
  };

  const loadSessionDetails = async (session: SessionSummary) => {
    try {
      setLoadingSession(true);
      const fullSession = await voiceHistoryService.loadSession(session.fileName);
      if (fullSession) {
        setSelectedSession(fullSession);
      }
    } catch (error) {
      console.error('Error loading session details:', error);
      toast({
        title: "Error loading session",
        description: "Failed to load session details",
        variant: "destructive",
      });
    } finally {
      setLoadingSession(false);
    }
  };

  const deleteSession = async (session: SessionSummary) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      const success = await voiceHistoryService.deleteSession(session.fileName);
      if (success) {
        setSessions(prev => prev.filter(s => s.id !== session.id));
        if (selectedSession?.id === session.id) {
          setSelectedSession(null);
        }
        toast({
          title: "Session deleted",
          description: "Voice session has been removed",
        });
        loadStorageUsage();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: "Error deleting session",
        description: "Failed to delete the session",
        variant: "destructive",
      });
    }
  };

  const deleteOldSessions = async () => {
    if (!confirm('Delete all sessions older than 30 days?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const deletedCount = await voiceHistoryService.deleteOldSessions(user.id, 30);
      toast({
        title: "Old sessions deleted",
        description: `Removed ${deletedCount} old sessions`,
      });
      loadSessions();
      loadStorageUsage();
    } catch (error) {
      console.error('Error deleting old sessions:', error);
      toast({
        title: "Error",
        description: "Failed to delete old sessions",
        variant: "destructive",
      });
    }
  };

  const downloadSession = async (session: SessionSummary) => {
    try {
      const url = await voiceHistoryService.getSessionUrl(session.fileName);
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading session:', error);
      toast({
        title: "Error",
        description: "Failed to download session",
        variant: "destructive",
      });
    }
  };

  // Filter sessions based on search
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return session.id.toLowerCase().includes(query) ||
           format(new Date(session.startTime), 'PPP').toLowerCase().includes(query);
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Voice History</h1>
            <p className="text-sm text-gray-500 mt-1">Browse and manage your voice conversations</p>
          </div>
          {storageUsage && (
            <div className="text-sm text-gray-600">
              <p>{storageUsage.totalSessions} sessions</p>
              <p>{(storageUsage.totalSize / 1024 / 1024).toFixed(2)} MB used</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Session list */}
        <div className="w-96 border-r border-gray-200 bg-gray-50 flex flex-col">
          {/* Search and actions */}
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteOldSessions}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete sessions older than 30 days
            </Button>
          </div>

          {/* Sessions list */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-2">Loading sessions...</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No voice sessions found</p>
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <Card
                    key={session.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-gray-100",
                      selectedSession?.id === session.id && "bg-purple-50 border-purple-300"
                    )}
                    onClick={() => loadSessionDetails(session)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {format(new Date(session.startTime), 'PPp')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(session.startTime), { addSuffix: true })}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {session.messageCount} messages
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.duration ? `${Math.round(session.duration / 1000 / 60)}m` : 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {session.messageCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadSession(session);
                          }}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Session details */}
        <div className="flex-1 bg-white">
          {loadingSession ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : selectedSession ? (
            <div className="h-full flex flex-col">
              {/* Session header */}
              <div className="border-b border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Session Details
                </h2>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Started</p>
                    <p className="font-medium">{format(new Date(selectedSession.startTime), 'PPp')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Duration</p>
                    <p className="font-medium">
                      {selectedSession.metadata?.totalDuration 
                        ? `${Math.round(selectedSession.metadata.totalDuration / 1000 / 60)} minutes`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Model</p>
                    <p className="font-medium">{selectedSession.metadata?.modelUsed || 'Unknown'}</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  {selectedSession.messages.map((message) => (
                    <div key={message.id} className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        message.role === 'user' ? "bg-blue-100" : "bg-purple-100"
                      )}>
                        {message.role === 'user' ? (
                          <User className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Bot className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={cn(
                          "rounded-lg px-4 py-2 inline-block max-w-[80%]",
                          message.role === 'user' 
                            ? "bg-blue-50 text-gray-800" 
                            : "bg-gray-100 text-gray-800"
                        )}>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-400">
                            {format(new Date(message.timestamp), 'p')}
                          </p>
                          {message.audioCacheKey && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (isPlaying === message.audioCacheKey) {
                                  stopAudio();
                                } else {
                                  // Note: In a real implementation, you'd need to fetch the audio data
                                  // from storage or have it cached. For now, we just show the button.
                                  toast({
                                    title: "Audio playback",
                                    description: "Audio playback from history coming soon",
                                  });
                                }
                              }}
                              className="h-6 px-2"
                            >
                              {isPlaying === message.audioCacheKey ? (
                                <Pause className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Tool executions */}
                  {selectedSession.toolExecutions.length > 0 && (
                    <div className="mt-8 border-t pt-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        Tool Executions
                      </h3>
                      <div className="space-y-2">
                        {selectedSession.toolExecutions.map((tool, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{tool.toolName}</span>
                              <Badge 
                                variant={tool.status === 'success' ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {tool.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500">
                              {format(new Date(tool.timestamp), 'p')} • {tool.duration}ms
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a session to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}