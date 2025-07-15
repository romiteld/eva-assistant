'use client';

import React, { useRef, useEffect } from 'react';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, StopCircle, RefreshCw, Trash2, Bot, User, History, Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { TextChatSession } from '@/lib/services/textChatHistory';

interface StreamingChatProps {
  className?: string;
  placeholder?: string;
  welcomeMessage?: string;
  height?: string;
  enableHistory?: boolean;
  sessionId?: string;
}

export function StreamingChat({ 
  className,
  placeholder = "Ask EVA anything about recruiting...",
  welcomeMessage = "Hi! I'm EVA, your AI recruitment assistant. How can I help you today?",
  height = "600px",
  enableHistory = false,
  sessionId
}: StreamingChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    messages,
    input,
    isLoading,
    error,
    handleInputChange,
    handleSubmit,
    stop,
    reload,
    clearMessages,
    canSend,
    setInput,
    currentSession,
    sessions,
    isLoadingSessions,
    createNewSession,
    loadSession,
    deleteSession,
  } = useStreamingChat({
    initialMessages: welcomeMessage ? [
      {
        id: 'welcome',
        role: 'assistant',
        content: welcomeMessage,
      }
    ] : [],
    enableHistory,
    sessionId,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle Enter key (send) and Shift+Enter (new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        handleSubmit(e as any);
      }
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            EVA Chat
          </CardTitle>
          <div className="flex gap-2">
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 flex flex-col" style={{ height }}>
        {/* Messages */}
        <ScrollArea 
          ref={scrollRef}
          className="flex-1 p-4"
        >
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-purple-600 text-white">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800'
                  )}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.content}
                  </div>
                  {message.createdAt && (
                    <div className={cn(
                      "text-xs mt-1",
                      message.role === 'user' 
                        ? 'text-purple-200' 
                        : 'text-gray-500 dark:text-gray-400'
                    )}>
                      {format(new Date(message.createdAt), 'HH:mm')}
                    </div>
                  )}
                </div>
                
                {message.role === 'user' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gray-600 text-white">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-purple-600 text-white">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            
            {error && (
              <div className="flex items-center justify-center">
                <div className="bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg px-4 py-2 text-sm">
                  Error: {error.message}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reload()}
                    className="ml-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              className="min-h-[44px] max-h-[150px] resize-none"
              rows={1}
            />
            {isLoading ? (
              <Button
                type="button"
                onClick={stop}
                variant="destructive"
                size="icon"
              >
                <StopCircle className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!canSend}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </form>
        </div>
      </CardContent>
    </Card>
  );
}