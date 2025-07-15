'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Video, 
  Mic, 
  History,
  Plus,
  Settings,
  Camera,
  Monitor,
  X,
  Loader2,
  Send,
  StopCircle
} from 'lucide-react';
import { useRequireAuth } from '@/hooks/useAuth';
import { UnifiedHistory } from '@/components/voice/UnifiedHistory';
import { ChatMode } from '@/components/voice/modes/ChatMode';
import { StreamMode } from '@/components/voice/modes/StreamMode';
import { VoiceMode } from '@/components/voice/modes/VoiceMode';
import { ModeSelector } from '@/components/voice/ModeSelector';
import { useUnifiedCommunication } from '@/hooks/useUnifiedCommunication';
import { CommunicationMode } from '@/types/communication';
import { cn } from '@/lib/utils';

export default function UnifiedVoicePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [mode, setMode] = useState<CommunicationMode>('chat');
  const [showHistory, setShowHistory] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const {
    sessions,
    currentSessionId,
    isLoadingSessions,
    createNewSession,
    selectSession,
    deleteSession,
    loadSessions
  } = useUnifiedCommunication();

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const handleModeChange = useCallback((newMode: CommunicationMode) => {
    // Stop any active streams when switching modes
    if (isStreaming) {
      setIsStreaming(false);
    }
    setMode(newMode);
  }, [isStreaming]);

  const handleNewSession = useCallback(async () => {
    await createNewSession(mode);
  }, [mode, createNewSession]);

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Left History Panel */}
        <div className={cn(
          "transition-all duration-300",
          showHistory ? "w-80" : "w-0 overflow-hidden"
        )}>
          <Card className="h-full bg-white/5 border-white/10">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <History className="w-5 h-5" />
                  History
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Button
                onClick={handleNewSession}
                className="w-full bg-purple-600 hover:bg-purple-700 mb-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                New {mode === 'chat' ? 'Chat' : mode === 'stream' ? 'Stream' : 'Voice Session'}
              </Button>
              
              <UnifiedHistory
                sessions={sessions}
                currentSessionId={currentSessionId}
                isLoading={isLoadingSessions}
                onSelectSession={selectSession}
                onDeleteSession={deleteSession}
                onRefresh={loadSessions}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Communication Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Header with Mode Selector */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {!showHistory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowHistory(true)}
                      className="text-gray-400 hover:text-white"
                    >
                      <History className="w-5 h-5" />
                    </Button>
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-white">Communication Hub</h1>
                    <p className="text-sm text-gray-400">
                      Chat, stream, or talk with AI assistance
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <ModeSelector
                    currentMode={mode}
                    onModeChange={handleModeChange}
                    disabled={isStreaming}
                  />
                  <Badge variant="secondary" className="text-xs">
                    Powered by Gemini
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Communication Canvas */}
          <Card className="flex-1 bg-white/5 border-white/10 overflow-hidden">
            <CardContent className="p-0 h-full">
              {mode === 'chat' && (
                <ChatMode 
                  sessionId={currentSessionId}
                  onNewSession={() => createNewSession('chat')}
                />
              )}
              {mode === 'stream' && (
                <StreamMode 
                  sessionId={currentSessionId}
                  onStreamingChange={setIsStreaming}
                  onNewSession={() => createNewSession('stream')}
                />
              )}
              {mode === 'voice' && (
                <VoiceMode 
                  sessionId={currentSessionId}
                  onNewSession={() => createNewSession('voice')}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}