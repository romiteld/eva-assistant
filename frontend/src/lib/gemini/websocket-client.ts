import { createClient } from '@/lib/supabase/browser';
import React from 'react';

export interface GeminiWebSocketConfig {
  onOpen?: () => void;
  onMessage?: (data: any) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: string) => void;
}

export interface GeminiMessage {
  type: string;
  [key: string]: any;
}

export class GeminiWebSocketClient {
  private ws: WebSocket | null = null;
  private config: GeminiWebSocketConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private token: string | null = null;

  constructor(config: GeminiWebSocketConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      // Get WebSocket connection info from API
      const response = await fetch('/api/gemini', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': this.getCSRFToken(),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to get WebSocket info: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success || !data.websocket) {
        throw new Error('Invalid WebSocket configuration received');
      }

      this.token = data.websocket.token;
      
      // Build WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${data.websocket.url}?token=${encodeURIComponent(this.token || '')}`;

      // Create WebSocket connection
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.config.onOpen?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.config.onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        this.config.onError?.(new Error('WebSocket connection error'));
      };

      this.ws.onclose = (event) => {
        this.config.onClose?.(event.code, event.reason);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            this.connect();
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };
    } catch (error) {
      console.error('Failed to connect to Gemini WebSocket:', error);
      this.config.onError?.(error as Error);
    }
  }

  send(message: GeminiMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  sendSetup(model: string = 'models/gemini-2.0-flash-exp'): void {
    this.send({
      type: 'setup',
      setup: {
        model,
      },
    });
  }

  sendMessage(content: string): void {
    this.send({
      type: 'clientContent',
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: content }],
          },
        ],
      },
    });
  }

  sendRealtimeInput(data: any): void {
    this.send({
      type: 'realtimeInput',
      realtimeInput: data,
    });
  }

  sendToolResponse(functionCall: any, response: any): void {
    this.send({
      type: 'toolResponse',
      toolResponse: {
        functionCall,
        response,
      },
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private getCSRFToken(): string {
    // Get CSRF token from cookie
    const match = document.cookie.match(/csrf-token=([^;]+)/);
    return match ? match[1] : '';
  }
}

// React hook for using Gemini WebSocket
export function useGeminiWebSocket(config: GeminiWebSocketConfig) {
  const [client, setClient] = React.useState<GeminiWebSocketClient | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    const wsClient = new GeminiWebSocketClient({
      ...config,
      onOpen: () => {
        setIsConnected(true);
        config.onOpen?.();
      },
      onClose: (code, reason) => {
        setIsConnected(false);
        config.onClose?.(code, reason);
      },
    });

    setClient(wsClient);
    wsClient.connect();

    return () => {
      wsClient.disconnect();
    };
  }, [config]);

  return {
    client,
    isConnected,
    send: (message: GeminiMessage) => client?.send(message),
    sendMessage: (content: string) => client?.sendMessage(content),
    sendSetup: (model?: string) => client?.sendSetup(model),
    disconnect: () => client?.disconnect(),
  };
}