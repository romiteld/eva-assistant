import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  AgentType,
  AgentState,
  BaseMessage,
  RequestMessage,
  ResponseMessage,
  EventMessage,
  ErrorMessage,
  MessageType,
  AgentAction,
  AgentCapability,
} from './types';
import { MessageBus } from './MessageBus';
import { AgentRegistry } from './AgentRegistry';

export interface AgentConfig {
  id?: string;
  name: string;
  type: AgentType;
  description?: string;
  metadata?: Record<string, any>;
}

export abstract class Agent extends EventEmitter {
  protected id: string;
  protected name: string;
  protected type: AgentType;
  protected description?: string;
  protected metadata: Record<string, any>;
  protected status: AgentState['status'] = 'idle';
  protected messageBus: MessageBus;
  protected registry: AgentRegistry;
  protected actions: Map<string, AgentAction> = new Map();
  protected heartbeatInterval?: NodeJS.Timeout;
  protected requestTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: AgentConfig) {
    super();
    this.id = config.id || `${config.type}-${uuidv4()}`;
    this.name = config.name;
    this.type = config.type;
    this.description = config.description;
    this.metadata = config.metadata || {};
    this.messageBus = MessageBus.getInstance();
    this.registry = AgentRegistry.getInstance();
  }

  // Lifecycle methods
  async initialize(): Promise<void> {
    // Register agent
    await this.registry.register(this);
    
    // Subscribe to messages
    this.messageBus.subscribe(this.id, this.handleMessage.bind(this));
    
    // Set up heartbeat
    this.startHeartbeat();
    
    // Initialize agent-specific functionality
    await this.onInitialize();
    
    this.status = 'idle';
    this.emit('initialized', { agent: this.getState() });
  }

  async shutdown(): Promise<void> {
    this.status = 'offline';
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Clear request timeouts
    this.requestTimeouts.forEach(timeout => clearTimeout(timeout));
    this.requestTimeouts.clear();
    
    // Agent-specific cleanup
    await this.onShutdown();
    
    // Unsubscribe from messages
    this.messageBus.unsubscribe(this.id);
    
    // Unregister agent
    await this.registry.unregister(this.id);
    
    this.emit('shutdown', { agent: this.getState() });
  }

  // Abstract methods for subclasses
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract processRequest(message: RequestMessage): Promise<any>;

  // Message handling
  protected async handleMessage(message: BaseMessage): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.REQUEST:
          await this.handleRequest(message as RequestMessage);
          break;
        case MessageType.EVENT:
          await this.handleEvent(message as EventMessage);
          break;
        case MessageType.ERROR:
          await this.handleError(message as ErrorMessage);
          break;
      }
    } catch (error) {
      console.error(`Agent ${this.id} error handling message:`, error);
      if (message.type === MessageType.REQUEST && message.from) {
        await this.sendError(message.from, error as Error, message.id);
      }
    }
  }

  protected async handleRequest(message: RequestMessage): Promise<void> {
    this.status = 'busy';
    const startTime = Date.now();
    
    try {
      // Validate action
      const action = this.actions.get(message.action);
      if (!action) {
        throw new Error(`Unknown action: ${message.action}`);
      }
      
      // Validate input
      const input = action.inputSchema.parse(message.payload);
      
      // Set timeout if specified
      if (message.timeout) {
        const timeoutId = setTimeout(() => {
          this.sendError(message.from, new Error('Request timeout'), message.id);
          this.requestTimeouts.delete(message.id);
        }, message.timeout);
        this.requestTimeouts.set(message.id, timeoutId);
      }
      
      // Process request
      const result = await this.processRequest(message);
      
      // Clear timeout
      const timeoutId = this.requestTimeouts.get(message.id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.requestTimeouts.delete(message.id);
      }
      
      // Validate output
      const output = action.outputSchema.parse(result);
      
      // Send response
      await this.sendResponse(message.from, output, message.id);
      
      // Emit metrics
      this.emit('request-processed', {
        action: message.action,
        duration: Date.now() - startTime,
        success: true,
      });
    } catch (error) {
      // Clear timeout
      const timeoutId = this.requestTimeouts.get(message.id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.requestTimeouts.delete(message.id);
      }
      
      await this.sendError(message.from, error as Error, message.id);
      
      // Emit metrics
      this.emit('request-processed', {
        action: message.action,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      });
    } finally {
      this.status = 'idle';
    }
  }

  protected async handleEvent(message: EventMessage): Promise<void> {
    this.emit(`event:${message.event}`, message.data);
  }

  protected async handleError(message: ErrorMessage): Promise<void> {
    console.error(`Agent ${this.id} received error:`, message.error);
    this.emit('error', message);
  }

  // Message sending
  async sendRequest(
    to: string,
    action: string,
    payload: any,
    timeout?: number
  ): Promise<any> {
    const message: RequestMessage = {
      id: uuidv4(),
      from: this.id,
      to,
      type: MessageType.REQUEST,
      timestamp: Date.now(),
      action,
      payload,
      timeout,
    };
    
    return this.messageBus.sendRequest(message);
  }

  async sendResponse(
    to: string,
    data: any,
    correlationId: string
  ): Promise<void> {
    const message: ResponseMessage = {
      id: uuidv4(),
      from: this.id,
      to,
      type: MessageType.RESPONSE,
      timestamp: Date.now(),
      correlationId,
      success: true,
      data,
    };
    
    await this.messageBus.send(message);
  }

  async sendError(
    to: string,
    error: Error,
    correlationId: string
  ): Promise<void> {
    const message: ResponseMessage = {
      id: uuidv4(),
      from: this.id,
      to,
      type: MessageType.RESPONSE,
      timestamp: Date.now(),
      correlationId,
      success: false,
      error: error.message,
    };
    
    await this.messageBus.send(message);
  }

  async broadcast(event: string, data: any): Promise<void> {
    const message: EventMessage = {
      id: uuidv4(),
      from: this.id,
      type: MessageType.EVENT,
      timestamp: Date.now(),
      event,
      data,
    };
    
    await this.messageBus.broadcast(message);
  }

  // Action registration
  protected registerAction(name: string, action: AgentAction): void {
    this.actions.set(name, action);
  }

  // State management
  getState(): AgentState {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      capabilities: Array.from(this.actions.keys()),
      metadata: this.metadata,
      lastHeartbeat: Date.now(),
    };
  }

  getCapabilities(): AgentCapability {
    const actions: Record<string, AgentAction> = {};
    this.actions.forEach((action, name) => {
      actions[name] = action;
    });
    
    return {
      actions,
      events: this.eventNames() as string[],
    };
  }

  // Heartbeat management
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      await this.registry.updateHeartbeat(this.id);
      this.emit('heartbeat', { agent: this.getState() });
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): AgentType {
    return this.type;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getStatus(): AgentState['status'] {
    return this.status;
  }
}