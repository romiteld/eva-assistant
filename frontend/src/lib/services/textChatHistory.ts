import { supabase } from '@/lib/supabase/browser';

export interface TextChatSession {
  id: string;
  user_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
  metadata: any;
}

export interface TextChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata: any;
}

export class TextChatHistory {
  // Create a new chat session
  static async createSession(title: string, model: string = 'gemini-2.0-flash-exp'): Promise<TextChatSession | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('text_chat_sessions')
        .insert({
          user_id: user.id,
          title,
          model,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating text chat session:', error);
      return null;
    }
  }

  // Get all sessions for the current user
  static async getSessions(limit: number = 50): Promise<TextChatSession[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('text_chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching text chat sessions:', error);
      return [];
    }
  }

  // Get a specific session
  static async getSession(sessionId: string): Promise<TextChatSession | null> {
    try {
      const { data, error } = await supabase
        .from('text_chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching text chat session:', error);
      return null;
    }
  }

  // Update session title
  static async updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('text_chat_sessions')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating text chat session title:', error);
      return false;
    }
  }

  // Delete a session (and all its messages)
  static async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('text_chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting text chat session:', error);
      return false;
    }
  }

  // Add a message to a session
  static async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ): Promise<TextChatMessage | null> {
    try {
      const { data, error } = await supabase
        .from('text_chat_messages')
        .insert({
          session_id: sessionId,
          role,
          content,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding text chat message:', error);
      return null;
    }
  }

  // Get messages for a session
  static async getMessages(sessionId: string, limit: number = 100): Promise<TextChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('text_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching text chat messages:', error);
      return [];
    }
  }

  // Delete all messages in a session
  static async clearMessages(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('text_chat_messages')
        .delete()
        .eq('session_id', sessionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error clearing text chat messages:', error);
      return false;
    }
  }

  // Subscribe to new messages in a session
  static subscribeToMessages(
    sessionId: string,
    callback: (message: TextChatMessage) => void
  ) {
    const subscription = supabase
      .channel(`text_chat_messages:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'text_chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          callback(payload.new as TextChatMessage);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  // Generate a title for a session based on first message
  static generateTitle(firstMessage: string): string {
    const maxLength = 50;
    const cleaned = firstMessage.trim().replace(/\n/g, ' ');
    
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    
    return cleaned.substring(0, maxLength) + '...';
  }
}

export const textChatHistory = TextChatHistory;