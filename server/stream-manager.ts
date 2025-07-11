// AI Response Streaming Manager
import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Readable } from 'stream';

interface StreamRequest {
  messageId: string;
  prompt: string;
  context?: any[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface StreamChunk {
  messageId: string;
  chunk: string;
  index: number;
  finished: boolean;
  metadata?: {
    tokensUsed?: number;
    processingTime?: number;
  };
}

export class StreamManager {
  private io: Server;
  private supabase: SupabaseClient;
  private genAI: GoogleGenerativeAI;
  private activeStreams: Map<string, AbortController>;

  constructor(io: Server, supabase: SupabaseClient, genAI: GoogleGenerativeAI) {
    this.io = io;
    this.supabase = supabase;
    this.genAI = genAI;
    this.activeStreams = new Map();
  }

  handleConnection(socket: Socket) {
    const userId = socket.data.userId;

    // Handle stream request
    socket.on('stream:request', async (data: StreamRequest) => {
      try {
        await this.handleStreamRequest(socket, userId, data);
      } catch (error) {
        console.error('Stream request error:', error);
        socket.emit('stream:error', {
          messageId: data.messageId,
          error: error.message
        });
      }
    });

    // Handle stream cancellation
    socket.on('stream:cancel', (messageId: string) => {
      this.cancelStream(messageId);
    });

    // Handle batch streaming for multiple prompts
    socket.on('stream:batch', async (requests: StreamRequest[]) => {
      await this.handleBatchStream(socket, userId, requests);
    });
  }

  private async handleStreamRequest(
    socket: Socket,
    userId: string,
    request: StreamRequest
  ) {
    const { messageId, prompt, context = [], model = 'gemini-pro', temperature = 0.7 } = request;
    const startTime = Date.now();

    // Create abort controller for cancellation
    const abortController = new AbortController();
    this.activeStreams.set(messageId, abortController);

    try {
      // Log request
      await this.supabase.from('ai_requests').insert({
        user_id: userId,
        message_id: messageId,
        prompt,
        model,
        status: 'streaming',
        started_at: new Date().toISOString()
      });

      // Initialize Gemini model
      const genModel = this.genAI.getGenerativeModel({ 
        model,
        generationConfig: {
          temperature,
          maxOutputTokens: request.maxTokens || 2048,
          topP: 0.8,
          topK: 40
        }
      });

      // Build chat history
      const chat = genModel.startChat({
        history: context.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        generationConfig: {
          temperature,
          maxOutputTokens: request.maxTokens || 2048
        }
      });

      // Stream response
      const result = await chat.sendMessageStream(prompt);
      
      let fullResponse = '';
      let chunkIndex = 0;
      let tokensUsed = 0;

      // Send initial stream start event
      socket.emit('stream:start', { messageId });

      for await (const chunk of result.stream) {
        // Check if cancelled
        if (abortController.signal.aborted) {
          break;
        }

        const text = chunk.text();
        fullResponse += text;
        
        // Calculate approximate tokens (rough estimate)
        tokensUsed += Math.ceil(text.length / 4);

        // Send chunk to client
        const streamChunk: StreamChunk = {
          messageId,
          chunk: text,
          index: chunkIndex++,
          finished: false,
          metadata: {
            tokensUsed,
            processingTime: Date.now() - startTime
          }
        };

        socket.emit('stream:chunk', streamChunk);

        // Small delay to prevent overwhelming the client
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Send completion event
      if (!abortController.signal.aborted) {
        socket.emit('stream:complete', {
          messageId,
          fullResponse,
          metadata: {
            tokensUsed,
            processingTime: Date.now() - startTime,
            model,
            timestamp: new Date().toISOString()
          }
        });

        // Store complete response
        await this.supabase.from('ai_responses').insert({
          user_id: userId,
          message_id: messageId,
          content: fullResponse,
          model,
          tokens_used: tokensUsed,
          processing_time: Date.now() - startTime,
          completed_at: new Date().toISOString()
        });

        // Update request status
        await this.supabase
          .from('ai_requests')
          .update({ status: 'completed' })
          .eq('message_id', messageId);
      }

    } catch (error) {
      console.error('Streaming error:', error);
      
      // Send error event
      socket.emit('stream:error', {
        messageId,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Update request status
      await this.supabase
        .from('ai_requests')
        .update({ 
          status: 'failed',
          error: error.message
        })
        .eq('message_id', messageId);

    } finally {
      // Cleanup
      this.activeStreams.delete(messageId);
    }
  }

  private async handleBatchStream(
    socket: Socket,
    userId: string,
    requests: StreamRequest[]
  ) {
    // Process requests in parallel with concurrency limit
    const concurrencyLimit = 3;
    const results = [];

    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const batch = requests.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(request => 
        this.handleStreamRequest(socket, userId, request)
      );
      
      await Promise.allSettled(batchPromises);
    }
  }

  private cancelStream(messageId: string) {
    const controller = this.activeStreams.get(messageId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(messageId);
    }
  }

  handleDisconnect(socket: Socket) {
    // Cancel all active streams for this socket
    // Note: In production, you'd track which streams belong to which socket
    console.log(`Cleaning up streams for socket ${socket.id}`);
  }

  async cleanup() {
    // Cancel all active streams
    for (const [messageId, controller] of this.activeStreams) {
      controller.abort();
    }
    this.activeStreams.clear();
  }
}