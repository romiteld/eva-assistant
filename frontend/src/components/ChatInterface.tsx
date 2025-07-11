import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { supabase, realtimeHelpers } from '@/lib/supabase/browser';
import { useAuth } from '@/app/providers';
import { geminiHelpers } from '@/lib/gemini/client';
import { getCursorPaginatedMessages } from '@/lib/supabase/pagination';
import InfiniteScrollChat, { ChatMessage, useInfiniteChat } from './virtualized/InfiniteScrollChat';

interface Message {
  id: string;
  user_id: string;
  content: string;
  role: 'user' | 'assistant';
  metadata?: any;
  created_at: string;
}

export default function ChatInterface() {
  const { user } = useAuth();
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    hasMoreOlder,
    hasMoreNewer,
    isLoading,
    setHasMoreOlder,
    setHasMoreNewer,
    setIsLoading,
    addMessage,
    prependMessages,
    appendMessages,
    updateMessage
  } = useInfiniteChat();

  // Load initial messages
  const loadInitialMessages = useCallback(async (convId: string) => {
    setIsLoading(true);
    try {
      const result = await getCursorPaginatedMessages(convId, {
        limit: 50
      });

      const formattedMessages: ChatMessage[] = result.data
        .filter((msg): msg is NonNullable<typeof msg> => msg !== null)
        .map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'assistant',
          timestamp: msg.created_at,
          metadata: msg.metadata
        }));

      // Messages are returned in descending order, so reverse for display
      prependMessages(formattedMessages.reverse());
      setHasMoreOlder(result.hasMore);
    } catch (error) {
      console.error('Error loading messages:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [prependMessages, setHasMoreOlder, setIsLoading]);

  // Create or load conversation
  useEffect(() => {
    if (!user) return;

    const initConversation = async () => {
      try {
        // Check for existing conversation
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (conversations && conversations.length > 0) {
          setConversationId(conversations[0].id);
          await loadInitialMessages(conversations[0].id);
        } else {
          // Create new conversation
          const { data: newConversation } = await supabase
            .from('conversations')
            .insert({
              user_id: user.id,
              title: 'New Chat',
              model_used: 'gemini-2.5-pro'
            })
            .select()
            .single();

          if (newConversation) {
            setConversationId(newConversation.id);
          }
        }
      } catch (error) {
        console.error('Error initializing conversation:', error instanceof Error ? error.message : 'Unknown error');
      }
    };

    initConversation();
  }, [user, loadInitialMessages]);

  // Load more messages (older)
  const loadMoreMessages = async (direction: 'older' | 'newer') => {
    if (!conversationId || isLoading) return;

    setIsLoading(true);
    try {
      const cursor = direction === 'older' 
        ? messages[0]?.timestamp 
        : messages[messages.length - 1]?.timestamp;
      
      const cursorString = cursor instanceof Date ? cursor.toISOString() : cursor;

      const result = await getCursorPaginatedMessages(conversationId, {
        cursor: cursorString,
        limit: 30,
        direction: direction === 'older' ? 'before' : 'after'
      });

      const formattedMessages: ChatMessage[] = result.data
        .filter((msg): msg is NonNullable<typeof msg> => msg !== null)
        .map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'assistant',
          timestamp: msg.created_at,
          metadata: msg.metadata
        }));

      if (direction === 'older') {
        prependMessages(formattedMessages.reverse());
        setHasMoreOlder(result.hasMore);
      } else {
        appendMessages(formattedMessages);
        setHasMoreNewer(result.hasMore);
      }
    } catch (error) {
      console.error('Error loading more messages:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newMessage: ChatMessage = {
              id: payload.new.id,
              content: payload.new.content,
              role: payload.new.role as 'user' | 'assistant',
              timestamp: payload.new.created_at,
              metadata: payload.new.metadata
            };
            
            // Only add if not already present (avoid duplicates)
            if (!messages.find(m => m.id === newMessage.id)) {
              addMessage(newMessage);
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            updateMessage(payload.new.id, {
              content: payload.new.content,
              metadata: payload.new.metadata
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, conversationId, messages, addMessage, updateMessage]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !user || !conversationId || isSending) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    try {
      // Insert user message
      const { data: userMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: messageContent
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Get AI response
      const responseText = await geminiHelpers.generateWithThinking(messageContent);

      // Insert assistant message
      const { error: assistantError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: responseText,
          metadata: {
            model: 'gemini-2.5-pro',
            tokens: 0 // TODO: Calculate actual token usage
          }
        });

      if (assistantError) throw assistantError;

      // Update conversation metadata
      await supabase
        .from('conversations')
        .update({
          updated_at: new Date().toISOString(),
          // TODO: Replace with proper increment - sql template doesn't exist on supabase client
          // tokens_used: supabase.sql`tokens_used + ${response.tokens || 0}`,
          // cost: supabase.sql`cost + ${response.cost || 0}`
        })
        .eq('id', conversationId);

    } catch (error) {
      console.error('Error sending message:', error);
      // Show error to user
      addMessage({
        id: `error-${Date.now()}`,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        role: 'assistant',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  // Render message
  const renderMessage = (message: ChatMessage, style: React.CSSProperties) => {
    const isUser = message.role === 'user';
    
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4 py-2`}>
        <div className={`flex max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2`}>
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-blue-600' : 'bg-gray-700'
          }`}>
            {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          </div>
          <div className={`rounded-lg px-4 py-2 ${
            isUser 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-100 border border-gray-700'
          }`}>
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            <p className={`text-xs mt-1 ${
              isUser ? 'text-blue-200' : 'text-gray-400'
            }`}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Estimate message height based on content length
  const estimateMessageHeight = (message: ChatMessage) => {
    const baseHeight = 80;
    const charsPerLine = 50;
    const lines = Math.ceil(message.content.length / charsPerLine);
    return baseHeight + (lines - 1) * 20;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-800">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-xl font-semibold flex items-center">
          <Bot className="w-5 h-5 mr-2 text-blue-500" />
          EVA Chat Assistant
        </h2>
      </div>

      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-hidden">
        <InfiniteScrollChat
          messages={messages}
          height={chatContainerRef.current?.clientHeight || 500}
          onLoadMore={loadMoreMessages}
          hasMoreOlder={hasMoreOlder}
          hasMoreNewer={hasMoreNewer}
          isLoading={isLoading}
          renderMessage={renderMessage}
          estimateMessageHeight={estimateMessageHeight}
          className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
          autoScrollToBottom={true}
        />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="px-4 py-4 border-t border-gray-800">
        <div className="flex space-x-4">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 bg-gray-800 text-gray-100 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            rows={1}
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg px-6 py-3 flex items-center space-x-2 transition-colors"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}