'use client';

import React, { useState, useEffect } from 'react';
import { StreamingChat } from './StreamingChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Plus, Trash2, MessageSquare, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { textChatHistory, TextChatSession } from '@/lib/services/textChatHistory';
import { cn } from '@/lib/utils';

interface TextChatWithHistoryProps {
  className?: string;
}

export function TextChatWithHistory({ className }: TextChatWithHistoryProps) {
  const [sessions, setSessions] = useState<TextChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const loadedSessions = await textChatHistory.getSessions();
      setSessions(loadedSessions);
    } catch (error) {
      console.error('Failed to load text chat sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const createNewSession = () => {
    setSelectedSessionId(undefined);
    // Reload sessions to show the new one when it's created
    setTimeout(loadSessions, 500);
  };

  const selectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const success = await textChatHistory.deleteSession(sessionId);
      if (success) {
        await loadSessions();
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(undefined);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6", className)}>
      {/* Chat Interface */}
      <div className="lg:col-span-2">
        <StreamingChat
          className="bg-white/5 border-white/10"
          height="500px"
          placeholder="Type your message to EVA..."
          welcomeMessage="Hi! I'm EVA, your AI recruitment assistant. I can help you find candidates, manage your pipeline, and answer questions about recruiting. How can I assist you today?"
          enableHistory={true}
          sessionId={selectedSessionId}
        />
      </div>

      {/* Chat History Sidebar */}
      <div>
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Text Chat History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <Button
                onClick={createNewSession}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </div>
            
            <ScrollArea className="h-[400px]">
              {isLoadingSessions ? (
                <div className="text-center text-gray-400 py-4">
                  Loading sessions...
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center text-gray-400 py-4">
                  No chat history yet
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer transition-colors",
                        selectedSessionId === session.id
                          ? 'bg-purple-600/20 border border-purple-500/30'
                          : 'bg-white/5 hover:bg-white/10'
                      )}
                      onClick={() => selectSession(session.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">
                            {session.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <p className="text-xs text-gray-400">
                              {format(new Date(session.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-2 text-red-400 hover:text-red-300"
                          onClick={(e) => deleteSession(session.id, e)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}