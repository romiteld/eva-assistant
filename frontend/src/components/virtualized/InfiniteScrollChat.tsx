import React, { useRef, useEffect, useCallback, useState } from 'react';
import { VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Loader2 } from 'lucide-react';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date | string;
  metadata?: any;
}

interface InfiniteScrollChatProps {
  messages: ChatMessage[];
  height: number;
  onLoadMore?: (direction: 'older' | 'newer') => Promise<void>;
  hasMoreOlder?: boolean;
  hasMoreNewer?: boolean;
  isLoading?: boolean;
  renderMessage: (message: ChatMessage, style: React.CSSProperties) => React.ReactNode;
  estimateMessageHeight?: (message: ChatMessage) => number;
  className?: string;
  autoScrollToBottom?: boolean;
  scrollBehavior?: 'smooth' | 'auto';
}

export default function InfiniteScrollChat({
  messages,
  height,
  onLoadMore,
  hasMoreOlder = false,
  hasMoreNewer = false,
  isLoading = false,
  renderMessage,
  estimateMessageHeight = () => 80,
  className = '',
  autoScrollToBottom = true,
  scrollBehavior = 'smooth'
}: InfiniteScrollChatProps) {
  const listRef = useRef<VariableSizeList | null>(null);
  const itemHeights = useRef<Map<string, number>>(new Map());
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const lastMessageCountRef = useRef(messages.length);

  // Calculate item height including loading indicators
  const getItemHeight = useCallback((index: number) => {
    // Loading indicator at top
    if (hasMoreOlder && index === 0) {
      return 50;
    }
    
    // Loading indicator at bottom
    if (hasMoreNewer && index === messages.length + (hasMoreOlder ? 1 : 0)) {
      return 50;
    }
    
    // Adjust index for actual message
    const messageIndex = hasMoreOlder ? index - 1 : index;
    const message = messages[messageIndex];
    
    if (!message) return 80;
    
    // Use measured height if available, otherwise estimate
    const measuredHeight = itemHeights.current.get(message.id);
    return measuredHeight || estimateMessageHeight(message);
  }, [messages, hasMoreOlder, hasMoreNewer, estimateMessageHeight]);

  // Total item count including loading indicators
  const itemCount = messages.length + (hasMoreOlder ? 1 : 0) + (hasMoreNewer ? 1 : 0);

  // Check if item is loaded
  const isItemLoaded = useCallback((index: number) => {
    // Loading indicators are always "loaded"
    if (hasMoreOlder && index === 0) return true;
    if (hasMoreNewer && index === itemCount - 1) return true;
    
    // Check if message exists
    const messageIndex = hasMoreOlder ? index - 1 : index;
    return messageIndex >= 0 && messageIndex < messages.length;
  }, [messages.length, hasMoreOlder, hasMoreNewer, itemCount]);

  // Load more items
  const loadMoreItems = useCallback(async (startIndex: number, stopIndex: number) => {
    if (isLoading || !onLoadMore) return;
    
    // Load older messages
    if (hasMoreOlder && startIndex === 0) {
      await onLoadMore('older');
    }
    
    // Load newer messages
    if (hasMoreNewer && stopIndex >= itemCount - 1) {
      await onLoadMore('newer');
    }
  }, [isLoading, onLoadMore, hasMoreOlder, hasMoreNewer, itemCount]);

  // Handle scroll events
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: any) => {
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // User is scrolling
    setIsUserScrolling(true);
    
    // Reset after scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 150);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (
      autoScrollToBottom && 
      !isUserScrolling && 
      messages.length > lastMessageCountRef.current &&
      listRef.current
    ) {
      const lastIndex = itemCount - 1;
      listRef.current.scrollToItem(lastIndex, 'end');
    }
    
    lastMessageCountRef.current = messages.length;
  }, [messages.length, itemCount, autoScrollToBottom, isUserScrolling]);

  // Render a single row
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    // Loading indicator at top
    if (hasMoreOlder && index === 0) {
      return (
        <div style={style} className="flex items-center justify-center p-2">
          <div className="flex items-center space-x-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading older messages...</span>
          </div>
        </div>
      );
    }
    
    // Loading indicator at bottom
    if (hasMoreNewer && index === itemCount - 1) {
      return (
        <div style={style} className="flex items-center justify-center p-2">
          <div className="flex items-center space-x-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading newer messages...</span>
          </div>
        </div>
      );
    }
    
    // Render message
    const messageIndex = hasMoreOlder ? index - 1 : index;
    const message = messages[messageIndex];
    
    if (!message) return null;
    
    // Measure and store height after render
    const measureHeight = (element: HTMLDivElement | null) => {
      if (element && element.offsetHeight) {
        const currentHeight = itemHeights.current.get(message.id);
        if (currentHeight !== element.offsetHeight) {
          itemHeights.current.set(message.id, element.offsetHeight);
          // Reset the item to remeasure
          listRef.current?.resetAfterIndex(index);
        }
      }
    };
    
    return (
      <div ref={measureHeight} style={style}>
        {renderMessage(message, style)}
      </div>
    );
  };

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadMoreItems}
      threshold={5}
    >
      {({ onItemsRendered, ref }) => (
        <VariableSizeList
          ref={(list) => {
            listRef.current = list;
            if (typeof ref === 'function') ref(list);
          }}
          className={className}
          height={height}
          width="100%"
          itemCount={itemCount}
          itemSize={getItemHeight}
          onItemsRendered={onItemsRendered}
          onScroll={handleScroll}
          overscanCount={5}
        >
          {Row}
        </VariableSizeList>
      )}
    </InfiniteLoader>
  );
}

// Hook for managing chat messages with pagination
export function useInfiniteChat(initialMessages: ChatMessage[] = []) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const prependMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages(prev => [...newMessages, ...prev]);
  }, []);

  const appendMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages(prev => [...prev, ...newMessages]);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => 
      prev.map(msg => msg.id === id ? { ...msg, ...updates } : msg)
    );
  }, []);

  const deleteMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasMoreOlder(false);
    setHasMoreNewer(false);
  }, []);

  return {
    messages,
    hasMoreOlder,
    hasMoreNewer,
    isLoading,
    setMessages,
    setHasMoreOlder,
    setHasMoreNewer,
    setIsLoading,
    addMessage,
    prependMessages,
    appendMessages,
    updateMessage,
    deleteMessage,
    clearMessages
  };
}