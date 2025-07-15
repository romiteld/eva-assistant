'use client';

import { useChat } from 'ai/react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { textChatHistory, TextChatSession } from '@/lib/services/textChatHistory';
import { useEffect, useState, useRef, useCallback } from 'react';

export interface UseStreamingChatOptions {
  initialMessages?: any[];
  onFinish?: (message: any) => void;
  onError?: (error: Error) => void;
  sessionId?: string;
  enableHistory?: boolean;
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentSession, setCurrentSession] = useState<TextChatSession | null>(null);
  const [sessions, setSessions] = useState<TextChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const hasCreatedSession = useRef(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    error,
    reload,
    stop,
    append,
    setMessages,
    setInput,
  } = useChat({
    api: '/api/chat',
    initialMessages: options.initialMessages,
    onFinish: async (message) => {
      // Save assistant message to database if history is enabled
      if (options.enableHistory && currentSession) {
        await textChatHistory.addMessage(
          currentSession.id,
          'assistant',
          message.content
        );
      }
      options.onFinish?.(message);
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast({
        title: 'Chat Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
      options.onError?.(error);
    },
    body: {
      model: 'gemini-2.0-flash-exp',
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Load sessions on mount if history is enabled
  useEffect(() => {
    if (options.enableHistory && user) {
      loadSessions();
    }
  }, [options.enableHistory, user]);

  // Load specific session if sessionId is provided
  useEffect(() => {
    if (options.sessionId && options.enableHistory) {
      loadSession(options.sessionId);
    }
  }, [options.sessionId, options.enableHistory]);

  // Create session on first message if history is enabled
  const ensureSession = async (): Promise<TextChatSession | null> => {
    if (!options.enableHistory || !user) return null;
    
    if (currentSession) return currentSession;
    
    // Create new session with first message as title
    const title = input.trim().substring(0, 50) || 'New Chat';
    const session = await textChatHistory.createSession(title);
    
    if (session) {
      setCurrentSession(session);
      hasCreatedSession.current = true;
      // Reload sessions list
      loadSessions();
    }
    
    return session;
  };

  // Load all sessions
  const loadSessions = async () => {
    if (!user) return;
    
    setIsLoadingSessions(true);
    try {
      const loadedSessions = await textChatHistory.getSessions();
      setSessions(loadedSessions);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Load a specific session
  const loadSession = async (sessionId: string) => {
    if (!user) return;
    
    const session = await textChatHistory.getSession(sessionId);
    if (session) {
      setCurrentSession(session);
      
      // Load messages for this session
      const messages = await textChatHistory.getMessages(sessionId);
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.created_at),
      }));
      
      setMessages(formattedMessages);
    }
  };

  // Create a new session
  const createNewSession = useCallback(async () => {
    setCurrentSession(null);
    setMessages([]);
    hasCreatedSession.current = false;
  }, [setMessages]);

  // Delete a session
  const deleteSession = async (sessionId: string) => {
    const success = await textChatHistory.deleteSession(sessionId);
    if (success) {
      await loadSessions();
      if (currentSession?.id === sessionId) {
        createNewSession();
      }
      toast({
        title: 'Session deleted',
        description: 'The chat session has been deleted',
      });
    }
  };

  // Override handleSubmit to save user message
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Ensure we have a session if history is enabled
    if (options.enableHistory) {
      const session = await ensureSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'Failed to create chat session',
          variant: 'destructive',
        });
        return;
      }
      
      // Save user message to database
      await textChatHistory.addMessage(
        session.id,
        'user',
        input.trim()
      );
    }
    
    // Call original submit
    originalHandleSubmit(e);
  };

  // Helper to send a message programmatically
  const sendMessage = async (content: string) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to use the chat',
        variant: 'destructive',
      });
      return;
    }

    setInput(content);
    const fakeEvent = {
      preventDefault: () => {},
    } as React.FormEvent<HTMLFormElement>;
    
    await handleSubmit(fakeEvent);
  };

  // Clear chat history
  const clearMessages = () => {
    setMessages([]);
    if (currentSession && options.enableHistory) {
      textChatHistory.clearMessages(currentSession.id);
    }
  };

  return {
    // State
    messages,
    input,
    isLoading,
    error,
    currentSession,
    sessions,
    isLoadingSessions,
    
    // Actions
    handleInputChange,
    handleSubmit,
    sendMessage,
    reload,
    stop,
    append,
    setInput,
    clearMessages,
    createNewSession,
    loadSession,
    deleteSession,
    
    // Computed
    canSend: !isLoading && input.trim().length > 0,
  };
}