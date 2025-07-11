import { supabase } from '@/lib/supabase/browser';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ConversationTurn, FunctionCall } from '@/types/voice';

export interface VoiceBroadcastPayload {
  event: 'turn' | 'transcription' | 'function_call' | 'state_change';
  data: any;
  userId: string;
  sessionId: string;
  timestamp: number;
}

export class VoiceBroadcastService {
  private channel: RealtimeChannel | null = null;
  private sessionId: string;
  private userId: string | null = null;
  private isSubscribed = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async initialize(userId: string) {
    this.userId = userId;
    
    // Set up authentication for realtime
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required for voice broadcast');
    }
    
    await supabase.realtime.setAuth(session.access_token);

    // Create a private channel for this voice session
    this.channel = supabase.channel(`voice-session:${this.sessionId}`, {
      config: {
        private: true,
        broadcast: { 
          ack: true, // Acknowledge broadcasts for reliability
          self: false // Don't receive own broadcasts
        }
      }
    });

    // Set up event listeners
    this.setupEventListeners();

    // Subscribe to the channel
    await this.subscribe();
  }

  private setupEventListeners() {
    if (!this.channel) return;

    this.channel
      .on('broadcast', { event: 'turn' }, (payload) => {
        console.log('Received turn broadcast:', payload);
        this.emit('turn', payload.payload.data);
      })
      .on('broadcast', { event: 'transcription' }, (payload) => {
        console.log('Received transcription broadcast:', payload);
        this.emit('transcription', payload.payload.data);
      })
      .on('broadcast', { event: 'function_call' }, (payload) => {
        console.log('Received function call broadcast:', payload);
        this.emit('function_call', payload.payload.data);
      })
      .on('broadcast', { event: 'state_change' }, (payload) => {
        console.log('Received state change broadcast:', payload);
        this.emit('state_change', payload.payload.data);
      });
  }

  private async subscribe() {
    if (!this.channel || this.isSubscribed) return;

    const status = await this.channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('Connected to voice broadcast channel');
        this.isSubscribed = true;
      } else if (err) {
        console.error('Failed to subscribe to voice broadcast:', err);
      }
    });
  }

  async broadcastTurn(turn: ConversationTurn) {
    if (!this.channel || !this.isSubscribed || !this.userId) return;

    // Verify authentication before broadcasting
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Cannot broadcast: user is not authenticated');
      return;
    }

    const payload: VoiceBroadcastPayload = {
      event: 'turn',
      data: turn,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    };

    const result = await this.channel.send({
      type: 'broadcast',
      event: 'turn',
      payload
    });

    if (result === 'error') {
      console.error('Failed to broadcast turn');
    }
  }

  async broadcastTranscription(transcription: { text: string; isFinal: boolean }) {
    if (!this.channel || !this.isSubscribed || !this.userId) return;

    // Verify authentication before broadcasting
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Cannot broadcast: user is not authenticated');
      return;
    }

    const payload: VoiceBroadcastPayload = {
      event: 'transcription',
      data: transcription,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'transcription',
      payload
    });
  }

  async broadcastFunctionCall(functionCall: FunctionCall) {
    if (!this.channel || !this.isSubscribed || !this.userId) return;

    // Verify authentication before broadcasting
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Cannot broadcast: user is not authenticated');
      return;
    }

    const payload: VoiceBroadcastPayload = {
      event: 'function_call',
      data: functionCall,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'function_call',
      payload
    });
  }

  async broadcastStateChange(state: string) {
    if (!this.channel || !this.isSubscribed || !this.userId) return;

    // Verify authentication before broadcasting
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Cannot broadcast: user is not authenticated');
      return;
    }

    const payload: VoiceBroadcastPayload = {
      event: 'state_change',
      data: { state },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'state_change',
      payload
    });
  }

  // Event emitter functionality
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  async cleanup() {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
      this.isSubscribed = false;
    }
    this.listeners.clear();
  }
}