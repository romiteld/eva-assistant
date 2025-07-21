// AI Response Streaming Hook
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRealtimeNamespace } from './useRealtimeConnection';

interface StreamRequest {
  prompt: string;
  context?: any[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface StreamResponse {
  messageId: string;
  fullResponse: string;
  chunks: string[];
  isStreaming: boolean;
  error: string | null;
  metadata?: {
    tokensUsed: number;
    processingTime: number;
    model: string;
  };
}

interface UseAIStreamingOptions {
  onChunk?: (chunk: string, index: number) => void;
  onComplete?: (response: string, metadata: any) => void;
  onError?: (error: string) => void;
  autoScroll?: boolean;
}

export function useAIStreaming(options: UseAIStreamingOptions = {}) {
  const { isConnected, emit, on } = useRealtimeNamespace('ai-stream');
  const [activeStreams, setActiveStreams] = useState<Map<string, StreamResponse>>(new Map());
  const messageIdCounter = useRef(0);

  // Handle stream events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = [
      // Stream started
      on('stream:start', ({ messageId }: { messageId: string }) => {
        setActiveStreams(prev => {
          const next = new Map(prev);
          const stream = next.get(messageId);
          if (stream) {
            stream.isStreaming = true;
          }
          return next;
        });
      }),

      // Stream chunk received
      on('stream:chunk', (data: {
        messageId: string;
        chunk: string;
        index: number;
        metadata?: any;
      }) => {
        setActiveStreams(prev => {
          const next = new Map(prev);
          const stream = next.get(data.messageId);
          if (stream) {
            stream.chunks.push(data.chunk);
            stream.fullResponse += data.chunk;
            if (data.metadata) {
              stream.metadata = data.metadata;
            }
          }
          return next;
        });

        options.onChunk?.(data.chunk, data.index);
      }),

      // Stream completed
      on('stream:complete', (data: {
        messageId: string;
        fullResponse: string;
        metadata: any;
      }) => {
        setActiveStreams(prev => {
          const next = new Map(prev);
          const stream = next.get(data.messageId);
          if (stream) {
            stream.isStreaming = false;
            stream.fullResponse = data.fullResponse;
            stream.metadata = data.metadata;
          }
          return next;
        });

        options.onComplete?.(data.fullResponse, data.metadata);
      }),

      // Stream error
      on('stream:error', (data: {
        messageId: string;
        error: string;
      }) => {
        setActiveStreams(prev => {
          const next = new Map(prev);
          const stream = next.get(data.messageId);
          if (stream) {
            stream.isStreaming = false;
            stream.error = data.error;
          }
          return next;
        });

        options.onError?.(data.error);
      })
    ];

    return () => {
      unsubscribe.forEach(unsub => unsub());
    };
  }, [isConnected, on, options.onChunk, options.onComplete, options.onError]);

  // Start a new stream
  const startStream = useCallback(async (request: StreamRequest): Promise<string> => {
    if (!isConnected) {
      throw new Error('Not connected to streaming service');
    }

    const messageId = `msg_${Date.now()}_${messageIdCounter.current++}`;
    
    // Initialize stream state
    const streamResponse: StreamResponse = {
      messageId,
      fullResponse: '',
      chunks: [],
      isStreaming: true,
      error: null
    };

    setActiveStreams(prev => new Map(prev).set(messageId, streamResponse));

    // Send stream request
    emit('stream:request', {
      messageId,
      ...request
    });

    return messageId;
  }, [isConnected, emit]);

  // Cancel an active stream
  const cancelStream = useCallback((messageId: string) => {
    if (!isConnected) return;

    emit('stream:cancel', messageId);
    
    setActiveStreams(prev => {
      const next = new Map(prev);
      const stream = next.get(messageId);
      if (stream) {
        stream.isStreaming = false;
      }
      return next;
    });
  }, [isConnected, emit]);

  // Batch streaming for multiple prompts
  const batchStream = useCallback(async (requests: StreamRequest[]): Promise<string[]> => {
    if (!isConnected) {
      throw new Error('Not connected to streaming service');
    }

    const messageIds = requests.map((_, index) => 
      `batch_${Date.now()}_${messageIdCounter.current++}_${index}`
    );

    // Initialize all streams
    const newStreams = new Map<string, StreamResponse>();
    messageIds.forEach((messageId, index) => {
      newStreams.set(messageId, {
        messageId,
        fullResponse: '',
        chunks: [],
        isStreaming: true,
        error: null
      });
    });

    setActiveStreams(prev => new Map([...prev, ...newStreams]));

    // Send batch request
    emit('stream:batch', requests.map((request, index) => ({
      messageId: messageIds[index],
      ...request
    })));

    return messageIds;
  }, [isConnected, emit]);

  // Get stream by ID
  const getStream = useCallback((messageId: string): StreamResponse | undefined => {
    return activeStreams.get(messageId);
  }, [activeStreams]);

  // Clear completed streams
  const clearStreams = useCallback((messageIds?: string[]) => {
    if (messageIds) {
      setActiveStreams(prev => {
        const next = new Map(prev);
        messageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // Clear all non-active streams
      setActiveStreams(prev => {
        const next = new Map();
        prev.forEach((stream, id) => {
          if (stream.isStreaming) {
            next.set(id, stream);
          }
        });
        return next;
      });
    }
  }, []);

  return {
    // State
    isConnected,
    activeStreams: Array.from(activeStreams.values()),
    
    // Actions
    startStream,
    cancelStream,
    batchStream,
    getStream,
    clearStreams,
    
    // Helpers
    isStreaming: (messageId: string) => activeStreams.get(messageId)?.isStreaming ?? false,
    hasError: (messageId: string) => activeStreams.get(messageId)?.error != null
  };
}

// Hook for simpler single-stream usage
export function useAIStream(options?: UseAIStreamingOptions) {
  const streaming = useAIStreaming(options);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const stream = useCallback(async (prompt: string, context?: any[]) => {
    const messageId = await streaming.startStream({ prompt, context });
    setCurrentMessageId(messageId);
    return messageId;
  }, [streaming]);

  const cancel = useCallback(() => {
    if (currentMessageId) {
      streaming.cancelStream(currentMessageId);
    }
  }, [currentMessageId, streaming]);

  const currentStream = currentMessageId ? streaming.getStream(currentMessageId) : undefined;

  return {
    stream,
    cancel,
    response: currentStream?.fullResponse ?? '',
    isStreaming: currentStream?.isStreaming ?? false,
    error: currentStream?.error ?? null,
    metadata: currentStream?.metadata
  };
}