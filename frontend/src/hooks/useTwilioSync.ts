import { useEffect, useState, useCallback, useRef } from 'react'
import { useTwilioSync as getTwilioSync } from '@/lib/services/twilio-sync'

interface TwilioSyncOptions {
  autoConnect?: boolean
  authToken?: string
  events?: string[]
}

interface TwilioSyncState {
  connected: boolean
  reconnectAttempts: number
  lastEvent?: any
  error?: Error
}

export function useTwilioSync(options: TwilioSyncOptions = {}) {
  const { autoConnect = true, authToken, events = [] } = options
  const [state, setState] = useState<TwilioSyncState>({
    connected: false,
    reconnectAttempts: 0
  })
  
  const sync = getTwilioSync()
  const eventHandlers = useRef<Map<string, (data: any) => void>>(new Map())
  const isConnecting = useRef(false)
  
  // Connect to sync service
  const connect = useCallback(async () => {
    if (isConnecting.current) return
    
    try {
      isConnecting.current = true
      await sync.connect(authToken)
      
      const status = sync.getStatus()
      setState(prev => ({ 
        ...prev, 
        connected: status.connected,
        reconnectAttempts: status.reconnectAttempts,
        error: undefined
      }))
      
      // Subscribe to initial events
      if (events.length > 0) {
        sync.subscribe(events)
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        connected: false,
        error: error as Error
      }))
    } finally {
      isConnecting.current = false
    }
  }, [authToken, events, sync])
  
  // Disconnect from sync service
  const disconnect = useCallback(() => {
    sync.disconnect()
    setState(prev => ({ ...prev, connected: false }))
  }, [sync])
  
  // Subscribe to events
  const subscribe = useCallback((newEvents: string[]) => {
    sync.subscribe(newEvents)
  }, [sync])
  
  // Register event handler
  const on = useCallback((event: string, handler: (data: any) => void) => {
    // Store handler for cleanup
    eventHandlers.current.set(event, handler)
    
    // Register with sync service
    const cleanup = sync.on(event, (data) => {
      handler(data)
      setState(prev => ({ ...prev, lastEvent: { event, data } }))
    })
    
    return cleanup
  }, [sync])
  
  // Remove event handler
  const off = useCallback((event: string) => {
    const handler = eventHandlers.current.get(event)
    if (handler) {
      sync.off(event, handler)
      eventHandlers.current.delete(event)
    }
  }, [sync])
  
  // Emit custom event
  const emit = useCallback((event: string, data: any) => {
    sync.emit(event, data)
  }, [sync])
  
  // Get current status
  const getStatus = useCallback(() => {
    return sync.getStatus()
  }, [sync])
  
  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !state.connected && !isConnecting.current) {
      connect()
    }
    
    // Cleanup on unmount
    return () => {
      // Remove all event handlers
      eventHandlers.current.forEach((handler, event) => {
        sync.off(event, handler)
      })
      eventHandlers.current.clear()
      
      // Disconnect if connected
      if (state.connected) {
        disconnect()
      }
    }
  }, [autoConnect, connect, disconnect, state.connected, sync])
  
  // Update connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const status = sync.getStatus()
      setState(prev => {
        if (prev.connected !== status.connected || 
            prev.reconnectAttempts !== status.reconnectAttempts) {
          return {
            ...prev,
            connected: status.connected,
            reconnectAttempts: status.reconnectAttempts
          }
        }
        return prev
      })
    }, 5000) // Check every 5 seconds
    
    return () => clearInterval(interval)
  }, [sync])
  
  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    on,
    off,
    emit,
    getStatus
  }
}

// Specific hooks for common Twilio events
export function useTwilioCallEvents(onCallEvent?: (event: any) => void) {
  const sync = useTwilioSync({
    events: ['call:new', 'call:status', 'call:ended']
  })
  
  useEffect(() => {
    if (!onCallEvent || !sync.connected) return
    
    const cleanups = [
      sync.on('call:new', onCallEvent),
      sync.on('call:status', onCallEvent),
      sync.on('call:ended', onCallEvent)
    ]
    
    return () => {
      cleanups.forEach(cleanup => cleanup())
    }
  }, [sync, onCallEvent])
  
  return sync
}

export function useTwilioSMSEvents(onSMSEvent?: (event: any) => void) {
  const sync = useTwilioSync({
    events: ['sms:received', 'sms:sent', 'sms:status']
  })
  
  useEffect(() => {
    if (!onSMSEvent || !sync.connected) return
    
    const cleanups = [
      sync.on('sms:received', onSMSEvent),
      sync.on('sms:sent', onSMSEvent),
      sync.on('sms:status', onSMSEvent)
    ]
    
    return () => {
      cleanups.forEach(cleanup => cleanup())
    }
  }, [sync, onSMSEvent])
  
  return sync
}

export function useTwilioConferenceEvents(onConferenceEvent?: (event: any) => void) {
  const sync = useTwilioSync({
    events: ['conference:started', 'conference:ended', 'conference:participant:joined', 'conference:participant:left']
  })
  
  useEffect(() => {
    if (!onConferenceEvent || !sync.connected) return
    
    const cleanups = [
      sync.on('conference:started', onConferenceEvent),
      sync.on('conference:ended', onConferenceEvent),
      sync.on('conference:participant:joined', onConferenceEvent),
      sync.on('conference:participant:left', onConferenceEvent)
    ]
    
    return () => {
      cleanups.forEach(cleanup => cleanup())
    }
  }, [sync, onConferenceEvent])
  
  return sync
}