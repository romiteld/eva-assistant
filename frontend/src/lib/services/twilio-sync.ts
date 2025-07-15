import { io, Socket } from 'socket.io-client'

// Type definitions for Twilio sync events
export interface TwilioSyncEvent {
  type: string
  data: any
  timestamp: number
  metadata?: any
}

export interface CallStatusEvent {
  callSid: string
  from: string
  to: string
  status: string
  duration?: number
  direction?: string
}

export interface SMSEvent {
  messageSid: string
  from: string
  to: string
  body: string
  status: string
  mediaUrls?: string[]
}

export interface ConferenceEvent {
  conferenceSid: string
  conferenceName: string
  participantCount: number
  status: string
  participants?: any[]
}

export interface RecordingEvent {
  recordingSid: string
  callSid: string
  duration: number
  url: string
  transcriptionAvailable?: boolean
}

export interface CampaignProgressEvent {
  campaignId: string
  totalMessages: number
  sent: number
  delivered: number
  failed: number
  progress: number
}

class TwilioSyncService {
  private socket: Socket | null = null
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnected = false
  
  constructor() {
    // Initialize service
  }
  
  connect(authToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001'
      
      this.socket = io(`${wsUrl}/twilio-sync`, {
        auth: {
          token: authToken
        },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 10000,
        timeout: 20000
      })
      
      this.socket.on('connect', () => {
        console.log('Connected to Twilio sync service')
        this.isConnected = true
        this.reconnectAttempts = 0
        resolve()
      })
      
      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from Twilio sync:', reason)
        this.isConnected = false
      })
      
      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error)
        this.reconnectAttempts++
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Failed to connect to Twilio sync service'))
        }
      })
      
      // Register all event listeners
      this.registerEventListeners()
    })
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }
  
  // Subscribe to specific events
  subscribe(events: string[]): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Not connected to sync service')
      return
    }
    
    this.socket.emit('subscribe', { events })
  }
  
  // Unsubscribe from events
  unsubscribe(events: string[]): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Not connected to sync service')
      return
    }
    
    this.socket.emit('unsubscribe', { events })
  }
  
  // Register event handler
  on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    
    this.eventHandlers.get(event)!.add(handler)
    
    // If socket is connected, register the listener
    if (this.socket && this.isConnected) {
      this.socket.on(event, handler)
    }
  }
  
  // Remove event handler
  off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
      
      if (handlers.size === 0) {
        this.eventHandlers.delete(event)
      }
    }
    
    // Remove from socket if connected
    if (this.socket) {
      this.socket.off(event, handler)
    }
  }
  
  // Emit custom events
  emit(event: string, data: any): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Not connected to sync service')
      return
    }
    
    this.socket.emit(event, data)
  }
  
  // Broadcast update via REST API (fallback)
  async broadcastUpdate(event: string, data: any): Promise<void> {
    try {
      const response = await fetch('/api/twilio/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ event, data })
      })
      
      if (!response.ok) {
        throw new Error('Failed to broadcast update')
      }
    } catch (error) {
      console.error('Broadcast error:', error)
    }
  }
  
  // Get connection status
  getStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    }
  }
  
  private registerEventListeners(): void {
    if (!this.socket) return
    
    // Re-register all stored event handlers
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.socket!.on(event, handler)
      })
    })
    
    // Register default event handlers
    this.socket.on('error', (error) => {
      console.error('Sync error:', error)
    })
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts')
      this.isConnected = true
      this.reconnectAttempts = 0
    })
    
    this.socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error)
    })
    
    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect after maximum attempts')
      this.isConnected = false
    })
  }
}

// Singleton instance
let twilioSyncInstance: TwilioSyncService | null = null

export function getTwilioSync(): TwilioSyncService {
  if (!twilioSyncInstance) {
    twilioSyncInstance = new TwilioSyncService()
  }
  return twilioSyncInstance
}

// React hook for Twilio sync
export function useTwilioSync() {
  const sync = getTwilioSync()
  
  const connect = async (authToken?: string) => {
    await sync.connect(authToken)
  }
  
  const disconnect = () => {
    sync.disconnect()
  }
  
  const subscribe = (events: string[]) => {
    sync.subscribe(events)
  }
  
  const on = (event: string, handler: (data: any) => void) => {
    sync.on(event, handler)
    
    // Return cleanup function
    return () => {
      sync.off(event, handler)
    }
  }
  
  const emit = (event: string, data: any) => {
    sync.emit(event, data)
  }
  
  const getStatus = () => {
    return sync.getStatus()
  }
  
  return {
    connect,
    disconnect,
    subscribe,
    on,
    off: sync.off.bind(sync),
    emit,
    getStatus
  }
}