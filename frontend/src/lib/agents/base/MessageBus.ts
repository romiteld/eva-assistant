import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  BaseMessage,
  RequestMessage,
  ResponseMessage,
  MessageType,
} from './types';

interface MessageHandler {
  (message: BaseMessage): Promise<void>;
}

interface PendingRequest {
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

export class MessageBus extends EventEmitter {
  private static instance: MessageBus;
  private subscribers: Map<string, MessageHandler> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageQueue: BaseMessage[] = [];
  private processing = false;

  private constructor() {
    super();
  }

  static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  // Subscribe to messages for a specific agent
  subscribe(agentId: string, handler: MessageHandler): void {
    this.subscribers.set(agentId, handler);
    this.emit('subscriber-added', { agentId });
  }

  // Unsubscribe from messages
  unsubscribe(agentId: string): void {
    this.subscribers.delete(agentId);
    this.emit('subscriber-removed', { agentId });
  }

  // Send a message
  async send(message: BaseMessage): Promise<void> {
    // Add to queue
    this.messageQueue.push(message);
    
    // Process queue
    await this.processQueue();
  }

  // Send a request and wait for response
  async sendRequest(message: RequestMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      // Set up pending request
      const pending: PendingRequest = { resolve, reject };
      
      // Set timeout if specified
      if (message.timeout) {
        pending.timeout = setTimeout(() => {
          this.pendingRequests.delete(message.id);
          reject(new Error(`Request timeout: ${message.action}`));
        }, message.timeout);
      }
      
      this.pendingRequests.set(message.id, pending);
      
      // Send the message
      this.send(message).catch(error => {
        this.pendingRequests.delete(message.id);
        if (pending.timeout) {
          clearTimeout(pending.timeout);
        }
        reject(error);
      });
    });
  }

  // Broadcast a message to all agents
  async broadcast(message: BaseMessage): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [agentId, handler] of this.subscribers) {
      if (agentId !== message.from) {
        const messageCopy = { ...message, to: agentId };
        promises.push(this.deliverMessage(agentId, messageCopy));
      }
    }
    
    await Promise.allSettled(promises);
  }

  // Process message queue
  private async processQueue(): Promise<void> {
    if (this.processing || this.messageQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      
      try {
        await this.routeMessage(message);
      } catch (error) {
        console.error('Error routing message:', error);
        this.emit('message-error', { message, error });
      }
    }
    
    this.processing = false;
  }

  // Route a message to its destination
  private async routeMessage(message: BaseMessage): Promise<void> {
    // Handle response messages
    if (message.type === MessageType.RESPONSE && message.correlationId) {
      await this.handleResponse(message as ResponseMessage);
      return;
    }
    
    // Route to specific agent or broadcast
    if (message.to) {
      await this.deliverMessage(message.to, message);
    } else {
      await this.broadcast(message);
    }
  }

  // Deliver a message to a specific agent
  private async deliverMessage(
    agentId: string,
    message: BaseMessage
  ): Promise<void> {
    const handler = this.subscribers.get(agentId);
    
    if (!handler) {
      console.warn(`No handler found for agent: ${agentId}`);
      this.emit('delivery-failed', { agentId, message });
      return;
    }
    
    try {
      await handler(message);
      this.emit('message-delivered', { agentId, message });
    } catch (error) {
      console.error(`Error delivering message to ${agentId}:`, error);
      this.emit('delivery-error', { agentId, message, error });
      throw error;
    }
  }

  // Handle response messages
  private async handleResponse(message: ResponseMessage): Promise<void> {
    const pending = this.pendingRequests.get(message.correlationId!);
    
    if (!pending) {
      console.warn(`No pending request found for: ${message.correlationId}`);
      return;
    }
    
    // Clear timeout
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    
    // Remove from pending
    this.pendingRequests.delete(message.correlationId!);
    
    // Resolve or reject based on success
    if (message.success) {
      pending.resolve(message.data);
    } else {
      pending.reject(new Error(message.error || 'Request failed'));
    }
  }

  // Get message bus statistics
  getStats() {
    return {
      subscribers: this.subscribers.size,
      pendingRequests: this.pendingRequests.size,
      queueSize: this.messageQueue.length,
      processing: this.processing,
    };
  }

  // Clear all pending requests (used during shutdown)
  clearPendingRequests(): void {
    this.pendingRequests.forEach((pending, id) => {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error('Message bus shutting down'));
    });
    this.pendingRequests.clear();
  }
}